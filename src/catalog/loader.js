import { validateManifest, validateIndex, validateDetails } from './validation.js';
export const baseUrl = new URL('./',document.baseURI);
const dataUrl = path => new URL(`data/${path}`,baseUrl);
async function fetchCatalog(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(15000)});}
async function checkedResource(resource) {
  const response=await fetchCatalog(dataUrl(resource.path),{cache:'no-cache'});if(!response.ok)throw new Error(`Catalog download failed (${response.status})`);
  const bytes=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==resource.bytes||digest!==resource.sha256)throw new Error('Catalog integrity check failed; previous revision retained.');
  return JSON.parse(new TextDecoder().decode(bytes));
}
export class Catalog extends EventTarget {
  constructor(repo){super();this.repo=repo;this.current=null;this.pending=null;this.lastCheck=0;this.message='Loading catalog…';this.inflight=new Map();this.status=null;}
  get videos(){return this.current?.index??[];}
  get creators(){return this.current?.manifest.creators??[];}
  async initialize() {
    const cached=await this.repo.cachedCatalog();
    if(cached)try{validateManifest(cached.manifest);validateIndex(cached.index,cached.manifest);for(const [n,details] of Object.entries(cached.details??{}))validateDetails(details,cached.manifest,Number(n),cached.index);this.current=cached;this.message='Using your cached catalog.';}catch{this.message='Cached catalog could not be validated.';}
    // Cached data renders immediately. First use needs only the compact index before rendering.
    if(!this.current)await this.refresh(true);else void this.refresh();
    return this;
  }
  async refresh(first=false) {
    if(this.pending)return this.pending;this.lastCheck=Date.now();
    this.pending=(async()=>{
      try {
        const response=await fetchCatalog(dataUrl('manifest.json'),{cache:'no-store'});if(!response.ok)throw new Error('Catalog unavailable');
        const manifest=validateManifest(await response.json());
        void this.loadStatus();
        if(manifest.revision===this.current?.id){this.message=navigator.onLine?'Catalog is up to date.':'Offline · using your cached catalog.';return;}
        const index=validateIndex(await checkedResource(manifest.index),manifest);
        const candidate={id:manifest.revision,manifest,index,details:{}};
        if(first&&!this.current){this.current=candidate;await this.repo.activateCatalog(candidate);this.message='Catalog ready. Preparing offline details…';this.dispatchEvent(new Event('change'));}
        // Warm the revision after first render. Updates activate only after every chunk validates.
        for(let n=0;n<manifest.chunks.length;n++)candidate.details[n]=validateDetails(await checkedResource(manifest.chunks[n]),manifest,n,index);
        await this.repo.activateCatalog(candidate);this.current=candidate;this.message=this.repo.temporary?'Catalog ready. Temporary mode: offline reopening cannot be confirmed.':'Catalog ready for offline browsing. YouTube needs internet.';
        void this.cacheInWorker(manifest);this.dispatchEvent(new Event('change'));
      }catch(error){this.message=this.current?`Using the last usable catalog. ${navigator.onLine?error.message:'You’re offline.'}`:`Could not load the catalog. ${error.message}`;}
      finally{this.dispatchEvent(new Event('status'));this.pending=null;}
    })();return first?this.firstIndex():this.pending;
  }
  async firstIndex(){while(!this.current&&this.pending){await Promise.race([this.pending,new Promise(r=>setTimeout(r,25))]);}return this.current;}
  async details(video) {
    if(video.chunk===undefined)return undefined;
    const catalog=this.current,n=video.chunk;if(catalog.details[n])return catalog.details[n].find(d=>d.youtubeVideoId===video.externalId);
    const key=`${catalog.id}:${n}`;
    if(!this.inflight.has(key))this.inflight.set(key,checkedResource(catalog.manifest.chunks[n]).then(data=>{catalog.details[n]=validateDetails(data,catalog.manifest,n,catalog.index);return catalog.details[n];}).finally(()=>this.inflight.delete(key)));
    return (await this.inflight.get(key)).find(d=>d.youtubeVideoId===video.externalId);
  }
  async loadStatus(){try{const response=await fetchCatalog(dataUrl('status.json'),{cache:'no-store'});if(response.ok)this.status=await response.json();}catch{}this.dispatchEvent(new Event('status'));}
  async cacheInWorker(manifest){try{const registration=await navigator.serviceWorker.ready;registration.active?.postMessage({type:'CACHE_CATALOG',manifest});}catch{}}
}
