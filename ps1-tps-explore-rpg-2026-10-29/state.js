// Event flags + inventory + save (localStorage)
export const SAVE_KEY = 'ps1-tps-explore-rpg-v1';
export const ITEMS = {
  rod:   { name: '錆びた鉄棒', icon: '🗡️', desc: '中庭の瓦礫に落ちていた鉄の棒。木箱くらいなら叩き壊せる。F / 左クリックで振る。' },
  torch: { name: '松明', icon: '🕯️', desc: '古い松明。火はついていない。焚き火で火をつけられそうだ。' },
  herb:  { name: '薬草', icon: '🌿', desc: '苦い葉。使うと体力を2回復する。' },
  memo:  { name: '古びたメモ', icon: '📜', desc: '先代の灯守りの覚え書き。使うと読める。' },
  key:   { name: '錆びた鍵', icon: '🗝️', desc: '北の鉄扉に合いそうな重い鍵。扉の前で使う。' },
};
export const QUEST = [
  ['spokeNpc', '灯守りの老人と話す'], ['gateOpen', '石板を踏んで北の門を開ける'], ['gotRod', '鉄棒を拾う'], ['crateBroken', '木箱の山を壊す'],
  ['gotTorch', '松明を見つける'], ['torchLit', '焚き火で松明に火をつける'], ['brazierLit', '倉庫の火鉢を灯す'], ['gotKey', '鍵を手に入れる'],
  ['bridgeUp', 'レバーで橋を上げる'], ['doorOpen', '鉄扉を開ける'], ['slimeDefeated', '祭壇の守りスライムを倒す'], ['cleared', '祭壇に触れる'],
];
export const FLAG_KEYS = ['spokeNpc', 'readMemo', 'memoShown', 'gateOpen', 'gotRod', 'crateBroken', 'gotTorch', 'torchLit', 'gotMemo', 'gotHerb', 'npcGaveHerb', 'brazierLit', 'gotKey', 'bridgeUp', 'doorOpen', 'slimeDefeated', 'cleared'];

const fresh = () => ({ flags: {}, inv: [], hp: 5, maxHp: 5, pos: null, yaw: 0, playMs: 0, deaths: 0 });
export const S = fresh();
const subs = new Set();
export const onChange = fn => subs.add(fn);
let flagHook = null; export const onFlag = fn => (flagHook = fn);
function emit() { for (const f of subs) f(S); save(); }

export function setFlag(k, v = true) { if (S.flags[k] === v) return; S.flags[k] = v; flagHook?.(k, v); emit(); }
export const flag = k => !!S.flags[k];
export const hasItem = id => S.inv.some(i => i.id === id && i.n > 0);
export function addItem(id, n = 1) { const it = S.inv.find(i => i.id === id); if (it) it.n += n; else S.inv.push({ id, n }); emit(); }
export function removeItem(id, n = 1) { const it = S.inv.find(i => i.id === id); if (!it) return; it.n -= n; if (it.n <= 0) S.inv.splice(S.inv.indexOf(it), 1); emit(); }
export function setHp(v) { S.hp = Math.max(0, Math.min(S.maxHp, v)); emit(); }

export function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
export function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
export function load() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!d) return false; Object.assign(S, fresh(), d); emit(); return true; } catch (e) { return false; }
}
export function reset() { Object.assign(S, fresh()); try { localStorage.removeItem(SAVE_KEY); } catch (e) { } emit(); }

export function objective(f = S.flags) {
  if (f.cleared) return '祭壇に灯がともった — クリア！';
  if (!f.spokeNpc) return '焚き火のそばの灯守りの老人に話しかけろ';
  if (!f.gateOpen) return '中庭の石板を踏んで、北の門を開けろ';
  if (!f.crateBroken) return f.gotRod ? '回廊の西、木箱の山を鉄棒で壊せ' : '木箱を壊す道具を中庭で探せ';
  if (!f.gotKey) {
    if (!f.gotTorch) return '東の部屋で松明を探せ';
    if (!f.torchLit) return '中庭の焚き火で松明に火をつけろ';
    if (!f.brazierLit) return '暗い倉庫の火鉢に火を灯せ';
    return '火鉢の光の下で鍵を探せ';
  }
  if (!f.bridgeUp) return '東の部屋のレバーを引いて橋を上げろ';
  if (!f.doorOpen) return '鍵を使って北の鉄扉を開けろ';
  if (!f.slimeDefeated) return '祭壇を守るスライムを倒せ（F / 左クリック）';
  return '奥の祭壇に触れろ';
}
export function hint(f = S.flags) {
  if (!f.gateOpen) return '門の南東、中庭に古い石板がある。上に乗ってみい。仕掛けが生きておれば門が上がる。';
  if (!f.crateBroken) return f.gotRod ? '回廊の西で木箱が倉庫を塞いでおる。その鉄棒で叩き壊せ。' : '中庭の西の瓦礫に鉄棒が落ちておったはずじゃ。';
  if (!f.gotKey) {
    if (!f.gotTorch) return '東の部屋に古い松明が残っておる。';
    if (!f.torchLit) return 'わしの焚き火で松明に火をつけていけ。';
    if (!f.brazierLit) return '倉庫は真っ暗じゃ。奥の火鉢に火を灯してみよ。';
    return '火鉢の明かりの下を探してみい。';
  }
  if (!f.bridgeUp) return '鉄扉の前は床が崩れて穴じゃ。東の部屋のレバーで橋が上がる。';
  if (!f.doorOpen) return '鍵を持って鉄扉の前で使え（E か持ち物から）。';
  if (!f.slimeDefeated) return '祭壇の前に古いスライムが居座っておる。鉄棒で3度も叩けば散るじゃろう。';
  return 'さあ、祭壇へ。灯をともしておくれ。';
}
