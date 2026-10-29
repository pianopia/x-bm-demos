/**
 * EDEN2 moon-push WebSocket client.
 * Protocol: pianopia/EDEN2 realtime/MOONPUSH.md (welcome / lobby / countdown / state / result).
 * Override URL: ?ws=wss://host/path
 *
 * Input (unchanged): `{ type:"input", seq, move:{x,z}, push:boolean }` — move is world XZ;
 * server MoonPushGame should apply cone/range impulse to targets + recoil (see offline.js PUSH/MOVE).
 * State players should include vx/vz after knockback for client slide interpolation.
 */
const FALLBACKS = [
  'wss://realtime.eden14.com/moonpush',
  'wss://eden-realtime-biti2v34ya-an.a.run.app/moonpush',
];

export function wsUrlFromQuery() {
  const q = new URLSearchParams(location.search).get('ws');
  if (q) return q;
  return FALLBACKS[0];
}

export class MoonNet {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.ws = null;
    this.seq = 0;
    this.myId = null;
    this.connected = false;
    this._pingIv = null;
    this._urlIdx = 0;
    this._urls = [wsUrlFromQuery(), ...FALLBACKS.filter(u => u !== wsUrlFromQuery())];
  }

  connect(name) {
    this._name = name;
    this._tryConnect();
  }

  _tryConnect() {
    const url = this._urls[this._urlIdx % this._urls.length];
    this.onStatus?.('connecting', url);
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this._failUrl(e.message);
      return;
    }
    const failTimer = setTimeout(() => {
      if (!this.connected) {
        this.ws?.close();
        this._failUrl('timeout');
      }
    }, 4500);
    this.ws.onopen = () => {
      clearTimeout(failTimer);
      this.connected = true;
      this.onStatus?.('online', url);
      this.send({ type: 'queue', name: this._name });
      this._pingIv = setInterval(() => this.send({ type: 'ping', t: Date.now() }), 8000);
    };
    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'welcome' || msg.type === 'joined') {
        this.myId = msg.id ?? msg.playerId ?? msg.you ?? null;
      }
      this.onMessage?.(msg);
    };
    this.ws.onclose = () => {
      clearTimeout(failTimer);
      this._cleanup();
      if (!this._gaveUp) this.onStatus?.('closed', url);
    };
    this.ws.onerror = () => {
      clearTimeout(failTimer);
      this._cleanup();
      this._failUrl('error');
    };
  }

  _failUrl(reason) {
    this._cleanup();
    this._urlIdx++;
    if (this._urlIdx < this._urls.length) {
      setTimeout(() => this._tryConnect(), 400);
    } else {
      this._gaveUp = true;
      this.onStatus?.('offline', reason);
    }
  }

  _cleanup() {
    this.connected = false;
    clearInterval(this._pingIv);
    this._pingIv = null;
    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;
  }

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  sendInput(moveX, moveZ, push) {
    this.send({ type: 'input', seq: ++this.seq, move: { x: moveX, z: moveZ }, push: !!push });
  }

  disconnect() {
    this._gaveUp = true;
    this._cleanup();
  }
}

/** Normalize server state player list to { id, name, x, z, deaths, alive, yaw } */
export function normalizePlayers(msg) {
  const raw = msg.players ?? msg.roster ?? [];
  return raw.map((p, i) => ({
    id: String(p.id ?? p.playerId ?? i),
    name: p.name ?? p.n ?? `Player${i + 1}`,
    x: +p.x || 0,
    z: +p.z || (+p.y === +p.y && p.y != null ? +p.y : 0),
    deaths: p.deaths ?? p.d ?? 0,
    alive: p.alive !== false && p.eliminated !== true,
    yaw: p.yaw ?? p.r ?? 0,
    vx: p.vx ?? 0,
    vz: p.vz ?? 0,
  }));
}
