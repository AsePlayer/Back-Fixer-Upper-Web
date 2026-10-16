import { readJson, writeJson } from '../youtube-sync/cache';
import { validateCatalog } from '../youtube-sync/validate';
import { generateCatalog } from './generate';
import { publishCatalog, pruneRevisions } from './public';
import type { ContentCatalog } from '../../src/content/model';
const command = process.argv[2];
if (command === 'classify') {
  const candidate = await generateCatalog();
  const previousManifest=await readJson<any>('public/data/manifest.json');
  await publishCatalog(candidate); await writeJson('content/catalog.json', candidate);
  if(previousManifest?.revision!==candidate.revision)await pruneRevisions('public/data',[candidate.revision,previousManifest?.revision].filter(Boolean));
  const status=await readJson<any>('public/data/status.json')??{};
  if(status.catalogRevision!==candidate.revision)await writeJson('public/data/status.json',{...status,schema:1,catalogRevision:candidate.revision,catalogGeneratedAt:new Date().toISOString(),lastSuccessfulSourceCheck:status.lastSuccessfulSourceCheck??null,lastAttempt:status.lastAttempt??null});
  console.log(`Offline classification: ${candidate.videos.length} records, ${candidate.revision}.`);
} else if (command === 'validate') {
  const catalog = await readJson<ContentCatalog>('content/catalog.json');
  if (!catalog) throw new Error('Catalog missing.');
  console.log(validateCatalog(catalog));
  const { validatePublicDirectory } = await import('./validate-public');
  await validatePublicDirectory('public/data');
} else throw new Error('Use classify or validate.');
