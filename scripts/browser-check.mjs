import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve,join,sep } from 'node:path';
import { createHash } from 'node:crypto';
const root=resolve('dist'),base='/nested/back-fixer-upper/',artifacts=resolve('artifacts');await mkdir(artifacts,{recursive:true});
const baseline=JSON.parse(await readFile(join(root,'data/manifest.json'),'utf8'));
let invalidManifest=false,updatedShell=false,fixtureManifest=null;
const fixtureResources=new Map();
async function prepareUpdate(){
  const source=JSON.parse(await readFile('content/catalog.json','utf8'));source.videos[0].sourceMetadata.title=`Updated · ${source.videos[0].sourceMetadata.title}`;
  const {revision,...payload}=source;const newRevision=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const manifest=structuredClone(baseline),index=JSON.parse(await readFile(join(root,'data',baseline.index.path),'utf8'));index[0].title=source.videos[0].sourceMetadata.title;index[0].search=`updated ${index[0].search}`;
  const resource=(path,data)=>{const bytes=Buffer.from(JSON.stringify(data)+'\n');fixtureResources.set(`data/${path}`,bytes);return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
  manifest.revision=newRevision;manifest.index=resource(`${newRevision}/index.json`,index);
  for(let n=0;n<manifest.chunks.length;n++){const chunk=JSON.parse(await readFile(join(root,'data',baseline.chunks[n].path),'utf8'));if(n===0)chunk[0].sourceMetadata.title=source.videos[0].sourceMetadata.title;manifest.chunks[n]={...resource(`${newRevision}/details-${String(n).padStart(3,'0')}.json`,chunk),count:chunk.length};}
  fixtureManifest=manifest;return newRevision;
}
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(path==='/'){res.setHeader('content-type','text/html');res.end('<title>Portfolio fixture</title><p>Outside app scope</p>');return;}
    if(!path.startsWith(base)){res.writeHead(404).end();return;}
    const target=resolve(root,path.slice(base.length)||'index.html');if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403).end();return;}
    const local=path.slice(base.length);let bytes=fixtureResources.get(local)??await readFile(target);
    if(path.endsWith('/manifest.json')&&fixtureManifest)bytes=Buffer.from(JSON.stringify(fixtureManifest));
    if(path.endsWith('/manifest.json')&&invalidManifest){const m=JSON.parse(bytes);m.revision='0'.repeat(64);bytes=Buffer.from(JSON.stringify(m));}
    if(path.endsWith('/sw.js')&&updatedShell)bytes=Buffer.from(bytes.toString().replace(/const VERSION='[^']+'/,"const VERSION='acceptance-shell-update'"));
    res.setHeader('cache-control','no-cache');res.setHeader('content-type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.json')?'application/json':target.endsWith('.svg')?'image/svg+xml':'text/html');res.end(bytes);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,url=`http://127.0.0.1:${port}${base}`;
