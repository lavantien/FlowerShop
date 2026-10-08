import { readFileSync, writeFileSync } from 'node:fs';
const grab = (mapPath) => {
  const map = JSON.parse(readFileSync(mapPath, 'utf8'));
  const refs = [];
  for (const target of map.targets) {
    for (const e of target.explicit ?? []) {
      refs.push({ file: target.file, line: e.line, from: e.from, kind: 'explicit' });
    }
    for (const r of target.lineOpExcludes ?? []) {
      refs.push({ file: target.file, line: r.line, ops: r.ops, kind: 'lineOpExcludes' });
    }
  }
  return refs;
};
const back = grab('scripts/tools/mutation-map.json');
const front = grab('scripts/tools/mutation-front-map.json');
const contentAt = (p, line) => readFileSync(p, 'utf8').split(/\r?\n/)[line - 1];
for (const refs of [back, front]) {
  for (const r of refs) {
    r.content = contentAt(r.file, r.line);
  }
}
writeFileSync('playground/mutation-line-refs.json', JSON.stringify({ back, front }, null, 2));
console.log(`snapshotted ${back.length} backend + ${front.length} frontend positional refs`);
