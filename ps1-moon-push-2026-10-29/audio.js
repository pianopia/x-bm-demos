/** Moon Push: Muse DAW WAV loop BGM + procedural 8-bit SFX. */
const KEY = 'moonpush-audio-v2';

const BGM_URL = {
  lobby: new URL('./audio/moon-push-lobby.wav', import.meta.url),
  match: new URL('./audio/moon-push-match.wav', import.meta.url),
};

/** Post-gain targets (lobby WAV peaks ~0.37; match is hotter 8-bit). */
const BGM_LEVEL = { lobby: 0.55, match: 0.5 };

function pref() {
  try { return { muted: false, vol: 0.55, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { muted: false, vol: 0.55 }; }
}

export class MoonAudio {
  constructor() {
    const p = pref();
    this.ctx = null;
    this.muted = p.muted;
    this.vol = p.vol;
    this._master = null;
    this._bgmBus = null;
    this._lobbyGain = null;
    this._matchGain = null;
    this._buf = { lobby: null, match: null };
    this._src = { lobby: null, match: null };
    this._loadPromise = null;
    this._mode = 'off';
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this._master = this.ctx.createGain();
    this._master.gain.value = this.muted ? 0 : this.vol;
    this._master.connect(this.ctx.destination);

    this._bgmBus = this.ctx.createGain();
    this._bgmBus.gain.value = 1;
    this._bgmBus.connect(this._master);

    this._lobbyGain = this.ctx.createGain();
    this._lobbyGain.gain.value = 0;
    this._lobbyGain.connect(this._bgmBus);

    this._matchGain = this.ctx.createGain();
    this._matchGain.gain.value = 0;
    this._matchGain.connect(this._bgmBus);
  }

  _persist() {
    localStorage.setItem(KEY, JSON.stringify({ muted: this.muted, vol: this.vol }));
  }

  setMuted(m) {
    this.muted = m;
    if (this._master) this._master.gain.value = m ? 0 : this.vol;
    this._persist();
    if (!m && this._mode !== 'off') this.setBgm(this._mode);
    else if (m) this._fadeLoopsOff();
  }

  setVolume(v) {
    this.vol = v;
    if (this._master && !this.muted) this._master.gain.value = v;
    this._persist();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  _ensureBuffers() {
    if (this._buf.lobby && this._buf.match) return Promise.resolve();
    if (this._loadPromise) return this._loadPromise;
    this.unlock();
    const decodeOne = async (key) => {
      const res = await fetch(BGM_URL[key]);
      if (!res.ok) throw new Error(`BGM fetch ${key}: ${res.status}`);
      const ab = await res.arrayBuffer();
      return this.ctx.decodeAudioData(ab);
    };
    this._loadPromise = Promise.all([decodeOne('lobby'), decodeOne('match')]).then(([lobby, match]) => {
      this._buf.lobby = lobby;
      this._buf.match = match;
    });
    return this._loadPromise;
  }

  _startLoop(key) {
    if (this._src[key] || !this._buf[key]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._buf[key];
    src.loop = true;
    src.connect(key === 'lobby' ? this._lobbyGain : this._matchGain);
    src.start(0);
    this._src[key] = src;
  }

  _stopLoop(key) {
    const src = this._src[key];
    if (!src) return;
    try { src.stop(); } catch { /* already stopped */ }
    this._src[key] = null;
  }

  _fadeLoopsOff() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._lobbyGain.gain.setTargetAtTime(0, t, 0.2);
    this._matchGain.gain.setTargetAtTime(0, t, 0.2);
    window.setTimeout(() => {
      this._stopLoop('lobby');
      this._stopLoop('match');
    }, 450);
  }

  _applyLoopGains(mode) {
    const t = this.ctx.currentTime;
    const tau = 0.35;
    if (mode === 'off') {
      this._fadeLoopsOff();
      return;
    }
    if (mode === 'lobby') {
      this._startLoop('lobby');
      this._lobbyGain.gain.setTargetAtTime(BGM_LEVEL.lobby, t, tau);
      this._matchGain.gain.setTargetAtTime(0, t, tau);
      window.setTimeout(() => this._stopLoop('match'), 500);
    } else {
      this._startLoop('match');
      this._matchGain.gain.setTargetAtTime(BGM_LEVEL.match, t, tau);
      this._lobbyGain.gain.setTargetAtTime(0, t, tau);
      window.setTimeout(() => this._stopLoop('lobby'), 500);
    }
  }

  /** @param {'lobby'|'match'|'off'} mode */
  setBgm(mode) {
    this.unlock();
    this._mode = mode;
    if (!this.ctx || this.muted) return;
    this._ensureBuffers()
      .then(() => {
        if (this._mode !== mode || this.muted) return;
        this._applyLoopGains(mode);
      })
      .catch(err => console.warn('[MoonAudio] BGM load failed', err));
  }

  /** Kept for game loop; BGM is buffer-driven (no per-frame synth). */
  tick(_dt) {}

  sfx(name) {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const hit = (freq, dur, type = 'square', g = 0.2, slide = 0) => {
      const o = this.ctx.createOscillator();
      const gn = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(g, t0 + 0.006);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn);
      gn.connect(this._master);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    };
    switch (name) {
      case 'push':
        hit(120, 0.06, 'square', 0.18, 80);
        hit(200, 0.1, 'triangle', 0.16, 140);
        break;
      case 'pushHit':
        hit(160, 0.08, 'square', 0.2, 100);
        hit(240, 0.12, 'triangle', 0.14);
        break;
      case 'fall':
        hit(440, 0.15, 'square', 0.18, -320);
        hit(220, 0.2, 'triangle', 0.1, -180);
        break;
      case 'countdown':
        hit(523, 0.09, 'square', 0.2);
        break;
      case 'start':
        hit(262, 0.07, 'square', 0.16);
        hit(330, 0.07, 'square', 0.18);
        hit(392, 0.12, 'square', 0.22);
        hit(523, 0.18, 'triangle', 0.2);
        break;
      case 'result':
        hit(392, 0.1, 'triangle', 0.14);
        hit(330, 0.1, 'triangle', 0.12);
        hit(262, 0.2, 'square', 0.16);
        break;
      case 'select':
        hit(660, 0.05, 'square', 0.1);
        break;
      default:
        break;
    }
  }
}

export function mountAudioUi(btn) {
  const aud = new MoonAudio();
  const paint = () => {
    btn.textContent = aud.muted ? '♪ OFF' : '♪ ON';
    btn.classList.toggle('off', aud.muted);
    btn.title = aud.muted ? 'BGM/効果音 OFF' : 'BGM/効果音 ON';
  };
  btn.onclick = e => {
    e.stopPropagation();
    aud.unlock();
    aud.toggleMute();
    if (!aud.muted) aud.sfx('select');
    paint();
  };
  paint();
  return aud;
}
