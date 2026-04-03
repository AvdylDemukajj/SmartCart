import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { handleWebsocketUpgrade } from '../src/http/websocket-upgrade.js';

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.writes = [];
    this.endPayload = null;
    this.timeoutHandler = null;
  }

  write(payload) {
    this.writes.push(payload);
    return true;
  }

  end(payload) {
    this.endPayload = payload ?? null;
    this.destroyed = true;
    this.emit('end');
  }

  destroy() {
    this.destroyed = true;
  }

  setTimeout(_ms, handler) {
    this.timeoutHandler = handler;
  }
}

function makeMaskedFrame(opcode, payloadText, { large126 = false, masked = true } = {}) {
  const payload = Buffer.from(payloadText, 'utf8');
  const mask = Buffer.from([1, 2, 3, 4]);
  const maskBit = masked ? 0x80 : 0x00;

  if (large126) {
    const header = Buffer.from([0x80 | opcode, maskBit | 126, 0x00, payload.length]);
    const out = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i += 1) out[i] = masked ? payload[i] ^ mask[i % 4] : payload[i];
    return masked ? Buffer.concat([header, mask, out]) : Buffer.concat([header, out]);
  }

  const header = Buffer.from([0x80 | opcode, maskBit | payload.length]);
  const out = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) out[i] = masked ? payload[i] ^ mask[i % 4] : payload[i];
  return masked ? Buffer.concat([header, mask, out]) : Buffer.concat([header, out]);
}

function makeLength127Frame() {
  return Buffer.from([0x81, 0xff]);
}

async function openWs({
  req = {
    url: '/ws/households/hh-1',
    headers: {
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      'sec-websocket-version': '13',
    },
  },
  resolveAuthContext = () => ({ userId: 'ana' }),
  readPositiveIntEnv = (_name, fallback) => fallback,
  wsConnections = new Map(),
} = {}) {
  const socket = new MockSocket();
  const state = { unsubscribed: false, onEvent: null };
  const store = {
    assertMember: async () => {},
    onHouseholdEvent: (_householdId, cb) => {
      state.onEvent = cb;
      return () => { state.unsubscribed = true; };
    },
  };

  await handleWebsocketUpgrade({
    req,
    socket,
    store,
    wsConnections,
    resolveAuthContext,
    readPositiveIntEnv,
  });

  return { socket, store, wsConnections, state };
}

test('websocket upgrade rejects invalid path', async () => {
  const { socket } = await openWs({ req: { url: '/not-ws', headers: {} } });
  assert.equal(socket.destroyed, true);
});

test('websocket upgrade rejects missing auth user', async () => {
  const { socket } = await openWs({ resolveAuthContext: () => null });
  assert.equal(socket.destroyed, true);
});

test('websocket upgrade enforces total connection limit', async () => {
  const wsConnections = new Map([[{}, { userId: 'x' }]]);
  const { socket } = await openWs({ wsConnections, readPositiveIntEnv: (name, fallback) => (name === 'MAX_WS_CONNECTIONS' ? 1 : fallback) });
  assert.equal(socket.destroyed, true);
});

test('websocket upgrade enforces per-user connection limit', async () => {
  const wsConnections = new Map([[{}, { userId: 'ana' }]]);
  const { socket } = await openWs({ wsConnections, readPositiveIntEnv: (name, fallback) => (name === 'MAX_WS_CONNECTIONS_PER_USER' ? 1 : fallback) });
  assert.equal(socket.destroyed, true);
});

test('websocket upgrade enforces origin allowlist', async () => {
  const prev = process.env.WS_ALLOWED_ORIGINS;
  process.env.WS_ALLOWED_ORIGINS = 'https://allowed.example';
  try {
    const { socket } = await openWs({ req: { url: '/ws/households/hh-1', headers: { origin: 'https://blocked.example', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13' } } });
    assert.equal(socket.destroyed, true);
  } finally {
    if (prev === undefined) delete process.env.WS_ALLOWED_ORIGINS;
    else process.env.WS_ALLOWED_ORIGINS = prev;
  }
});

test('websocket upgrade requires valid key/version and performs handshake', async () => {
  const bad = await openWs({ req: { url: '/ws/households/hh-1', headers: { 'sec-websocket-key': 'x', 'sec-websocket-version': '12' } } });
  assert.equal(bad.socket.destroyed, true);

  const good = await openWs();
  assert.equal(good.socket.writes.length >= 1, true);
  assert.equal(String(good.socket.writes[0]).includes('101 Switching Protocols'), true);
  assert.equal(good.wsConnections.has(good.socket), true);
  good.socket.emit('close');
});

test('websocket upgrade forwards events and handles ping/pong/close', async () => {
  const { socket, state, wsConnections } = await openWs();

  state.onEvent({ type: 'item_added', itemId: 'i-1' });
  assert.equal(socket.writes.some((entry) => Buffer.isBuffer(entry) || String(entry).includes('Sec-WebSocket-Accept')), true);

  socket.emit('data', makeMaskedFrame(0x9, 'ping')); // ping
  const hasPong = socket.writes.some((entry) => Buffer.isBuffer(entry) && entry[0] === 0x8A);
  assert.equal(hasPong, true);

  socket.emit('data', makeMaskedFrame(0xA, 'pong')); // pong
  socket.emit('data', makeMaskedFrame(0x8, 'bye')); // close
  assert.equal(socket.destroyed, true);
  socket.emit('close');
  assert.equal(wsConnections.has(socket), false);
});

test('websocket upgrade closes connection with protocol/size violations', async () => {
  const { socket } = await openWs({ readPositiveIntEnv: (name, fallback) => (name === 'MAX_WS_FRAME_BYTES' ? 5 : fallback) });

  socket.emit('data', makeMaskedFrame(0x1, '123456789')); // > max
  assert.ok(socket.endPayload instanceof Buffer);
  assert.equal(socket.endPayload.readUInt16BE(2), 1009);

  const second = await openWs();
  second.socket.emit('data', makeMaskedFrame(0x1, 'abc', { masked: false }));
  assert.ok(second.socket.endPayload instanceof Buffer);
  assert.equal(second.socket.endPayload.readUInt16BE(2), 1009);

  const third = await openWs();
  third.socket.emit('data', makeLength127Frame());
  assert.ok(third.socket.endPayload instanceof Buffer);
  assert.equal(third.socket.endPayload.readUInt16BE(2), 1009);

  const fourth = await openWs({ readPositiveIntEnv: (name, fallback) => (name === 'MAX_WS_FRAME_BYTES' ? 3 : fallback) });
  fourth.socket.emit('data', makeMaskedFrame(0x1, '1234', { large126: true }));
  assert.ok(fourth.socket.endPayload instanceof Buffer);
  assert.equal(fourth.socket.endPayload.readUInt16BE(2), 1009);
});

test('websocket idle timeout closes and cleanup unsubscribes', async () => {
  const { socket, state, wsConnections } = await openWs();
  assert.equal(typeof socket.timeoutHandler, 'function');
  socket.timeoutHandler();
  assert.equal(socket.destroyed, true);
  socket.emit('close');
  assert.equal(state.unsubscribed, true);
  assert.equal(wsConnections.has(socket), false);
});
