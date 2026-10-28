// Seed songs (tracker text → Song JSON). Used by the PS1 game and opened as examples in chipdaw-8bit.
import { songFromText } from './chip.js';
const arpBar = (a, b, c) => `${a} - ${b} - ${c} - ${b} - ${a} - ${b} - ${c} - ${b} -`;
const hold = n => n + ' -'.repeat(15);
const rest = '. '.repeat(16);
const CH = [{ name: 'Pulse 1', inst: 0 }, { name: 'Pulse 2', inst: 1 }, { name: 'Triangle', inst: 2 }, { name: 'Noise', inst: 3 }];
const DRUMS = [
  { name: 'Wind', wave: 'noise', noiseMode: 'long', vol: .14, a: .35, d: .6, s: .5, r: .7 },
  { name: 'Hat', wave: 'noise', noiseMode: 'short', vol: .16, a: .001, d: .04, s: 0, r: .02 },
  { name: 'Kick', wave: 'noise', noiseMode: 'long', vol: .55, a: .001, d: .07, s: 0, r: .02, slide: 3 },
  { name: 'Snare', wave: 'noise', noiseMode: 'long', vol: .42, a: .001, d: .14, s: 0, r: .03 },
];

export const RUINS = songFromText({
  title: '廃墟の灯火 — 探索', bpm: 76, rows: 32, echo: .35, meta: { root: 57, scale: 'minor' },
  instruments: [
    { name: 'Lead 25%', wave: 'pulse', duty: .25, vol: .42, a: .01, d: .35, s: .55, r: .18, vib: 16, vibRate: 5.5, vibDelay: .22 },
    { name: 'Pad 12.5%', wave: 'pulse', duty: .125, vol: .2, a: .004, d: .18, s: .3, r: .08 },
    { name: 'Bass Tri', wave: 'tri', vol: .75, a: .002, d: .1, s: .9, r: .04 },
    ...DRUMS,
  ],
  channels: CH,
  patterns: [
    { name: '霧 intro', lines: [rest + rest, arpBar('A3', 'C4', 'E4') + ' ' + arpBar('F3', 'A3', 'C4'), hold('A2') + ' ' + hold('F2'), 'N9:7 ' + '- '.repeat(15) + rest] },
    { name: '灯 A', lines: ['E5 - - - - - D5 - C5 - - - B4 - A4 - C5 - - - - - - - A4 - - - . . . .', arpBar('A3', 'C4', 'E4') + ' ' + arpBar('F3', 'A3', 'C4'), 'A2 - - - - - - - E2 - - - - - - - F2 - - - - - - - C3 - - - - - - -', rest + '. . . . . . . . . . . . N1:6@4 . . .'] },
    { name: '回廊 B', lines: ['F5 - - - E5 - D5 - - - - - A4 - - - G#4 - - - - - B4 - - - - - E5 - - -', arpBar('D4', 'F4', 'A4') + ' ' + arpBar('E4', 'G#4', 'B4'), hold('D3') + ' ' + hold('E2'), 'N9:6 ' + '- '.repeat(15) + '. . . . . . . . N1:5@4 . . . N1:6@4 . . .'] },
    { name: '聖堂 C', lines: ['A5 - - - - - - - G5 - F5 - E5 - - - D5 - - - C5 - B4 - G#4 - - - - - - -', arpBar('F4', 'A4', 'C5') + ' ' + arpBar('E4', 'G#4', 'B4'), hold('F2') + ' E2 - - - - - - - E3 - - - E2 - - -', rest + rest] },
  ],
  order: [0, 1, 2, 0, 1, 3],
});

