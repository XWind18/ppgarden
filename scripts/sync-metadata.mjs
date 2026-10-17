import { readFileSync, writeFileSync } from 'node:fs';

for (const name of ['ppgarden-task-layout', 'ppgarden-flower-trade']) {
  const script = readFileSync(new URL(`../${name}.user.js`, import.meta.url), 'utf8');
  const header = script.match(/^\/\/ ==UserScript==\r?\n[\s\S]+?^\/\/ ==\/UserScript==/m)?.[0];
  if (!header) throw new Error(`${name} 未找到油猴脚本元数据`);
  writeFileSync(new URL(`../${name}.meta.js`, import.meta.url), `${header}\n`);
  console.log(`已同步 ${name}.meta.js`);
}
