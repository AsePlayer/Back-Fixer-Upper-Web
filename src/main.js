import './styles/main.css';
import { Repository } from './storage/repository.js';
import { Catalog, baseUrl } from './catalog/loader.js';
import { defaultFilters, filterVideos, searchableText } from './domain/filtering.js';
import { historyVideos, personalSummary } from './domain/history.js';
import { regionNames } from './domain/taxonomy.js';
import { el, button, message } from './ui/dom.js';
import { videoCard } from './ui/video-card.js';
import { findView } from './views/find.js';
import { libraryView } from './views/library.js';
import { historyView } from './views/history.js';
import { aboutView } from './views/about.js';
const main=document.querySelector('main');
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();});
const repo=new Repository();await repo.initialize();
const app={repo,catalog:new Catalog(repo),route:'find',expanded:new Set(),ratingEditors:new Set(),
  state:{find:{filters:defaultFilters(),bodyView:'back',limit:12,scroll:0},library:{filters:defaultFilters(),limit:12,scroll:0},history:{filters:{...defaultFilters(),sort:'personal'},view:'recent',limit:12,scroll:0,scrolls:{}}},
  get videos(){const catalog=this.catalog.videos,map=new Map(catalog.map(v=>[v.id,v]));for(const v of [...repo.data.custom,...repo.data.snapshots])if(!map.has(v.id))map.set(v.id,{...v,search:v.search??searchableText(v)});return [...map.values()];},
  notice(text){const node=document.querySelector('#notice');node.replaceChildren(text);node.hidden=false;},
  undo(id){this.notice(repo.temporary?'Did this kept for this tab only.':'Did this recorded.');document.querySelector('#notice').append(button('Undo',async()=>{await repo.undoUse(id);this.notice('Undone.');}));},
  isFlagged(video){return repo.data.preserved.some(r=>{const payload=r.payload;return payload?.exclusions?.some(e=>e.active&&payload.videos?.some(v=>(v.youtubeVideoId===video.externalId||v.url===video.url)&&[v.originExerciseId,...(v.originExerciseIds??[])].includes(e.exerciseId)));});},
  navigate(route,filters){if(filters)Object.assign(this.state[route].filters,filters);location.hash=`${route}${filters?.area?`?area=${encodeURIComponent(filters.area)}`:''}`;if(this.route===route)this.render();},
  chooseRegion(region){this.state.find.filters.area=region;this.state.find.limit=12;if(this.route!=='find')this.navigate('find',{area:region});else{history.replaceState(null,'',`#find?area=${encodeURIComponent(region)}`);this.render();}if(innerWidth<760)document.querySelector('#results-heading')?.scrollIntoView({behavior:'smooth',block:'start'});},
  changeFilter(route,key,value){const state=this.state[route];if(key==='reset')state.filters={...defaultFilters(),area:state.filters.area,sort:route==='history'?'personal':state.filters.sort};else state.filters[key]=value;state.limit=12;this.render({restoreFocus:true});},
  results(route,show=true){
    const state=this.state[route],root=el('div',{className:'results'});
    if(!show){root.append(message('A good place to start.','Pick a shaded area or a body-area button to see matching videos.'),button('Browse the full library',()=>this.navigate('library')));return root;}
    const candidates=route==='history'?historyVideos(this.videos,repo.data,state.view):this.videos;
    const results=filterVideos(candidates,state.filters,personalSummary(repo.data).usage);
    root.append(el('p',{className:'result-count','aria-live':'polite'},`${results.length.toLocaleString()} matching ${results.length===1?'video':'videos'}`));
    if(!results.length)root.append(message(route==='history'?'A little quiet here.':'No videos match these filters.',route==='history'?'Open a video, save a favorite or add a link. Personal ratings are always optional.':'Try another area or a broader search.'));
    root.append(el('div',{className:'card-list'},results.slice(0,state.limit).map(v=>videoCard(v,this,{personal:route==='history'}))));
    if(results.length>state.limit)root.append(button(`Show more · ${Math.min(12,results.length-state.limit)} videos`,()=>{state.limit+=12;this.render({restoreFocus:true});},{className:'show-more','data-focus':'show-more'}));return root;
  },
  render({restoreFocus=false}={}){
    const active=document.activeElement,focus=restoreFocus?active?.getAttribute('data-focus')||active?.getAttribute('aria-label'):null,selection=active?.selectionStart,scroll=scrollY;
    document.querySelectorAll('nav a').forEach(a=>{if(a.hash===`#${this.route}`)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    main.replaceChildren(({find:findView,history:historyView,library:libraryView,about:aboutView}[this.route])(this));
    if(focus){const target=[...main.querySelectorAll('[data-focus],[aria-label]')].find(e=>e.getAttribute('data-focus')===focus||e.getAttribute('aria-label')===focus);target?.focus({preventScroll:true});if(selection!=null&&target?.type==='search')target.setSelectionRange(selection,selection);window.scrollTo(0,scroll);}
  }
};
function storageStatus(){const node=document.querySelector('#storage-status');node.hidden=!repo.temporary;node.textContent='Temporary mode: browser storage is unavailable or full. Changes stay in this tab only. Export your data before closing; previous stored records have not been reset.';}
storageStatus();repo.addEventListener('storagefailure',storageStatus);
repo.addEventListener('change',()=>app.render({restoreFocus:true}));
function route(){const [raw,query='']=location.hash.slice(1).split('?'),next=['find','history','library','about'].includes(raw)?raw:'find';if(app.state[app.route])app.state[app.route].scroll=scrollY;app.route=next;document.querySelector('#notice').hidden=true;const area=new URLSearchParams(query).get('area');if(app.state[next]&&(area==='all'||area==='unclassified'||Object.hasOwn(regionNames,area)))app.state[next].filters.area=area;app.render();window.scrollTo(0,app.state[next]?.scroll??0);}
addEventListener('hashchange',route);
app.catalog.addEventListener('change',()=>app.render({restoreFocus:true}));
app.catalog.addEventListener('status',()=>{document.querySelector('#catalog-status').textContent=app.catalog.message;if(app.route==='about')app.render({restoreFocus:true});});
await app.catalog.initialize();route();
if(!app.catalog.current){main.replaceChildren(message('The catalog could not be opened.','Connect once to download the library, then try again.'),button('Retry',()=>location.reload()));}
if('serviceWorker'in navigator&&!import.meta.env.DEV){navigator.serviceWorker.register(new URL('sw.js',baseUrl),{scope:baseUrl.pathname}).then(()=>{if(app.catalog.current)void app.catalog.cacheInWorker(app.catalog.current.manifest);}).catch(()=>{document.querySelector('#catalog-status').textContent+=' Offline shell could not be installed in this browser.';});}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-app.catalog.lastCheck>=3600000)void app.catalog.refresh();});
addEventListener('online',()=>void app.catalog.refresh());
