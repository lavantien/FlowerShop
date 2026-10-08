import { readFileSync, writeFileSync } from 'node:fs';
const snap = JSON.parse(readFileSync('playground/mutation-line-refs.json', 'utf8'));
const relocate = (refs) => {
  const byFile = new Map();
  for (const r of refs) {
    if (!byFile.has(r.file)) byFile.set(r.file, readFileSync(r.file, 'utf8').split(/\r?\n/));
  }
  const out = [];
  for (const r of refs) {
    const lines = byFile.get(r.file);
    let found = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === r.content) {
        if (found !== -1) { found = -2; break; }
        found = i + 1;
      }
    }
    out.push({ ...r, newLine: found });
  }
  return out;
};
const front = relocate(snap.front);
console.log(JSON.stringify(front.map(r => ({ file: r.file.split('/').pop(), old: r.line, new: r.newLine, kind: r.kind, ok: r.newLine > 0 })), null, 1));
writeFileSync('playground/mutation-line-refs-front-new.json', JSON.stringify(front, null, 2));
