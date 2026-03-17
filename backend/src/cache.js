import net from 'node:net';

class InMemoryAsyncCache {
  constructor() {
    this.map = new Map();
  }

  async getJson(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async setJson(key, value, ttlSec) {
    this.map.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async delByPrefix(prefix) {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }
}

function encodeCommand(parts) {
  let out = `*${parts.length}\r\n`;
  for (const part of parts) {
    const str = String(part);
    out += `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
  }
  return out;
}

function parseResp(data) {
  const text = data.toString('utf8');
  if (text.startsWith('+') || text.startsWith(':')) return text.slice(1).trim();
  if (text.startsWith('$-1')) return null;
  if (text.startsWith('$')) {
    const idx = text.indexOf('\r\n');
    const len = Number(text.slice(1, idx));
    return text.slice(idx + 2, idx + 2 + len);
  }
  if (text.startsWith('*')) {
    const lines = text.split('\r\n').filter(Boolean);
    const items = [];
    for (let i = 2; i < lines.length; i += 2) items.push(lines[i]);
    return items;
  }
  throw new Error('REDIS_PARSE_ERROR');
}

class SimpleRedisCache {
  constructor({ host, port }) {
    this.host = host;
    this.port = port;
  }

  send(parts) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port }, () => {
        socket.write(encodeCommand(parts));
      });
      const chunks = [];
      socket.on('data', (chunk) => chunks.push(chunk));
      socket.on('error', reject);
      socket.on('end', () => {
        try {
          resolve(parseResp(Buffer.concat(chunks)));
        } catch (error) {
          reject(error);
        }
      });
      socket.on('close', () => {
        if (!chunks.length) reject(new Error('REDIS_NO_RESPONSE'));
      });
      setTimeout(() => socket.end(), 60);
    });
  }

  async getJson(key) {
    const value = await this.send(['GET', key]);
    if (!value) return null;
    return JSON.parse(value);
  }

  async setJson(key, value, ttlSec) {
    await this.send(['SET', key, JSON.stringify(value), 'EX', String(ttlSec)]);
  }

  async delByPrefix(prefix) {
    const keys = await this.send(['KEYS', `${prefix}*`]);
    if (Array.isArray(keys) && keys.length) await this.send(['DEL', ...keys]);
  }
}

export async function createCacheFromEnv() {
  const url = process.env.REDIS_URL;
  if (!url) return new InMemoryAsyncCache();

  try {
    const parsed = new URL(url);
    const host = parsed.hostname || '127.0.0.1';
    const port = Number(parsed.port || '6379');
    const cache = new SimpleRedisCache({ host, port });
    await cache.send(['PING']);
    return cache;
  } catch {
    return new InMemoryAsyncCache();
  }
}