const chrome=process.env.CHROME_PATH??(process.platform==='win32'&&existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
let browser;
const results={url,engine:chrome?'Installed Chrome':'Playwright Chromium',desktop:false,mobileViewport:false,offlineReopen:false,serviceWorkerUpdate:false,scope:false,storageFailure:false,errors:[]};
const personal=page=>page.evaluate(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('org.back-fixer-upper.web.v1',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});const data={};for(const name of ['opens','bookmarks','ratings','uses','custom','preserved'])data[name]=await new Promise((res,rej)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});db.close();return data;});
const waitFor=async(fn,timeout=15000)=>{const start=Date.now();while(!await fn()){if(Date.now()-start>timeout)throw new Error('Acceptance wait timed out');await new Promise(r=>setTimeout(r,100));}};
try{
  browser=await chromium.launch({headless:true,...(chrome?{executablePath:chrome}:{})});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  await context.route('https://**/*',route=>new URL(route.request().url()).hostname==='www.youtube.com'?route.fulfill({contentType:'text/html',body:'<p>Intercepted YouTube handoff</p>'}):route.abort()); // No real playback/thumbnail traffic.
  const page=await context.newPage();page.on('pageerror',e=>results.errors.push(e.message));
  await page.goto(url);await page.getByRole('heading',{name:'Where does it hurt?'}).waitFor();
  assert.equal(await page.locator('[data-region]').count(),23);
  await page.getByRole('button',{name:'Front view',exact:true}).click();await page.getByRole('button',{name:'Back view',exact:true}).click();
  await page.locator('[data-region="lower_back"]').click();await page.locator('.video-card').first().waitFor();assert(await page.locator('.video-card').count()<=12);
  const first=page.locator('.video-card').first(),id=await first.getAttribute('data-video');
  const action=async selector=>{const popup=page.waitForEvent('popup');await first.locator(selector).click();const p=await popup;await p.waitForURL('https://www.youtube.com/**');assert.equal(new URL(p.url()).searchParams.get('v'),id.slice(8));await p.close().catch(()=>{});};
  await action('.primary-button');await waitFor(async()=>(await personal(page)).opens.length===1);
  await action('.thumbnail');await waitFor(async()=>(await personal(page)).opens.length===2);
  let data=await personal(page);assert.equal(data.bookmarks.length,0);assert.equal(data.uses.length,0);assert.equal(data.ratings.length,0);
  await page.getByRole('link',{name:'History',exact:true}).click();await page.getByRole('button',{name:'Frequent',exact:true}).click();assert.equal(await page.locator('.video-card').count(),1);
  await page.getByRole('button',{name:'Recent',exact:true}).click();await page.getByText('Rate (optional)',{exact:true}).click();await page.getByRole('button',{name:'Made it worse',exact:true}).click();await page.locator('.worse-note').waitFor();
  await page.reload();await page.locator('.worse-note').waitFor();data=await personal(page);assert.equal(data.opens.length,2);assert.equal(data.ratings[0].rating,'worse');
  await page.locator('.rating-editor summary').click();await page.getByRole('button',{name:'Neutral',exact:true}).click();await page.getByRole('button',{name:'Clear rating',exact:true}).click();assert.equal((await personal(page)).ratings[0].rating,null);
  await page.getByRole('button',{name:'+ Save',exact:true}).click();await page.locator('.source-details summary').first().click();await page.getByRole('button',{name:'Did this (optional)',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();data=await personal(page);assert.equal(data.uses.length,0);assert.equal(data.bookmarks[0].saved,true);
  await page.getByRole('button',{name:'Saved',exact:true}).click();assert.equal(await page.locator('.video-card').count(),1);
  await page.getByText('+ Add a YouTube link',{exact:true}).click();await page.getByRole('textbox',{name:'YouTube URL',exact:true}).fill('https://youtu.be/abcdefghijk');await page.getByRole('textbox',{name:'Optional title',exact:true}).fill('<script>synthetic</script>');await page.getByRole('button',{name:'Add link',exact:true}).click();await waitFor(async()=>(await personal(page)).custom.length===1);
  assert.equal(await page.locator('script:not([type=module])').count(),0);assert(await page.getByRole('heading',{name:'<script>synthetic</script>',exact:true}).count());
  await page.getByRole('link',{name:'Library',exact:true}).click();await page.getByRole('searchbox',{name:'Search videos',exact:true}).fill(`https://youtu.be/${id.slice(8)}`);await waitFor(async()=>await page.locator('.video-card').count()===1);
  await page.getByRole('searchbox',{name:'Search videos',exact:true}).fill('');await page.getByRole('combobox',{name:'Body area',exact:true}).selectOption('unclassified');assert.equal(await page.locator('.result-count').textContent(),`${(baseline.unclassified+1).toLocaleString()} matching videos`);
  await page.getByRole('combobox',{name:'Body area',exact:true}).selectOption('all');await page.getByRole('combobox',{name:'Format',exact:true}).selectOption('short');await page.getByRole('combobox',{name:'Length',exact:true}).selectOption('under_5');assert(await page.locator('.video-card').count()>0);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'About & data',exact:true}).first().click();await page.getByRole('button',{name:'Export my data',exact:true}).click();const download=await downloadPromise;await download.saveAs(join(artifacts,'synthetic-browser-export.json'));
  const beforeImport=await personal(page);await page.getByLabel('Import JSON export').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":4}')});await waitFor(async()=>(await page.locator('#notice').textContent()).includes('Import rejected'));assert.deepEqual(await personal(page),beforeImport);
  await waitFor(async()=>page.evaluate(async()=>{const reg=await navigator.serviceWorker.ready;return !!reg.active&&!!navigator.serviceWorker.controller;}));
  await waitFor(async()=>page.evaluate(async()=>{const cache=await caches.keys();return cache.some(k=>k.includes('catalog:'));}));
  const original=await page.evaluate(async()=>{const db=await new Promise(res=>{const r=indexedDB.open('org.back-fixer-upper.web.v1',1);r.onsuccess=()=>res(r.result);});const active=await new Promise(res=>{const r=db.transaction('meta').objectStore('meta').get('active');r.onsuccess=()=>res(r.result);});db.close();return active.revision;});
  invalidManifest=true;await page.getByRole('button',{name:'Check for catalog updates',exact:true}).click();await waitFor(async()=>(await page.locator('#catalog-status').textContent()).includes('last usable'));invalidManifest=false;
  assert.equal(await page.evaluate(async()=>{const response=await fetch('data/manifest.json');return (await response.json()).revision;}),original);
  const preserved=await personal(page),newRevision=await prepareUpdate();await page.getByRole('button',{name:'Check for catalog updates',exact:true}).click();
  await waitFor(async()=>(await page.locator('.about-view').textContent()).includes(newRevision));assert.deepEqual(await personal(page),preserved);results.catalogUpdatePreservesPersonal=true;
  updatedShell=true;await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await registration.update();});
  await waitFor(async()=>page.evaluate(async()=>{const keys=await caches.keys();return keys.some(k=>k.includes('acceptance-shell-update'))&&keys.filter(k=>k.includes(':shell:')).length===1;}));results.serviceWorkerUpdate=true;
  await page.goto(`${url}#find?area=lower_back`);await page.locator('.video-card').first().waitFor();await page.screenshot({path:join(artifacts,'desktop.png'),fullPage:false});results.desktop=true;
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Where does it hurt?'}).waitFor();await page.locator('.video-card').first().waitFor();assert.match(await page.locator('#catalog-status').textContent(),/cached|Offline|usable/);assert.equal((await personal(page)).opens.length,2);results.offlineReopen=true;
  await context.setOffline(false);const outside=await context.newPage();await outside.goto(`http://127.0.0.1:${port}/`);assert.equal(await outside.evaluate(()=>navigator.serviceWorker.controller),null);results.scope=true;await outside.close();
  await page.setViewportSize({width:360,height:800});await page.getByRole('link',{name:'Find',exact:true}).click();await page.locator('[data-region="wrists"]').click();await page.locator('.video-card').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement!==document.body));await page.screenshot({path:join(artifacts,'mobile-viewport.png'),fullPage:false});results.mobileViewport=true;
  const unavailable=await browser.newContext({viewport:{width:360,height:800}});await unavailable.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw new Error('Synthetic storage unavailable');}});});const fail=await unavailable.newPage();fail.on('pageerror',e=>results.errors.push(e.message));await fail.goto(url);await fail.getByRole('heading',{name:'Where does it hurt?'}).waitFor();assert.match(await fail.locator('#storage-status').textContent(),/Temporary mode/);await fail.locator('[data-region="neck"]').click();await fail.getByRole('button',{name:'+ Save',exact:true}).first().click();assert.match(await fail.locator('#notice').textContent(),/this tab only/);results.storageFailure=true;await unavailable.close();
  assert.deepEqual(results.errors,[]);await context.close();console.log(JSON.stringify(results,null,2));
}finally{await writeFile(join(artifacts,'browser-acceptance.json'),JSON.stringify(results,null,2));await browser?.close();await new Promise(r=>server.close(r));}
