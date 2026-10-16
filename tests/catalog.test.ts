import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, cp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { generateCatalog, hash } from '../tools/catalog/generate';
import { publishCatalog } from '../tools/catalog/public';
import { validatePublicDirectory } from '../tools/catalog/validate-public';
import { regionNames } from '../src/domain/taxonomy.js';
import { defaultFilters,filterVideos } from '../src/domain/filtering.js';
import { readJson, writeJson, ChannelCache } from '../tools/youtube-sync/cache';
import { update,inventoryHashes } from '../scripts/content-update';
import { ProviderRateLimited } from '../tools/youtube-sync/provider';
import { applyOverride } from '../src/content/classification/classify';
import { allowedPath } from '../scripts/commit-content.mjs';
async function temporary(fn:(path:string)=>Promise<void>){const dir=await mkdtemp(join(tmpdir(),'bfu-test-'));try{await fn(dir);}finally{const path=await realpath(dir);assert.equal(dirname(path),await realpath(tmpdir()));assert.match(basename(path),/^bfu-test-/);await rm(path,{recursive:true,force:true});}}
test('full source snapshot parity, every region and Other videos; compact index retains original search semantics',async()=>{
  const baseline=await readJson<any>('content/baseline.json'),catalog=await readJson<any>('content/catalog.json');
  assert(catalog.videos.length>=baseline.total);
  const catalogIds=new Set(catalog.videos.map(v=>v.youtubeVideoId));for(const id of baseline.ids??[])assert(catalogIds.has(id));
  const manifest=await validatePublicDirectory('public/data'),index=await readJson<any[]>(join('public/data',manifest.index.path));
  assert.equal(manifest.count,catalog.videos.length);assert.equal(manifest.unclassified,catalog.videos.filter(v=>!v.derived.bodyRegions.length).length);
  const full=[];for(const chunk of manifest.chunks)full.push(...await readJson<any[]>(join('public/data',chunk.path))!);
  assert.equal(hash(JSON.stringify(full)),hash(JSON.stringify(catalog.videos)));assert.equal(new Set(index!.map(v=>v.id)).size,catalog.videos.length);
  for(const region of Object.keys(regionNames)){const results=filterVideos(index!,{...defaultFilters(),area:region});assert.equal(results.length,catalog.videos.filter(v=>v.derived.bodyRegions.includes(region)).length);}
  const chosen=index!.find(v=>v.externalId==='t1aA2JEaRpw')!;assert.equal(filterVideos(index!,{...defaultFilters(),query:chosen.url})[0].id,chosen.id);
  assert.ok(filterVideos(index!,{...defaultFilters(),query:'lumbar'}).length);assert.equal(filterVideos(index!,{...defaultFilters(),area:'unclassified'}).length,manifest.unclassified);
  const original=await readJson<any>('.migration/source/src/content/generated/youtubeCatalog.json');if(original&&catalog.revision===baseline.sourceRevision)assert.equal(hash(JSON.stringify(catalog)),hash(JSON.stringify(original)));
});
test('offline reclassification is byte deterministic, makes no network calls and never mutates durable source',async()=>{
  const before=await inventoryHashes('content/source/youtube'),originalFetch=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('Network forbidden in offline classification');};
  try{const first=await generateCatalog(),second=await generateCatalog();assert.equal(hash(JSON.stringify(first)),hash(JSON.stringify(second)));assert.deepEqual(await inventoryHashes('content/source/youtube'),before);
    assert.deepEqual(applyOverride(first.videos[0].automatic,{bodyRegions:['wrists'],reason:'Synthetic reviewed override'}).bodyRegions,['wrists']);
  }finally{globalThis.fetch=originalFetch;}
});
test('intersecting duration filters preserve unknowns and exact inclusive boundaries',()=>{
  const record=(id:string,duration?:number)=>({id,externalId:'abcdefghijk',title:id,creator:'Fixture',regions:['neck'],intents:[],topics:[],kind:'video',creatorId:'fixture',duration,search:'neck'});
  const items=[record('unknown'),record('299',299),record('300',300),record('600',600),record('601',601)];
  assert.deepEqual(filterVideos(items,{...defaultFilters(),duration:'5_to_10'}).map(v=>v.id),['300','600']);assert.equal(filterVideos(items,{...defaultFilters(),duration:'under_5'}).length,1);assert.equal(filterVideos(items,{...defaultFilters(),sort:'shortest'}).at(-1)?.id,'unknown');
});
test('blocked provider and dry-run keep last good public catalog; real progress is preserved without advancing success',async()=>temporary(async root=>{
  await cp('content',join(root,'content'),{recursive:true});await cp('public/data',join(root,'public/data'),{recursive:true});
  const provider:any={version:async()=>'fixture',async *enumerateChannel(){throw new ProviderRateLimited('HTTP 429 fixture');},fetchVideoMetadata:async()=>{throw new Error('Must not fetch');}};
  const before=await inventoryHashes(join(root,'public/data')),source=await inventoryHashes(join(root,'content/source/youtube'));
  const initial=await new ChannelCache(join(root,'content/source/youtube'),'UC2lvPVVm0Mv53QK7vdnC-rw').readState();
  const dry=await update({root,provider,dryRun:true});assert.equal(dry.outcome,'partial');assert.deepEqual(await inventoryHashes(join(root,'content/source/youtube')),source);assert.deepEqual(await inventoryHashes(join(root,'public/data')),before);
  const result=await update({root,provider});assert.equal(result.outcome,'partial');assert.equal(result.publicChanged,false);
  const after=await inventoryHashes(join(root,'public/data'));for(const [p,digest]of before)if(!p.endsWith('status.json'))assert.equal(after.get(p),digest);
  const state=await new ChannelCache(join(root,'content/source/youtube'),'UC2lvPVVm0Mv53QK7vdnC-rw').readState();assert.equal(state?.lastSyncCompletedAt,initial?.lastSyncCompletedAt);assert.equal(state?.lastFullReconcileAt,initial?.lastFullReconcileAt);
}));
test('candidate integrity failure is rejected and identical publication makes no catalog churn',async()=>temporary(async dir=>{
  const c=await readJson<any>('content/catalog.json');await publishCatalog(c,dir);const before=await inventoryHashes(dir);await publishCatalog(c,dir);assert.deepEqual(await inventoryHashes(dir),before);
  const m=await readJson<any>(join(dir,'manifest.json'));await writeJson(join(dir,m.index.path),[]);await assert.rejects(validatePublicDirectory(dir),/Integrity/);
}));
test('automation allows only public source/cache outputs and deploys resulting commit explicitly',async()=>{
  assert.equal(allowedPath('content/source/youtube/UC2lvPVVm0Mv53QK7vdnC-rw/videos/t1aA2JEaRpw.json'),true);
  for(const path of ['.github/workflows/evil.yml','.env','personal.json','content/source/youtube/../private.json','public/data/evil.js'])assert.equal(allowedPath(path),false);
  const workflow=await readFile('.github/workflows/update.yml','utf8');assert.match(workflow,/needs.writer.outputs.commit/);assert.match(workflow,/group: content-writer/);assert.match(workflow,/cancel-in-progress: false/);assert.doesNotMatch(workflow,/git add \./);
});
