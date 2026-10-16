import { regionNames, intentNames, topicNames } from '../domain/taxonomy.js';
import { youtubeUrl, safeHttps, safeThumbnail } from '../domain/urls.js';
const fail = message => { throw new Error(`Catalog validation: ${message}`); };
const labels = (items, allowed) => Array.isArray(items) && new Set(items).size === items.length && items.every(x=>Object.hasOwn(allowed,x));
export function validateManifest(m) {
  if (!m || m.schema !== 1 || !/^[a-f0-9]{64}$/.test(m.revision) || !Number.isInteger(m.count) || m.count < 1 || m.count > 100000 || !Array.isArray(m.chunks) || !m.chunks.length || !Array.isArray(m.creators) || !m.creators.length) fail('unsupported manifest');
  for (const r of [m.index,...m.chunks]) if (!r || !new RegExp(`^${m.revision}/(?:index|details-[0-9]{3,5})\\.json$`).test(r.path) || !/^[a-f0-9]{64}$/.test(r.sha256) || !Number.isInteger(r.bytes) || r.bytes < 1 || r.bytes > 15000000) fail('invalid resource');
  if (m.chunks.reduce((n,c)=>n+c.count,0)!==m.count || !labels(m.regions,regionNames)) fail('counts or regions');
  const creators = new Set();
  for (const c of m.creators) { if (creators.has(c.id) || typeof c.id!=='string' || !/^[a-z][a-z0-9-]{0,79}$/.test(c.id) || typeof c.displayName!=='string' || !/^UC[\w-]{22}$/.test(c.channelId) || c.canonicalUrl!==`https://www.youtube.com/channel/${c.channelId}` || typeof c.sourceUrl!=='string' || typeof c.verificationUrl!=='string' || c.sourceUrl&&!safeHttps(c.sourceUrl) || c.verificationUrl&&!safeHttps(c.verificationUrl)) fail('creator provenance'); creators.add(c.id); }
  return m;
}
export function validateIndex(index,m) {
  if (!Array.isArray(index) || index.length !== m.count) fail('index count');
  const seen = new Set(), creators = new Set(m.creators.map(c=>c.id));
  for (const v of index) {
    if (!v || !/^[\w-]{11}$/.test(v.externalId) || v.id!==`youtube:${v.externalId}` || seen.has(v.id) || v.url!==youtubeUrl(v.externalId) || !creators.has(v.creatorId)) fail('identity/ownership');
    if (typeof v.title!=='string' || typeof v.creator!=='string' || typeof v.search!=='string' || !labels(v.regions,regionNames) || !labels(v.intents,intentNames) || !labels(v.topics,topicNames) || !['video','short','stream','unknown'].includes(v.kind) || !['present','missing'].includes(v.presence) || !Number.isInteger(v.chunk) || !m.chunks[v.chunk]) fail('record');
    if (v.duration !== undefined && (!Number.isFinite(v.duration) || v.duration < 0)) fail('duration');
    if (v.publishedAt !== undefined && (typeof v.publishedAt!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.publishedAt) || !Number.isFinite(Date.parse(v.publishedAt)))) fail('publication date');
    if (v.thumbnail!==undefined&&!safeThumbnail(v.thumbnail))fail('thumbnail URL');
    seen.add(v.id);
  }
  if(index.filter(v=>!v.regions.length).length!==m.unclassified) fail('unclassified count');
  for(let n=0;n<m.chunks.length;n++) if(index.filter(v=>v.chunk===n).length!==m.chunks[n].count) fail('chunk mapping');
  return index;
}
export function validateDetails(details,m,n,index) {
  if (!Array.isArray(details) || details.length !== m.chunks[n].count) fail('detail count');
  const expected = new Map(index.filter(v=>v.chunk===n).map(v=>[v.externalId,v]));
  for (const d of details) {
    const v=expected.get(d.youtubeVideoId), s=d.sourceMetadata, c=m.creators.find(c=>c.id===d.creatorId);
    if (!v || !s || !c || d.creatorId!==v.creatorId || s.youtubeVideoId!==v.externalId || s.url!==v.url || s.channelId && s.channelId!==c.channelId || !Array.isArray(s.tags) || !s.tags.every(t=>typeof t==='string') || !Array.isArray(s.categories) || !Array.isArray(s.discoveries) || !['present','missing'].includes(d.presence) || !['complete','partial','missing'].includes(d.metadataStatus)) fail('detail identity/provenance');
    if(s.title!==undefined&&typeof s.title!=='string' || s.description!==undefined&&typeof s.description!=='string' || !s.categories.every(t=>typeof t==='string') || !s.discoveries.every(e=>['videos','shorts','streams'].includes(e.surface)&&['video','short','stream','unknown'].includes(e.kind)&&Number.isInteger(e.order)&&e.order>=1))fail('source metadata');
    for(const classification of [d.automatic,d.derived]) if(!classification || !labels(classification.bodyRegions,regionNames) || !labels(classification.intents,intentNames) || !labels(classification.topics,topicNames) || classification.classifierVersion!==m.classifierVersion || !Array.isArray(classification.evidence)) fail('classification');
    if (JSON.stringify(d.derived.bodyRegions)!==JSON.stringify(v.regions) || s.contentKind!==v.kind || (s.title??'YouTube video (title unavailable)')!==v.title || s.durationSeconds!==v.duration || s.publishedAt!==v.publishedAt || d.presence!==v.presence) fail('detail/index disagreement');
    expected.delete(d.youtubeVideoId);
  }
  return details;
}
