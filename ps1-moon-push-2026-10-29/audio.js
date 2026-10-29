/** Procedural 8-bit Web Audio for Moon Push (no asset files). */
const KEY = 'moonpush-audio-v1';

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
    this._bgmGain = null;
    this._master = null;
    this._mode = 'off';
    this._step = 0;
    this._nextNote = 0;
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
    this._bgmGain = this.ctx.createGain();
    this._bgmGain.gain.value = 0;
    this._bgmGain.connect(this._master);
  }

  _persist() {
    localStorage.setItem(KEY, JSON.stringify({ muted: this.muted, vol: this.vol }));
  }

  setMuted(m) {
    this.muted = m;
    if (this._master) this._master.gain.value = m ? 0 : this.vol;
    this._persist();
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

  /** @param {'lobby'|'match'|'off'} mode */
  setBgm(mode) {
    this.unlock();
    this._mode = mode;
    this._step = 0;
    this._nextNote = 0;
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (mode === 'off') {
      this._bgmGain.gain.setTargetAtTime(0, t, 0.25);
      return;
    }
    const target = mode === 'lobby' ? 0.14 : 0.22;
    this._bgmGain.gain.setTargetAtTime(target, t, 0.35);
  }

  tick(dt) {
    if (!this.ctx || this.muted || this._mode === 'off') return;
    this._nextNote -= dt;
    if (this._nextNote > 0) return;

    if (this._mode === 'lobby') this._tickLobbyBgm();
    else this._tickMatchBgm();
  }

  _tickLobbyBgm() {
    const beat = 60 / 78 / 2;
    this._nextNote = beat;
    const melody = [523, 659, 784, 880, 784, 659, 587, 523];
    const f = melody[this._step % melody.length];
    this._blip(f, 0.16, 'triangle', 0.055);
    if (this._step % 2 === 0) this._blip(f * 0.5, 0.22, 'sine', 0.028);
    if (this._step % 4 === 0) this._blip(196, 0.28, 'triangle', 0.04);
    this._step++;
  }

  _tickMatchBgm() {
    const beat = 60 / 128 / 2;
    this._nextNote = beat;
    const scale = [131, 165, 196, 220, 262, 220, 196, 165];
    const f = scale[this._step++ % scale.length];
    this._blip(f, 0.05, 'square', 0.1);
  }

  _blip(freq, dur, type = 'square', gain = 0.12) {
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this._bgmGain);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

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
