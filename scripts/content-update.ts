import { parseArgs } from 'node:util';
import { resolve, join, dirname, basename } from 'node:path';
import { cp, mkdir, readdir, readFile, stat, realpath, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ChannelCache, readJson, writeJson } from '../tools/youtube-sync/cache';
import { syncChannel } from '../tools/youtube-sync/channelScanner';
import { YtDlpProvider } from '../tools/youtube-sync/ytDlp';
import { generateCatalog, hash } from '../tools/catalog/generate';
import { publishCatalog, pruneRevisions } from '../tools/catalog/public';
import { validatePublicDirectory } from '../tools/catalog/validate-public';
import type { Creator, ContentCatalog } from '../src/content/model';
import type { ChannelContentProvider } from '../tools/youtube-sync/provider';
export async function inventoryHashes(directory: string) {
  const result=new Map<string,string>();
  async function walk(dir:string){for(const file of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const path=join(dir,file.name);if(file.isDirectory())await walk(path);else if(file.name.endsWith('.json'))result.set(path.slice(directory.length),hash(await readFile(path)));}}
  await walk(directory);return result;
}
export async function update(options:{root?:string;mode?:string;creator?:string;dryRun?:boolean;syncOnly?:boolean;provider?:ChannelContentProvider}={}) {
  const root=options.root??process.cwd(),policy=await readJson<any>(join(root,'content/update-policy.json'));
  const mode=options.mode??'auto';if(!['auto','incremental','full'].includes(mode))throw new Error('Mode must be auto, incremental or full.');
  const all=await readJson<Creator[]>(join(root,'content/creators.json'))??[];
  const creators=all.filter(c=>c.enabled&&(options.creator===undefined||options.creator==='all'||options.creator===c.id));
  if(!creators.length)throw new Error('No matching enabled configured creator.');
  const scratch=join(root,'.tmp',`update-${randomUUID()}`);await mkdir(scratch,{recursive:true});
  const durableRoot=join(root,'content/source/youtube'),cacheRoot=options.dryRun?join(scratch,'source'):durableRoot;
  if(options.dryRun)await cp(durableRoot,cacheRoot,{recursive:true});
  const before=await inventoryHashes(cacheRoot),startedAt=new Date().toISOString(),deadline=Date.now()+policy.runBudgetMs;
  let successful=true;const states=[];
  const provider=options.provider??new YtDlpProvider(undefined,policy.discoveryTimeoutMs,policy.metadataTimeoutMs);
  for(const creator of creators){
    const cache=new ChannelCache(cacheRoot,creator.channelId!);const previous=await cache.readState();
    const full=mode==='full'||mode==='auto'&&(!previous?.lastFullReconcileAt||Date.now()-Date.parse(previous.lastFullReconcileAt)>=policy.fullEveryDays*86400000);
    try{
      const state=await syncChannel(provider,cache,creator,{full,concurrency:policy.metadataWorkers,requestDelayMs:policy.requestDelayMs,enrichmentLimit:policy.enrichmentLimit,knownStreak:policy.knownStreak,recentRefreshCount:policy.recentRefreshCount,recentFreshnessHours:policy.recentFreshnessHours,refreshStale:true,staleDays:policy.staleDays,minimumFullInventoryRatio:policy.minimumFullInventoryRatio,deadline});
      const issues=state.errors.map(error=>({context:error.context,message:error.message.slice(0,500)}));
      states.push({creator:creator.id,outcome:state.outcome,full,...(issues.length?{issues}:{})});
      if(state.outcome!=='successful')successful=false;
    }catch(error){successful=false;states.push({creator:creator.id,outcome:'failed',full,error:(error instanceof Error?error.message:String(error)).slice(0,500)});}
  }
  const after=await inventoryHashes(cacheRoot);let changedRecords=0;for(const [path,digest]of after)if(before.get(path)!==digest&&/videos[\\/]/.test(path))changedRecords++;
  let publicChanged=false,candidate:ContentCatalog|undefined,manifest:any;
  let publicationError:string|undefined;
  const previousStatus=await readJson<any>(join(root,'public/data/status.json'))??{};
  if(successful&&!options.syncOnly)try{
    candidate=await generateCatalog({cacheRoot,creatorsPath:join(root,'content/creators.json'),overridesPath:join(root,'content/overrides.json')});
    const previous=await readJson<ContentCatalog>(join(root,'content/catalog.json'));
    if(previous){const ids=new Set(candidate.videos.map(v=>v.youtubeVideoId));if(previous.videos.some(v=>!ids.has(v.youtubeVideoId)))throw new Error('Candidate lost retained IDs. Public catalog unchanged.');}
    manifest=await publishCatalog(candidate,join(scratch,'data'));await validatePublicDirectory(join(scratch,'data'));
    publicChanged=candidate.revision!==previous?.revision;
    if(!options.dryRun&&publicChanged){await cp(join(scratch,'data',candidate.revision),join(root,'public/data',candidate.revision),{recursive:true});await writeJson(join(root,'content/catalog.json'),candidate);await writeJson(join(root,'public/data/manifest.json'),manifest);await pruneRevisions(join(root,'public/data'),[candidate.revision,previous?.revision].filter((v):v is string=>!!v));}
  }catch(error){successful=false;publicationError=error instanceof Error?error.message:String(error);publicChanged=false;candidate=undefined;}
  const bytes=await Promise.all([...after.keys()].map(p=>stat(join(cacheRoot,p.replace(/^[\\/]/,''))).then(s=>s.size)));
  const summary={outcome:successful?'successful':'partial',startedAt,at:new Date().toISOString(),dryRun:!!options.dryRun,publicChanged,changedRecords,cacheBytes:bytes.reduce((a,b)=>a+b,0),states,count:candidate?.videos.length,revision:candidate?.revision,...(publicationError?{publicationError}:{})};
  if(!options.dryRun){
    const status={...previousStatus,schema:1,catalogRevision:candidate?.revision??previousStatus.catalogRevision,catalogGeneratedAt:publicChanged?summary.at:previousStatus.catalogGeneratedAt,lastSuccessfulSourceCheck:successful?summary.at:previousStatus.lastSuccessfulSourceCheck,lastAttempt:{at:summary.at,outcome:summary.outcome}};
    await writeJson(join(root,'public/data/status.json'),status);
  }
  await writeJson(join(root,'.tmp/update-result.json'),summary);
  console.log(JSON.stringify(summary,null,2));
  const scratchPath=await realpath(scratch),scratchParent=await realpath(join(root,'.tmp'));
  if(dirname(scratchPath)!==scratchParent||!/^update-[a-f0-9-]+$/.test(basename(scratchPath)))throw new Error('Refusing scratch cleanup outside the intended update directory.');
  await rm(scratchPath,{recursive:true,force:true});return summary;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/content-update.ts')){
  const {values}=parseArgs({options:{mode:{type:'string'},creator:{type:'string'},'dry-run':{type:'boolean'},'sync-only':{type:'boolean'}}});
  update({mode:values.mode,creator:values.creator,dryRun:values['dry-run'],syncOnly:values['sync-only']}).then(r=>{if(r.outcome!=='successful')process.exitCode=2;}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
