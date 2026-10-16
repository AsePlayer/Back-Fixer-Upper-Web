import type { RawMetadata } from './provider';
const keys = ['id','title','description','tags','categories','upload_date','release_date','timestamp','release_timestamp','duration','channel','channel_id','uploader','uploader_id','availability','live_status','is_live','was_live','playlist_channel','playlist_channel_id','playlist_uploader_id'];
export function sanitizeRaw(raw: RawMetadata): RawMetadata {
  const result:RawMetadata={};
  for(const key of keys){
    const value=raw[key];
    if(['tags','categories'].includes(key)){if(Array.isArray(value))result[key]=value.filter(v=>typeof v==='string');}
    else if(['timestamp','release_timestamp','duration'].includes(key)){if(typeof value==='number'&&Number.isFinite(value))result[key]=value;}
    else if(['is_live','was_live'].includes(key)){if(typeof value==='boolean')result[key]=value;}
    else if(typeof value==='string')result[key]=value;
  }
  // Only stable source/display fields. Never retain direct media URLs, headers or extractor configuration.
  const thumbnail = typeof raw.thumbnail === 'string' ? raw.thumbnail : Array.isArray(raw.thumbnails) ? raw.thumbnails.at(-1)?.url : undefined;
  if (typeof thumbnail === 'string') {
    try { const url = new URL(thumbnail); if (url.protocol === 'https:' && /(^|\.)ytimg\.com$/.test(url.hostname) && !url.searchParams.has('expire')) result.thumbnail = thumbnail; } catch {}
  }
  return result;
}
