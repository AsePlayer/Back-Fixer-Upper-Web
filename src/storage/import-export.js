import { PERSONAL_STORES, emptyPersonal } from './database.js';
import { youtubeId, youtubeUrl, videoKey } from '../domain/urls.js';
import { legacyRegion, regionNames } from '../domain/taxonomy.js';
import { searchableText } from '../domain/filtering.js';
const requireValue = (condition,message) => { if(!condition)throw new Error(`Import rejected: ${message}. Existing records are unchanged.`); };
const date = value => typeof value==='string' && Number.isFinite(Date.parse(value));
const key = value => typeof value==='string' && /^youtube:[\w-]{11}$/.test(value);
const id = value => typeof value==='string' && value.length>0 && value.length<300;
const list = (value,name) => {requireValue(Array.isArray(value),`${name} must be an array`);return value;};
export const putLatest = (array,record,field='updatedAt') => {const at=array.findIndex(x=>x.id===record.id);if(at<0)array.push(record);else if((record[field]??'')>(array[at][field]??''))array[at]=record;};
export function displaySnapshot(v) {
  const externalId = v.externalId ?? v.youtubeVideoId ?? youtubeId(v.url ?? '');
  return { id:videoKey(externalId),externalId,url:youtubeUrl(externalId),title:v.title || 'Your saved YouTube video',creator:v.creator || 'Added by you',
    creatorId:v.creatorId ?? 'personal',regions:(v.regions??[]).map(legacyRegion).filter(r=>Object.hasOwn(regionNames,r)),intents:v.intents??[],topics:v.topics??[],kind:v.kind??v.contentKind??'unknown',duration:v.duration??v.library?.sourceMetadata.durationSeconds,publishedAt:v.publishedAt??v.library?.sourceMetadata.publishedAt,thumbnail:v.thumbnail??v.library?.sourceMetadata.thumbnailUrl,presence:v.presence??'present',personalSource:true };
}
export async function fingerprint(value) {const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
export async function prepareImport(input) {
  requireValue(input && typeof input==='object'&&!Array.isArray(input),'expected JSON object');
  if(input.format==='back-fixer-upper-web') {
    requireValue(input.schemaVersion===1,'unsupported web schema');
    const data=emptyPersonal();
    for(const store of PERSONAL_STORES) data[store]=list(input.data?.[store],store);
    validatePersonal(data);return {data,receipt:await fingerprint(data),legacy:false};
  }
  requireValue(input.schemaVersion===4,'use an original schema-4 export or a web export');
  for(const name of ['videos','savedStretches','videoOpenEvents','personalVideoRatings','videoAliases','savedStretchAliases']) list(input[name],name);
  const data=emptyPersonal(), byId=new Map(), aliases=new Map();
  for(const v of [...input.videos,...input.videoAliases]) {
    requireValue(v&&id(v.id)&&typeof v.url==='string','invalid legacy video');
    requireValue(!byId.has(v.id),'duplicate legacy video identity');byId.set(v.id,v);
    if(v.duplicateOf)aliases.set(v.id,v.duplicateOf);
  }
  const resolve=old=>{const seen=new Set();while(aliases.has(old)){requireValue(!seen.has(old),'circular video aliases');seen.add(old);old=aliases.get(old);}return old;};
  const map=old=>{const v=byId.get(resolve(old));const external=v?.youtubeVideoId??youtubeId(v?.url??'');return /^[\w-]{11}$/.test(external??'')?videoKey(external):undefined;};
  for(const old of byId.keys())resolve(old);
  for(const v of input.videos) {
    const canonical=map(v.id);if(!canonical)continue;
    const s=displaySnapshot(v);s.id=canonical;s.externalId=canonical.slice(8);s.url=youtubeUrl(s.externalId);s.search=searchableText(s);
    data.snapshots.push(s); if(!v.library)data.custom.push(s);
  }
  const activeIds = new Set(input.savedStretches.map(r=>map(r.id)).filter(Boolean));
  for(const r of [...input.savedStretches,...input.savedStretchAliases]) {
    requireValue(r&&id(r.id)&&typeof r.saved==='boolean'&&Number.isSafeInteger(r.useCount)&&r.useCount>=0&&date(r.updatedAt)&&(!r.lastUsedAt||date(r.lastUsedAt)),'invalid legacy saved/use record');
    const canonical=map(r.id);if(!canonical || input.savedStretchAliases.includes(r)&&activeIds.has(canonical))continue;
    putLatest(data.bookmarks,{id:canonical,saved:r.saved,updatedAt:r.updatedAt});
    if(r.useCount)data.uses.push({id:`legacy-use:${r.id}`,videoId:canonical,count:r.useCount,at:r.lastUsedAt??r.updatedAt,updatedAt:r.updatedAt,baseline:true});
  }
  for(const e of input.videoOpenEvents) {
    requireValue(e&&id(e.id)&&id(e.videoId)&&date(e.openedAt),'invalid legacy open event');const canonical=map(e.videoId);
    if(canonical)data.opens.push({id:`legacy-open:${e.id}`,videoId:canonical,openedAt:e.openedAt});
  }
  for(const r of input.personalVideoRatings) {
    requireValue(r&&id(r.id)&&['helpful','neutral','worse'].includes(r.rating)&&date(r.updatedAt),'invalid legacy rating');const canonical=map(r.id);
    if(canonical)putLatest(data.ratings,{id:canonical,rating:r.rating,updatedAt:r.updatedAt});
  }
  const {exportedAt,...stable}=input, receipt=await fingerprint(stable);
  data.preserved.push({id:`legacy:${receipt}`,schemaVersion:4,payload:input});
  validatePersonal(data);
  return {data,receipt,legacy:true};
}
export function validatePersonal(data) {
  for(const name of PERSONAL_STORES) {const seen=new Set();for(const r of list(data[name],name)){requireValue(r&&id(r.id)&&!seen.has(r.id),`invalid/duplicate ${name} ID`);seen.add(r.id);}}
  for(const e of data.opens)requireValue(key(e.videoId)&&date(e.openedAt),'invalid open');
  for(const e of data.uses)requireValue(key(e.videoId)&&date(e.at)&&Number.isSafeInteger(e.count)&&e.count>=0,'invalid use');
  for(const e of data.bookmarks)requireValue(key(e.id)&&typeof e.saved==='boolean'&&date(e.updatedAt),'invalid bookmark');
  for(const e of data.ratings)requireValue(key(e.id)&&(e.rating===null||['helpful','neutral','worse'].includes(e.rating))&&date(e.updatedAt),'invalid rating');
  for(const e of [...data.custom,...data.snapshots])requireValue(key(e.id)&&youtubeId(e.url)===e.id.slice(8)&&e.externalId===e.id.slice(8)&&typeof e.title==='string'&&typeof e.creator==='string'&&Array.isArray(e.regions)&&e.regions.every(r=>Object.hasOwn(regionNames,r))&&Array.isArray(e.intents)&&Array.isArray(e.topics),'invalid video display record');
}
export function mergeImport(current,prepared) {
  const next=structuredClone(current);if(next.imports.some(r=>r.id===prepared.receipt))return {data:next,duplicate:true};
  for(const name of PERSONAL_STORES.filter(n=>n!=='imports')) for(const r of prepared.data[name]) {
    const prior=next[name].find(v=>v.id===r.id);
    if(!prior)next[name].push(r);
    else if(['bookmarks','ratings','settings','uses'].includes(name))putLatest(next[name],r);
    else if(name==='opens')requireValue(prior.videoId===r.videoId&&prior.openedAt===r.openedAt,'conflicting event identity');
  }
  for(const r of prepared.data.imports)if(!next.imports.some(i=>i.id===r.id))next.imports.push(r);
  next.imports.push({id:prepared.receipt,at:new Date().toISOString()});validatePersonal(next);return {data:next,duplicate:false};
}
export const exportObject = data => ({format:'back-fixer-upper-web',schemaVersion:1,exportedAt:new Date().toISOString(),data});
