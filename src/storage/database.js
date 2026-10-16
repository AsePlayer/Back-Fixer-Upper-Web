export const DATABASE_NAME = 'org.back-fixer-upper.web.v1';
export const PERSONAL_STORES = ['opens','bookmarks','ratings','uses','custom','snapshots','settings','preserved','imports'];
export const ALL_STORES = [...PERSONAL_STORES,'catalogs','meta'];
export const request = r => new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);});
export const completed = t => new Promise((resolve,reject)=>{t.oncomplete=()=>resolve(); t.onabort=()=>reject(t.error ?? new Error('Storage transaction aborted')); t.onerror=()=>{};});
export function openDatabase() {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DATABASE_NAME,1);
    r.onupgradeneeded=()=>{for(const name of ALL_STORES) if(!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name,{keyPath:'id'});};
    r.onsuccess=()=>{ const db=r.result; db.onversionchange=()=>db.close(); resolve(db); };
    r.onerror=()=>reject(r.error);
    r.onblocked=()=>reject(new Error('Storage upgrade is blocked by another open tab. Close that tab and reload.'));
  });
}
export const emptyPersonal = () => Object.fromEntries(PERSONAL_STORES.map(k=>[k,[]]));
export async function readPersonal(db) {
  const tx=db.transaction(PERSONAL_STORES,'readonly'), done=completed(tx);
  const values=await Promise.all(PERSONAL_STORES.map(name=>request(tx.objectStore(name).getAll())));
  await done; return Object.fromEntries(PERSONAL_STORES.map((name,i)=>[name,values[i]]));
}
export async function transactPersonal(db,action,stores,current) {
  const tx=db.transaction(stores,'readwrite'),done=completed(tx);
  const values=await Promise.all(stores.map(name=>request(tx.objectStore(name).getAll())));
  const data={...current,...Object.fromEntries(stores.map((name,i)=>[name,values[i]]))};
  let result;
  try{result=action(data);}catch(error){tx.abort();await done.catch(()=>{});error.personalAction=true;throw error;}
  for(const name of stores){const store=tx.objectStore(name);store.clear();for(const record of data[name])store.put(record);}
  await done;return {data,result};
}
