// Local / bot-fill match simulation (4 players: you + 3 NPCs).
import { ARENA_R, MATCH_SEC, MATCH_PLAYERS, fellOff } from './world.js';

export { MATCH_PLAYERS };

const BOT_NAMES = ['Bot-Alpha', 'Bot-Beta', 'Bot-Gamma'];

function spawnPos(i, n) {
  const a = (i / n) * Math.PI * 2;
  return { x: Math.cos(a) * 3.5, z: Math.sin(a) * 3.5 };
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
    const sp = 7.5;
    p.vx += inp.x * sp * dt;
    p.vz += inp.z * sp * dt;
    if (inp.push && p.pushCd <= 0) {
      p.pushCd = 0.55;
      const len = Math.hypot(inp.x, inp.z);
      let fx;
      let fz;
      if (len > 0.05) {
        fx = (inp.x / len) * 11;
        fz = (inp.z / len) * 11;
      } else {
        fx = Math.sin(p.yaw) * 11;
        fz = Math.cos(p.yaw) * 11;
      }
      p.vx += fx;
      p.vz += fz;
    }
    if (Math.abs(inp.x) + Math.abs(inp.z) > 0.05) p.yaw = Math.atan2(inp.x, inp.z);
  }

  _botAI(p, dt) {
    p.think -= dt;
    let tx = 0, tz = 0, push = false;
    const local = this.players.find(x => !x.bot);
    if (local && p.think <= 0) {
      p.think = 0.6 + Math.random();
      const dx = local.x - p.x, dz = local.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < 2.2 && Math.random() < 0.35) push = true;
      else { tx = dx / d; tz = dz / d; }
    } else {
      tx = Math.sin(this.tick * 0.07 + p.id.length);
      tz = Math.cos(this.tick * 0.05);
    }
    this._applyInput(p, { x: tx, z: tz, push }, dt);
  }

  _integrate(dt) {
    const fr = Math.pow(0.08, dt);
    for (const p of this.players) {
      p.vx *= fr;
      p.vz *= fr;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      if (fellOff(p.x, p.z)) {
        p.deaths++;
        const s = spawnPos(this.players.indexOf(p), this.players.length);
        p.x = s.x; p.z = s.z; p.vx = p.vz = 0;
      }
    }
  }

  _collide() {
    const R = 0.55;
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
          const imp = rv * -0.85;
          a.vx -= imp * nx; a.vz -= imp * nz;
          b.vx += imp * nx; b.vz += imp * nz;
        }
      }
    }
  }
}
