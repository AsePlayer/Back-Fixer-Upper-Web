import { ChannelCache, readJson } from '../tools/youtube-sync/cache';
import { sanitizeRaw } from '../tools/youtube-sync/sanitize';
import type { Creator } from '../src/content/model';
const creators=await readJson<Creator[]>('content/creators.json')??[];
let count=0,bytes=0;
for(const c of creators.filter(c=>c.enabled)){
  const cache=new ChannelCache('content/source/youtube',c.channelId!);
  for(const v of (await cache.readVideos()).values()){
    if(v.cacheSchemaVersion!==1)throw new Error('Unknown cache version.');
    for(const raw of [v.discoveryRaw,v.metadataRaw].filter(Boolean))if(JSON.stringify(raw)!==JSON.stringify(sanitizeRaw(raw!)))throw new Error(`Unsanitized source record: ${v.youtubeVideoId}`);
    if(v.seedMetadata?.youtubeVideoId&&v.seedMetadata.youtubeVideoId!==v.youtubeVideoId)throw new Error('Seed identity mismatch.');
    count++;bytes+=Buffer.byteLength(JSON.stringify(v));
  }
}
console.log(`Sanitized durable source audit: ${count} records, ${bytes.toLocaleString()} compact JSON bytes.`);
