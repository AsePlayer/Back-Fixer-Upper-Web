import { readdir,readFile,stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { join } from 'node:path';
const root='dist';const names=await readdir(root);assert(!names.includes('content')&&!names.includes('tools')&&!names.includes('src'));
const html=await readFile(join(root,'index.html'),'utf8');assert(!/localhost|cross-origin-isolat|<script[^>]*src="\//.test(html));
const assets=await readdir(join(root,'assets'));let js=0;for(const file of assets.filter(f=>f.endsWith('.js'))){const code=await readFile(join(root,'assets',file),'utf8');assert(!/expo-sqlite|react-native|yt-dlp|node:fs/.test(code));js+=(await stat(join(root,'assets',file))).size;}
assert(js<200000,'Initial JavaScript must remain small');console.log(`Static build verified: ${js.toLocaleString()} JavaScript bytes; relative paths; source cache/tooling excluded.`);