export const DAWN = songFromText({
  title: '灯火、再び — 夜明け', bpm: 92, rows: 32, echo: .28, meta: { root: 60, scale: 'major' },
  instruments: [
    { name: 'Lead 50%', wave: 'pulse', duty: .5, vol: .38, a: .006, d: .25, s: .6, r: .15, vib: 12, vibRate: 6, vibDelay: .18 },
    { name: 'Arp 25%', wave: 'pulse', duty: .25, vol: .2, a: .003, d: .12, s: .35, r: .06 },
    { name: 'Bass Tri', wave: 'tri', vol: .75, a: .002, d: .1, s: .9, r: .04 },
    ...DRUMS,
  ],
  channels: CH,
  patterns: [
    { name: '朝 A', lines: ['A4 - - - C5 - - - F5 - - - E5 - D5 - E5 - - - - - - - G4 - - - C5 - - -', arpBar('F4', 'A4', 'C5') + ' ' + arpBar('E4', 'G4', 'C5'), 'F2 - - - C3 - - - F2 - - - C3 - - - C3 - - - G2 - - - C3 - - - G2 - - -', '. . . . N1@4 . . . . . . . N1@4 . . . . . . . N1@4 . . . . . . . N1@4 . . .'] },
    { name: '朝 B', lines: ['D5 - - - B4 - G4 - D5 - E5 - F5 - - - E5 - - - - - - - - - - - . . . .', arpBar('G3', 'B3', 'D4') + ' ' + arpBar('A3', 'C4', 'E4'), hold('G2') + ' ' + hold('A2'), '. . . . N1@4 . . . . . . . N1@4 . . . . . . . N1@4 . . . . . . . N1@4 . . .'] },
    { name: '光 C', lines: ['C6 - - - A5 - - - F5 - - - A5 - - - G5 - - - - - - - - - - - - - - -', arpBar('F4', 'A4', 'C5') + ' ' + arpBar('G4', 'B4', 'D5'), hold('F2') + ' G2 - - - - - - - G2 - - - B2 - - -', 'N8:6@3 ' + '- '.repeat(15) + '. . . . N1@4 . . . N1@4 . N1@4 . N1@4 . . .'] },
  ],
  order: [0, 1, 0, 2],
});

const GDR = 'NC@5 . . . N6@6 . . . NC@5 . NC@5 . N6@6 . N1@4 .';
export const GUARDIAN = songFromText({
  title: '祭壇の守り — 戦闘', bpm: 138, rows: 32, echo: .12, meta: { root: 57, scale: 'harm' },
  instruments: [
    { name: 'Lead 50%', wave: 'pulse', duty: .5, vol: .36, a: .003, d: .12, s: .55, r: .06, vib: 10, vibRate: 7, vibDelay: .12 },
    { name: 'Stab 25%', wave: 'pulse', duty: .25, vol: .22, a: .002, d: .09, s: .2, r: .04 },
    { name: 'Bass Tri', wave: 'tri', vol: .8, a: .002, d: .06, s: .8, r: .02 },
    ...DRUMS,
  ],
  channels: CH,
  patterns: [
    { name: '気配', lines: [rest + rest, 'A4~037 - . . A4~037 - . . A4~037 - . . G4~047 - . . F4~047 - . . F4~047 - . . E4~047 - . . E4~047 - . .', 'A2 - A3 - A2 - A3 - A2 - A3 - G2 - G3 - F2 - F3 - F2 - F3 - E2 - E3 - E2 - G#2 -', GDR + ' ' + GDR] },
    { name: '守り A', lines: ['E5 - - - A5 - - - G5 - F5 - E5 - D5 - C5 - - - D5 - E5 - B4 - - - G#4 - - -', 'A4~037 - . . A4~037 - . . A4~037 - . . G4~047 - . . F4~047 - . . F4~047 - . . E4~047 - . . E4~047 - . .', 'A2 - A3 - A2 - A3 - A2 - A3 - G2 - G3 - F2 - F3 - F2 - F3 - E2 - E3 - E2 - G#2 -', GDR + ' ' + GDR] },
    { name: '守り B', lines: ['A5 - - - C6 - B5 - A5 - G#5 - - - E5 - F5 - - - E5 - D5 - E5 - - - - - - -', 'A4~037 - . . A4~037 - . . A4~037 - . . G4~047 - . . F4~047 - . . F4~047 - . . E4~047 - . . E4~047 - . .', 'A2 - A3 - A2 - A3 - A2 - A3 - G2 - G3 - F2 - F3 - F2 - F3 - E2 - E3 - E2 - G#2 -', GDR + ' NC@5 . NC@5 . N6@6 . NC@5 . N6@6 . N6@6 . N3@6 . N2@6 .'] },
  ],
  order: [0, 1, 0, 2],
});

export const SONGS = { ruins: RUINS, dawn: DAWN, guardian: GUARDIAN };
