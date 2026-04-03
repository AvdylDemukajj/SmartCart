import { createHash } from 'node:crypto';
import { URL } from 'node:url';

function websocketAcceptKey(secWebSocketKey) {
  return createHash('sha1').update(`${secWebSocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}

function encodeWsTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const length = payload.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }
  if (length < 65536) {
    const header = Buffer.from([0x81, 126, (length >> 8) & 0xff, length & 0xff]);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function encodeWsControlFrame(opcode, payloadBuffer = Buffer.alloc(0)) {
  const length = payloadBuffer.length;
  if (length > 125) throw new Error('WS_CONTROL_FRAME_TOO_LARGE');
  return Buffer.concat([Buffer.from([0x80 | opcode, length]), payloadBuffer]);
}

function encodeWsCloseFrame(code = 1000, reason = '') {
  const reasonBuffer = Buffer.from(String(reason || '').slice(0, 123), 'utf8');
  const payload = Buffer.alloc(2 + reasonBuffer.length);
  payload.writeUInt16BE(code, 0);
  reasonBuffer.copy(payload, 2);
  return encodeWsControlFrame(0x8, payload);
}

function parseFirstWsFrame(buffer, maxFrameBytes) {
  if (!buffer || buffer.length < 2) return null;
  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    return { error: 'WS_FRAME_TOO_LARGE' };
  }
  if (!masked) return { error: 'WS_PROTOCOL_ERROR' };
  if (length > maxFrameBytes) return { error: 'WS_FRAME_TOO_LARGE' };
  if (buffer.length < offset + 4 + length) return null;
  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.alloc(length);
  for (let i = 0; i < length; i += 1) {
    payload[i] = buffer[offset + i] ^ mask[i % 4];
  }
  return { opcode, payload };
}

export async function handleWebsocketUpgrade({
  req,
  socket,
  store,
  wsConnections,
  resolveAuthContext,
  readPositiveIntEnv,
}) {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!/^\/ws\/households\/[^/]+$/.test(url.pathname)) {
    socket.destroy();
    return;
  }
  const householdId = url.pathname.split('/')[3];
  const authContext = resolveAuthContext(req);
  const userId = authContext?.userId ?? null;
  if (!userId) {
    socket.destroy();
    return;
  }
  await store.assertMember(userId, householdId);

  const maxWsConnections = readPositiveIntEnv('MAX_WS_CONNECTIONS', 5000);
  if (wsConnections.size >= maxWsConnections) {
    socket.destroy();
    return;
  }
  const maxPerUserConnections = readPositiveIntEnv('MAX_WS_CONNECTIONS_PER_USER', 20);
  const perUserConnections = Array.from(wsConnections.values())
    .filter((entry) => entry.userId === userId)
    .length;
  if (perUserConnections >= maxPerUserConnections) {
    socket.destroy();
    return;
  }
  const allowedOrigins = (process.env.WS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (allowedOrigins.length > 0) {
    if (!allowedOrigins.includes('*')) {
      const origin = req.headers.origin;
      if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) {
        socket.destroy();
        return;
      }
    }
  }

  const wsKey = req.headers['sec-websocket-key'];
  const wsVersion = req.headers['sec-websocket-version'];
  if (typeof wsKey !== 'string' || String(wsVersion) !== '13') {
    socket.destroy();
    return;
  }

  const accept = websocketAcceptKey(wsKey);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n'
      + 'Upgrade: websocket\r\n'
      + 'Connection: Upgrade\r\n'
      + `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  const unsubscribe = store.onHouseholdEvent(householdId, (event) => {
    if (!socket.destroyed) socket.write(encodeWsTextFrame(JSON.stringify({ type: 'activity', event })));
  });
  const idleTimeoutMs = readPositiveIntEnv('WS_IDLE_TIMEOUT_MS', 120_000);
  const heartbeatIntervalMs = readPositiveIntEnv('WS_HEARTBEAT_INTERVAL_MS', 30_000);
  const heartbeatGraceMs = readPositiveIntEnv('WS_HEARTBEAT_GRACE_MS', 90_000);
  const maxWsFrameBytes = readPositiveIntEnv('MAX_WS_FRAME_BYTES', 16_384);
  let lastPongAt = Date.now();

  const heartbeat = setInterval(() => {
    if (socket.destroyed) return;
    if (Date.now() - lastPongAt > heartbeatGraceMs) {
      socket.end();
      return;
    }
    socket.write(encodeWsControlFrame(0x9));
  }, heartbeatIntervalMs);

  socket.on('data', (chunk) => {
    const frame = parseFirstWsFrame(chunk, maxWsFrameBytes);
    if (!frame) return;
    if (frame.error) {
      if (!socket.destroyed) socket.end(encodeWsCloseFrame(1009, frame.error));
      return;
    }
    if (frame.opcode === 0xA) lastPongAt = Date.now();
    if (frame.opcode === 0x9 && !socket.destroyed) socket.write(encodeWsControlFrame(0xA, frame.payload));
    if (frame.opcode === 0x8) socket.end();
  });

  socket.setTimeout(idleTimeoutMs, () => {
    socket.end();
  });

  wsConnections.set(socket, { unsubscribe, userId, heartbeat });
  const cleanup = () => {
    const state = wsConnections.get(socket);
    if (state?.unsubscribe) state.unsubscribe();
    if (state?.heartbeat) clearInterval(state.heartbeat);
    wsConnections.delete(socket);
  };
  socket.on('close', cleanup);
  socket.on('end', cleanup);
  socket.on('error', cleanup);
}
