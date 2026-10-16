import { readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,join } from 'node:path';
const root=resolve('dist'),files=['index.html','favicon.svg'];
for(const f of await readdir(join(root,'assets')))files.push(`assets/${f}`);
const hash=createHash('sha256');for(const f of files)hash.update(await readFile(join(root,f)));
const template=await readFile('scripts/service-worker.js','utf8');
await writeFile(join(root,'sw.js'),template.replace('__SHELL_VERSION__',hash.digest('hex').slice(0,16)).replace('__SHELL_FILES__',JSON.stringify(files)));
await writeFile(join(root,'.nojekyll'),'');
