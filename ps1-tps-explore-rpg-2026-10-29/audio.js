// Game audio glue: BGM state machine + SFX + mute/volume UI (engine: ../audio/chip.js)
import { Chip } from '../audio/chip.js';
import { SONGS } from '../audio/songs.js';
import { SFX } from '../audio/sfx.js';
const KEY = 'ps1-tps-explore-rpg-audio-v1';
const pref = (() => { try { return { muted: false, vol: .6, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { muted: false, vol: .6 }; } })();
export const chip = new Chip(); chip.muted = pref.muted; chip.vol = pref.vol;
const persist = () => localStorage.setItem(KEY, JSON.stringify({ muted: chip.muted, vol: chip.vol }));
let stamp = 0, cur = null, want = 'ruins', level = 1, hold = 0, battleT = 0, tok = 0;

export function sfx(name) { stamp++; if (!chip.ctx || chip.muted) return; chip.sfx(SFX[name]); }
export const mark = () => stamp; export const playedSince = m => stamp !== m;
export function unlock() { chip.unlock(); }

function switchTo(id) {
  if (cur === id) return; const my = ++tok, had = cur; cur = id;
  if (!chip.ctx) return;
  if (!id) return chip.fadeTo(0, .5);
  if (had) { chip.fadeTo(0, .4); setTimeout(() => { if (tok === my) chip.play(SONGS[id], { level }); }, 420); }
  else chip.play(SONGS[id], { level });
}
/** Called every frame. s = { mode, cleared, battle, ducked } */
export function update(dt, s) {
  if (!chip.ready) return;
  if (hold > 0) { hold -= dt; if (hold <= 0) cur = null; else return; }
  battleT = s.battle ? 3 : Math.max(0, battleT - dt);
  want = s.cleared ? 'dawn' : battleT > 0 ? 'guardian' : 'ruins';
  if (cur !== want) switchTo(want);
  const L = s.ducked ? .45 : s.mode === 'title' ? .7 : 1;
  if (L !== level && cur === want) { level = L; chip.fadeTo(L, .3); }
}
/** Fanfare: silence BGM, play sting, then resume (dawn). */
export function sting() { sfx('clear'); tok++; cur = '__sting'; chip.fadeTo(0, .2); hold = 3.4; }

export function mountUI(btn, slider) {
  const paint = () => { btn.textContent = chip.muted ? '♪ OFF' : '♪ ON'; btn.classList.toggle('off', chip.muted); slider.value = Math.round(chip.vol * 100); };
  btn.onclick = e => { e.stopPropagation(); chip.unlock(); chip.setMuted(!chip.muted); persist(); paint(); if (!chip.muted) sfx('select'); };
  slider.oninput = () => { chip.setVolume(slider.value / 100); if (chip.muted && slider.value > 0) chip.setMuted(false); persist(); paint(); };
  paint();
  const go = () => { chip.unlock(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, go, { capture: true, passive: true });
}
