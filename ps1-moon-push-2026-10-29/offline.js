// Local / bot-fill match simulation (4 players: you + 3 NPCs).
// Push physics mirror EDEN2 MoonPushGame intent (impulse + slide); server authoritative online.
import { ARENA_R, MATCH_SEC, MATCH_PLAYERS, fellOff } from './world.js';

export { MATCH_PLAYERS };

/** Tunables — keep aligned with EDEN2 `realtime/` MoonPushGame when possible. */
export const PUSH = {
  range: 1.45,
  coneDot: 0.2,
  impulse: 17.5,
  recoil: 4.2,
  cooldown: 0.68,
  whiffBoost: 5,
};

export const MOVE = {
  accel: 7.2,
  drag: 2.8,
  maxSpeed: 11,
  bodyR: 0.55,
};

const BOT_NAMES = ['Bot-Alpha', 'Bot-Beta', 'Bot-Gamma'];

function spawnPos(i, n) {
  const a = (i / n) * Math.PI * 2;
  return { x: Math.cos(a) * 3.5, z: Math.sin(a) * 3.5 };
}

function clampSpeed(p) {
  const s = Math.hypot(p.vx, p.vz);
  if (s > MOVE.maxSpeed) {
    p.vx = (p.vx / s) * MOVE.maxSpeed;
    p.vz = (p.vz / s) * MOVE.maxSpeed;
  }
}

/** @returns {boolean} hit at least one target (mirrors EDEN2 tryDirectedPush). */
function tryDirectedPush(attacker, players, dirX, dirZ) {
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-4) {
    dirX = Math.sin(attacker.yaw);
    dirZ = Math.cos(attacker.yaw);
  } else {
    dirX /= len;
    dirZ /= len;
  }
  let hits = 0;
  for (const q of players) {
    if (q === attacker || !q.alive) continue;
    const dx = q.x - attacker.x;
    const dz = q.z - attacker.z;
    const d = Math.hypot(dx, dz);
    if (d > PUSH.range || d < 1e-4) continue;
    const nx = dx / d;
    const nz = dz / d;
    const dot = dirX * nx + dirZ * nz;
    if (dot < PUSH.coneDot) continue;
    const falloff = 1 - (d / PUSH.range) * 0.35;
    const mag = PUSH.impulse * falloff * (0.85 + dot * 0.35);
    q.vx += nx * mag;
    q.vz += nz * mag;
    hits++;
  }
  if (hits > 0) {
    attacker.vx -= dirX * PUSH.recoil;
    attacker.vz -= dirZ * PUSH.recoil;
  } else {
    attacker.vx += dirX * PUSH.whiffBoost;
    attacker.vz += dirZ * PUSH.whiffBoost;
  }
  return hits > 0;
}

export class OfflineRoom {
  /** @param {string} localName @param {{ localId?: string, lobbySec?: number }} opts */
  constructor(localName, opts = {}) {
    const localId = opts.localId ?? 'local';
    const lobbySec = opts.lobbySec ?? 2.5;
    this.phase = 'lobby';
    this.timeLeft = MATCH_SEC;
    this.countdown = 0;
    this.tick = 0;
    this.players = [
      {
        id: localId, name: localName, x: 0, z: 0, vx: 0, vz: 0, deaths: 0, alive: true,
        yaw: 0, bot: false, pushCd: 0,
      },
      ...BOT_NAMES.slice(0, MATCH_PLAYERS - 1).map((name, i) => ({
        id: `bot${i}`, name, ...spawnPos(i + 1, MATCH_PLAYERS), vx: 0, vz: 0, deaths: 0, alive: true,
        yaw: 0, bot: true, pushCd: 0, think: Math.random() * 2,
      })),
    ];
    this._lobbyT = lobbySec;
    this._acc = 0;
    this.input = { x: 0, z: 0, push: false };
    this.lastPushHit = false;
  }

  startLobbyTimer(dt) {
    if (this.phase !== 'lobby') return;
    this._lobbyT -= dt;
    if (this._lobbyT <= 0) {
      this.phase = 'countdown';
      this.countdown = 3;
      this._acc = 0;
    }
  }

  step(dt) {
    if (this.phase === 'lobby') { this.startLobbyTimer(dt); return null; }
    if (this.phase === 'countdown') {
      this._acc += dt;
      if (this._acc >= 1) {
        this._acc = 0;
        this.countdown--;
        if (this.countdown <= 0) {
          this.phase = 'play';
          this.timeLeft = MATCH_SEC;
        }
      }
      return null;
    }
    if (this.phase === 'result') return null;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'result';
      return { type: 'result', scores: this.players.map(p => ({ id: p.id, name: p.name, deaths: p.deaths })) };
    }

    this.tick++;
    this.lastPushHit = false;
    for (const p of this.players) {
      if (p.bot) this._botAI(p, dt);
      else this._applyInput(p, this.input, dt);
      p.pushCd = Math.max(0, p.pushCd - dt);
    }
    this._integrate(dt);
    this._collide();
    this.input.push = false;
    return {
      type: 'state',
      tick: this.tick,
      phase: 'play',
      timeLeft: this.timeLeft,
      alive: this.players.filter(p => p.alive).length,
      players: this.players.map(({ id, name, x, z, vx, vz, deaths, alive, yaw }) => ({ id, name, x, z, vx, vz, deaths, alive, yaw })),
    };
  }

  _applyInput(p, inp, dt) {
    p.vx += inp.x * MOVE.accel * dt;
    p.vz += inp.z * MOVE.accel * dt;
    if (inp.push && p.pushCd <= 0) {
      p.pushCd = PUSH.cooldown;
      this.lastPushHit = tryDirectedPush(p, this.players, inp.x, inp.z);
    }
    if (Math.abs(inp.x) + Math.abs(inp.z) > 0.05) p.yaw = Math.atan2(inp.x, inp.z);
    clampSpeed(p);
  }

  _botAI(p, dt) {
    p.think -= dt;
    let tx = 0, tz = 0, push = false;
    const local = this.players.find(x => !x.bot);
    if (local && p.think <= 0) {
      p.think = 0.6 + Math.random();
      const dx = local.x - p.x, dz = local.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < PUSH.range * 0.95 && Math.random() < 0.4) push = true;
      else { tx = dx / d; tz = dz / d; }
    } else {
      tx = Math.sin(this.tick * 0.07 + p.id.length);
      tz = Math.cos(this.tick * 0.05);
    }
    this._applyInput(p, { x: tx, z: tz, push }, dt);
  }

  _integrate(dt) {
    const fr = Math.exp(-MOVE.drag * dt);
    for (const p of this.players) {
      p.vx *= fr;
      p.vz *= fr;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      clampSpeed(p);
      if (fellOff(p.x, p.z)) {
        p.deaths++;
        const s = spawnPos(this.players.indexOf(p), this.players.length);
        p.x = s.x; p.z = s.z; p.vx = p.vz = 0;
      }
    }
  }

  _collide() {
    const R = MOVE.bodyR;
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const a = this.players[i], b = this.players[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        if (d >= R * 2 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d;
        const overlap = R * 2 - d;
        a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
        b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;
        const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rv < 0) {
          const imp = rv * -0.45;
          a.vx -= imp * nx; a.vz -= imp * nz;
          b.vx += imp * nx; b.vz += imp * nz;
        }
      }
    }
  }
}
