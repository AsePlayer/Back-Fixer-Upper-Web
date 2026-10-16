import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { Repository } from '../src/storage/repository.js';
import { historyVideos,personalSummary } from '../src/domain/history.js';
import { youtubeId } from '../src/domain/urls.js';
import { displaySnapshot, prepareImport } from '../src/storage/import-export.js';
const external='t1aA2JEaRpw',when='2026-10-10T12:00:00.000Z';
const video=displaySnapshot({externalId:external,title:'Synthetic stretch',creator:'Synthetic creator'});
async function repository(){globalThis.indexedDB=new IDBFactory();return new Repository().initialize();}
export function legacyFixture(){return {
  schemaVersion:4,exportedAt:when,profile:{name:'Synthetic only',context:'Synthetic note'},exercises:[],routines:[],sessions:[{id:'legacy-session',note:'Synthetic legacy note'}],exclusions:[],channels:[],
  videos:[{id:'old-main',title:video.title,creator:'Synthetic creator',credential:'',url:video.url,regions:['lower'],youtubeVideoId:external,library:{sourceMetadata:{durationSeconds:25}}},{id:'custom-id',title:'My synthetic link',creator:'Added by you',url:'https://youtu.be/abcdefghijk',regions:[]}],
  videoAliases:[{id:'old-alias',duplicateOf:'old-main',url:video.url,title:'Old alias'}],
  savedStretches:[{id:'old-main',saved:false,useCount:7,updatedAt:when,lastUsedAt:when},{id:'custom-id',saved:true,useCount:1,updatedAt:when}],
  savedStretchAliases:[{id:'old-alias',saved:true,useCount:3,updatedAt:when}],
  videoOpenEvents:[{id:'old-open-1',videoId:'old-alias',openedAt:when},{id:'old-open-2',videoId:'old-main',openedAt:when}],personalVideoRatings:[{id:'old-alias',rating:'worse',updatedAt:when}]
};}
test('opens, threshold-two Frequent, Recent, bookmarks, use and rating remain independent after reopen and catalog activation',async()=>{
  const repo=await repository();await repo.open(video,when);
  assert.equal(historyVideos([video],repo.data,'frequent').length,0);assert.equal(repo.data.bookmarks.length,0);assert.equal(repo.data.uses.length,0);
  await repo.open(video,'2026-10-11T12:00:00.000Z');assert.equal(historyVideos([video],repo.data,'frequent').length,1);
  const other=displaySnapshot({externalId:'abcdefghijk',title:'Another synthetic link'});await repo.open(other,'2026-10-12T12:00:00.000Z');
  assert.equal(historyVideos([video,other],repo.data,'recent')[0].id,other.id);
  await repo.bookmark(video,true);const useId=await repo.use(video);await repo.rate(video,'worse');
  const personal=structuredClone(repo.data);await repo.activateCatalog({id:'revision-a',manifest:{},index:[],details:{}});assert.deepEqual(repo.data,personal);
  const sort=(d:any)=>Object.fromEntries(Object.entries(d).map(([k,v]:any)=>[k,[...v].sort((a,b)=>a.id.localeCompare(b.id))]));
  const reopened=await new Repository().initialize();assert.deepEqual(sort(reopened.data),sort(personal));assert.equal(personalSummary(reopened.data).usage.get(video.id)?.count,1);
  await reopened.undoUse(useId);assert.equal(reopened.data.uses.length,0);assert.equal(reopened.data.bookmarks[0].saved,true);
  await reopened.rate(video,'neutral');await reopened.rate(video,null);assert.equal(historyVideos([video],reopened.data,'rated').length,0);repo.db.close();reopened.db.close();
});
test('authentic schema-4 aliases, counts, custom URLs and preserved notes import repeat-safely; invalid input rolls back',async()=>{
  const repo=await repository(),fixture=legacyFixture(),text=JSON.stringify(fixture);
  await repo.importJSON(text);const before=structuredClone(repo.data);await repo.importJSON(text);assert.deepEqual(repo.data,before);
  assert.equal(personalSummary(repo.data).usage.get(video.id)?.count,7);assert.equal(repo.data.bookmarks.find(r=>r.id===video.id)?.saved,false);assert.equal(personalSummary(repo.data).opens.get(video.id)?.count,2);
  assert.equal(repo.data.ratings[0].rating,'worse');assert.equal(repo.data.custom.length,1);assert.equal(repo.data.preserved[0].payload.sessions[0].note,'Synthetic legacy note');
  fixture.savedStretches[0].useCount=9;fixture.savedStretches[0].updatedAt='2026-10-12T12:00:00.000Z';await repo.importJSON(JSON.stringify(fixture));assert.equal(personalSummary(repo.data).usage.get(video.id)?.count,9);assert.equal(repo.data.opens.length,2);
  const stable=structuredClone(repo.data);fixture.videoOpenEvents[0].openedAt='not a date';await assert.rejects(repo.importJSON(JSON.stringify(fixture)),/Import rejected/);assert.deepEqual(repo.data,stable);
  const cycle=legacyFixture();cycle.videoAliases[0].duplicateOf='old-alias';await assert.rejects(prepareImport(cycle),/circular/);
  const exportText=await repo.exportJSON();await repo.importJSON(exportText);await repo.importJSON(exportText);assert.equal(personalSummary(repo.data).usage.get(video.id)?.count,9);assert.equal(repo.data.opens.length,2);repo.db.close();
});
test('custom links join later catalog by provider and ID; strict URL validation; clear tombstones survive older imports',async()=>{
  const repo=await repository();await repo.addLink('https://youtu.be/t1aA2JEaRpw','Custom title',[]);await repo.open(video,when);
  const before=structuredClone(repo.data);await repo.activateCatalog({id:'new',index:[video]});assert.deepEqual(repo.data,before);assert.equal(repo.data.custom[0].id,video.id);
  for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=t1aA2JEaRpw','https://evil.test/t1aA2JEaRpw','https://user:pass@youtube.com/watch?v=t1aA2JEaRpw'])assert.equal(youtubeId(url),undefined);
  await repo.importJSON(JSON.stringify(legacyFixture()));await repo.rate(video,null);const data=structuredClone(repo.data);await repo.importJSON(JSON.stringify(legacyFixture()));assert.deepEqual(repo.data,data);repo.db.close();
});
test('unavailable/quota storage gives usable temporary mode without claiming persistence',async()=>{
  globalThis.indexedDB={open(){throw new Error('Denied');}};const repo=await new Repository().initialize();assert.equal(repo.temporary,true);await repo.bookmark(video,true);assert.equal(repo.data.bookmarks.length,1);assert.equal(JSON.parse(await repo.exportJSON()).data.bookmarks.length,1);
  const persistent=await repository();persistent.db.close();await persistent.open(video,when);assert.equal(persistent.temporary,true);assert.equal(persistent.data.opens.length,1);
});
test('concurrent tabs append independent opens without overwriting committed personal records',async()=>{
  const first=await repository(),second=await new Repository().initialize();
  await Promise.all([first.open(video,when),second.open(video,'2026-10-11T12:00:00.000Z')]);
  const reopened=await new Repository().initialize();assert.equal(reopened.data.opens.length,2);first.db.close();second.db.close();reopened.db.close();
});
