import { openDatabase, readPersonal, transactPersonal, emptyPersonal, PERSONAL_STORES, request, completed } from './database.js';
import { prepareImport, mergeImport, exportObject, displaySnapshot } from './import-export.js';
import { youtubeId, videoKey } from '../domain/urls.js';
export class Repository extends EventTarget {
  data=emptyPersonal(); db=null; temporary=false; queue=Promise.resolve();
  explainTemporary() {this.temporary=true;this.dispatchEvent(new Event('storagefailure'));}
  async initialize() {try {this.db=await openDatabase();this.data=await readPersonal(this.db);}catch{this.explainTemporary();}return this;}
  change(action,stores=PERSONAL_STORES) {
    const job=this.queue.then(async()=>{
      let committed;
      if(this.db&&!this.temporary)try{committed=await transactPersonal(this.db,action,stores,this.data);}catch(error){if(error.personalAction)throw error;this.explainTemporary();}
      if(!committed){const data={...this.data,...Object.fromEntries(stores.map(s=>[s,structuredClone(this.data[s])]))};committed={data,result:action(data)};}
      for(const name of stores)committed.data[name].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      this.data=committed.data;this.dispatchEvent(new Event('change'));return committed.result;
    });this.queue=job.catch(()=>{});return job;
  }
  retain(data,video) {if(!data.snapshots.some(v=>v.id===video.id))data.snapshots.push(displaySnapshot(video));}
  open(video,at=new Date().toISOString()) {const event={id:crypto.randomUUID(),videoId:video.id,openedAt:at};return this.change(d=>{this.retain(d,video);d.opens.push(event);},['opens','snapshots']);}
  bookmark(video,saved) {return this.change(d=>{this.retain(d,video);d.bookmarks=d.bookmarks.filter(r=>r.id!==video.id);d.bookmarks.push({id:video.id,saved,updatedAt:new Date().toISOString()});},['bookmarks','snapshots']);}
  rate(video,rating) {if(rating!==null&&!['helpful','neutral','worse'].includes(rating))throw new Error('Unsupported rating');return this.change(d=>{this.retain(d,video);d.ratings=d.ratings.filter(r=>r.id!==video.id);d.ratings.push({id:video.id,rating,updatedAt:new Date().toISOString()});},['ratings','snapshots']);}
  use(video) {return this.change(d=>{this.retain(d,video);const id=crypto.randomUUID();d.uses.push({id,videoId:video.id,count:1,at:new Date().toISOString()});return id;},['uses','snapshots']);}
  undoUse(id) {return this.change(d=>{d.uses=d.uses.filter(r=>r.id!==id);},['uses']);}
  addLink(url,title,catalog) {
    const externalId=youtubeId(url);if(!externalId)throw new Error('Paste a valid YouTube video or Shorts URL.');
    return this.change(d=>{
      let video=catalog.find(v=>v.id===videoKey(externalId))??d.custom.find(v=>v.id===videoKey(externalId));
      if(!video){video=displaySnapshot({externalId,title:title.trim()||'Your saved YouTube video'});d.custom.push(video);}
      this.retain(d,video);d.bookmarks=d.bookmarks.filter(r=>r.id!==video.id);d.bookmarks.push({id:video.id,saved:true,updatedAt:new Date().toISOString()});return video;
    },['custom','bookmarks','snapshots']);
  }
  async importJSON(text) {
    if(text.length>50000000)throw new Error('Import exceeds 50 MB.');const prepared=await prepareImport(JSON.parse(text));
    return this.change(d=>{const result=mergeImport(d,prepared);Object.assign(d,result.data);return {duplicate:result.duplicate,opens:prepared.data.opens.length,bookmarks:prepared.data.bookmarks.length,preserved:prepared.data.preserved.length};});
  }
  async exportJSON() {await this.queue;if(this.db&&!this.temporary)this.data=await readPersonal(this.db);return JSON.stringify(exportObject(this.data),null,2);}
  reset() {return this.change(d=>{Object.assign(d,emptyPersonal());});}
  async cachedCatalog() {
    if(!this.db)return;try {const tx=this.db.transaction(['meta','catalogs'],'readonly'),done=completed(tx),active=await request(tx.objectStore('meta').get('active'));const value=active?await request(tx.objectStore('catalogs').get(active.revision)):undefined;await done;return value;}catch{return;}
  }
  async activateCatalog(catalog) {
    if(!this.db||this.temporary)return;
    try {const tx=this.db.transaction(['meta','catalogs'],'readwrite'),done=completed(tx);tx.objectStore('catalogs').put(catalog);tx.objectStore('meta').put({id:'active',revision:catalog.id});
      const keys=await request(tx.objectStore('catalogs').getAllKeys());for(const key of keys)if(key!==catalog.id)tx.objectStore('catalogs').delete(key);await done;
    }catch{this.explainTemporary();}
  }
}
