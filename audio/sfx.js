// Procedural SFX presets (params for Chip.sfx / scheduleSfx). An array = layered/sequenced one-shots (`at` = offset s).
const hz = n => 440 * 2 ** ((n - 69) / 12);
export const SFX = {
  interact: { wave: 'pulse', duty: .25, f0: 880, f1: 880, dur: .06, vol: .28 },
  select:   { wave: 'pulse', duty: .5, f0: 660, f1: 990, dur: .05, vol: .22, steps: 2 },
  deny:     { wave: 'pulse', duty: .5, f0: 196, f1: 180, dur: .08, vol: .26, repeat: 2, gap: .03 },
  start:    [{ wave: 'pulse', duty: .5, f0: hz(69), dur: .5, vol: .32, arp: [0, 3, 7, 12], arpRate: 18 }],
  pickup:   { wave: 'pulse', duty: .5, f0: hz(76), dur: .3, vol: .36, arp: [0, 4, 7, 12], arpRate: 22 },
  heal:     { wave: 'tri', f0: hz(72), dur: .45, vol: .5, arp: [0, 4, 7, 12, 16], arpRate: 16 },
  torch:    { wave: 'pulse', duty: .125, f0: 160, f1: 900, dur: .5, a: .06, vol: .45, noise: .85 },
  brazier:  [{ wave: 'pulse', duty: .125, f0: 120, f1: 700, dur: .7, a: .08, vol: .5, noise: .9 }, { at: .35, wave: 'pulse', duty: .25, f0: hz(81), dur: .5, vol: .25, arp: [0, 3, 7, 12], arpRate: 14 }],
  crate:    [{ wave: 'pulse', f0: 220, f1: 50, dur: .3, vol: .6, noise: 1, repeat: 2, gap: .02 }, { at: .02, wave: 'pulse', duty: .5, f0: 140, f1: 60, dur: .15, vol: .35 }],
  door:     [{ wave: 'pulse', duty: .125, f0: 150, f1: 90, dur: .8, vol: .32, steps: 10, vib: 60, vibRate: 18 }, { at: .65, wave: 'pulse', f0: 90, f1: 40, dur: .3, vol: .55, noise: 1 }],
  gate:     [{ wave: 'pulse', f0: 70, f1: 130, dur: 1.1, a: .1, vol: .5, noise: .8, steps: 14 }, { at: 1.0, wave: 'pulse', f0: 100, f1: 40, dur: .25, vol: .55, noise: 1 }],
  lever:    [{ wave: 'pulse', duty: .5, f0: 1400, f1: 1400, dur: .04, vol: .3 }, { at: .08, wave: 'pulse', f0: 60, f1: 95, dur: 1.0, a: .1, vol: .5, noise: .85, steps: 12 }],
  plate:    [{ wave: 'pulse', duty: .5, f0: 300, f1: 300, dur: .04, vol: .3 }, { at: .05, wave: 'pulse', f0: 120, f1: 60, dur: .2, vol: .5, noise: 1 }],
  swing:    { wave: 'noise-short', f0: 2400, f1: 500, dur: .12, vol: .28, noise: 1 },
  slimeHit: [{ wave: 'pulse', duty: .5, f0: 420, f1: 140, dur: .12, vol: .42 }, { wave: 'pulse', f0: 300, f1: 100, dur: .1, vol: .3, noise: 1 }],
  slimeDie: { wave: 'pulse', duty: .25, f0: 700, f1: 70, dur: .6, vol: .45, steps: 12, vib: 40, vibRate: 20 },
  hurt:     { wave: 'pulse', duty: .5, f0: 320, f1: 90, dur: .25, vol: .48, noise: .35 },
  fall:     { wave: 'tri', f0: 900, f1: 90, dur: .75, vol: .55 },
  dlgOpen:  { wave: 'pulse', duty: .25, f0: hz(72), dur: .09, vol: .2, arp: [0, 7], arpRate: 30 },
  dlgNext:  { wave: 'pulse', duty: .125, f0: hz(84), f1: hz(84), dur: .035, vol: .14 },
  choice:   { wave: 'pulse', duty: .25, f0: hz(79), f1: hz(79), dur: .05, vol: .22, repeat: 2, gap: .015 },
  invOpen:  { wave: 'pulse', duty: .5, f0: hz(69), dur: .12, vol: .22, arp: [0, 5, 12], arpRate: 30 },
  invClose: { wave: 'pulse', duty: .5, f0: hz(81), dur: .1, vol: .2, arp: [0, -5, -12], arpRate: 30 },
  clear: [
    { at: 0, wave: 'pulse', duty: .5, f0: hz(69), f1: hz(69), dur: .14, vol: .38 }, { at: .15, wave: 'pulse', duty: .5, f0: hz(72), f1: hz(72), dur: .14, vol: .38 },
    { at: .3, wave: 'pulse', duty: .5, f0: hz(76), f1: hz(76), dur: .14, vol: .38 }, { at: .45, wave: 'pulse', duty: .5, f0: hz(81), f1: hz(81), dur: .3, vol: .4 },
    { at: .8, wave: 'pulse', duty: .25, f0: hz(81), dur: 1.4, vol: .4, arp: [0, 4, 7, 12], arpRate: 15, vib: 15 },
    { at: .8, wave: 'tri', f0: hz(45), f1: hz(45), dur: 1.4, vol: .6 },
  ],
};
export const SFX_LABELS = { interact: '調べる', select: '決定', deny: 'ブブー', start: 'スタート', pickup: '拾う', heal: '回復', torch: '松明', brazier: '火鉢', crate: '木箱破壊', door: '鉄扉', gate: '門', lever: 'レバー', plate: '石板', swing: '素振り', slimeHit: 'ヒット', slimeDie: '撃破', hurt: 'ダメージ', fall: '落下', dlgOpen: '会話', dlgNext: '送り', choice: '選択', invOpen: '持ち物開', invClose: '持ち物閉', clear: 'クリア' };
