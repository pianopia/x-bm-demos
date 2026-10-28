// Minimal dialogue runner: lines = [{who, text, act?, choices?:[{label, then:()=>lines|null}]}]
const $ = id => document.getElementById(id);
let queue = [], cur = null, typing = 0, full = '', onClose = null;
export const isOpen = () => !!cur;
export function say(lines, done) {
  queue = lines.slice(); onClose = done || null; $('dlg').classList.add('show'); next();
}
function show(l) {
  cur = l; l.act?.(); $('dlgWho').textContent = l.who || ''; full = l.text; typing = 0; $('dlgText').textContent = '';
  $('dlgCh').innerHTML = ''; $('dlgNext').style.visibility = 'hidden';
}
export function next() {
  if (cur && typing < full.length) { typing = full.length; $('dlgText').textContent = full; finishLine(); return; }
  if (cur?.choices) return; // must pick
  const l = queue.shift();
  if (!l) return close();
  show(l);
}
function finishLine() {
  if (cur.choices) {
    const box = $('dlgCh'); box.innerHTML = '';
    cur.choices.forEach((c, i) => { const b = document.createElement('button'); b.textContent = `${i + 1}. ${c.label}`; b.onclick = e => { e.stopPropagation(); choose(i); }; box.append(b); });
  } else $('dlgNext').style.visibility = 'visible';
}
export function choose(i) {
  if (!cur?.choices || typing < full.length) return; const c = cur.choices[i]; if (!c) return;
  const more = c.then?.(); cur = null; if (more && more.length) queue = more.concat(queue); next();
}
export function close() { cur = null; queue = []; $('dlg').classList.remove('show'); const f = onClose; onClose = null; f?.(); }
export function tick(dt) {
  if (!cur || typing >= full.length) return;
  typing = Math.min(full.length, typing + dt * 45); $('dlgText').textContent = full.slice(0, typing | 0);
  if (typing >= full.length) finishLine();
}
