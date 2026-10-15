import { readFileSync, writeFileSync } from 'node:fs';

const script = readFileSync(new URL('../ppgarden-task-layout.user.js', import.meta.url), 'utf8');
const header = script.match(/^\/\/ ==UserScript==\r?\n[\s\S]+?^\/\/ ==\/UserScript==/m)?.[0];
if (!header) throw new Error('未找到油猴脚本元数据');
writeFileSync(new URL('../ppgarden-task-layout.meta.js', import.meta.url), `${header}\n`);
console.log('已同步 ppgarden-task-layout.meta.js');
