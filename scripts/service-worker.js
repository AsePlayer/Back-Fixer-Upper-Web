/* Build replaces these two constants. Cache names include the app's exact registration scope. */
const VERSION='__SHELL_VERSION__',SHELL_FILES=__SHELL_FILES__;
const ROOT=new URL('./',self.location.href),PREFIX=`bfu:${ROOT.pathname}:`,SHELL=`${PREFIX}shell:${VERSION}`;
const inScope=url=>url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname);
async function network(request){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);try{return await fetch(request,{signal:controller.signal,cache:'no-store'});}finally{clearTimeout(timer);}}
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(SHELL_FILES.map(p=>new URL(p,ROOT).href))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(`${PREFIX}shell:`)&&name!==SHELL)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);if(request.method!=='GET'||!inScope(url))return;
  const local=url.pathname.slice(ROOT.pathname.length);
  if(local==='data/manifest.json'||local==='data/status.json'){
    event.respondWith(network(request).catch(async()=>{const cached=await caches.match(request);if(cached)return cached;throw new Error('Offline catalog manifest unavailable');}));return;
  }
  if(local.startsWith('data/')){event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));return;}
  if(request.mode!=='navigate'){event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>cached||network(request)));return;}
  event.respondWith(network(request).catch(async()=>{const cached=await caches.match(request,{ignoreSearch:true});if(cached)return cached;return caches.match(new URL('index.html',ROOT));}));
});
let warming=Promise.resolve();
self.addEventListener('message',event=>{
  if(event.data?.type!=='CACHE_CATALOG')return;
  const manifest=event.data.manifest;
  if(manifest?.schema!==1||!/^[a-f0-9]{64}$/.test(manifest.revision)||!Array.isArray(manifest.chunks))return;
  const work=async()=>{
    const name=`${PREFIX}catalog:${manifest.revision}`,cache=await caches.open(name);
    try{
      for(const r of [manifest.index,...manifest.chunks]){
        if(!new RegExp(`^${manifest.revision}/(?:index|details-[0-9]{3,5})\\.json$`).test(r.path))throw new Error('Invalid path');
        const url=new URL(`data/${r.path}`,ROOT);if(!inScope(url))throw new Error('Scope escape');
        let response=await cache.match(url);if(!response)response=await fetch(url);if(!response.ok)throw new Error('Catalog resource unavailable');
        const bytes=await response.clone().arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
        if(digest!==r.sha256||bytes.byteLength!==r.bytes)throw new Error('Catalog integrity failure');await cache.put(url,response);
      }
      await cache.put(new URL('data/manifest.json',ROOT),new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}}));
      const status=await fetch(new URL('data/status.json',ROOT)).catch(()=>null);if(status?.ok)await cache.put(new URL('data/status.json',ROOT),status);
      for(const old of await caches.keys())if(old.startsWith(`${PREFIX}catalog:`)&&old!==name)await caches.delete(old);
      for(const client of await self.clients.matchAll())client.postMessage({type:'CATALOG_OFFLINE_READY',revision:manifest.revision});
    }catch{/* Keep old complete cache; never expose a new manifest for incomplete resources. */}
  };
  warming=warming.then(work,work);event.waitUntil(warming);
});
