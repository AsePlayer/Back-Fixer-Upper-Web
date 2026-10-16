import { el, button } from '../ui/dom.js';
import { filtersControl } from '../ui/filters.js';
export function historyView(app) {
  const state=app.state.history;
  const views=el('div',{className:'history-tabs','aria-label':'History views'});
  for(const view of ['frequent','recent','saved','rated'])views.append(button(view[0].toUpperCase()+view.slice(1),()=>{state.scrolls[state.view]=scrollY;state.view=view;app.render();window.scrollTo(0,state.scrolls[view]??0);},{'aria-pressed':String(state.view===view)}));
  const form=el('form',{className:'add-form'}),url=el('input',{type:'url',required:true,placeholder:'https://youtu.be/…','aria-label':'YouTube URL'}),title=el('input',{type:'text',maxLength:500,placeholder:'Optional title','aria-label':'Optional title'});
  form.append(el('label',{},'YouTube URL',url),el('label',{},'Title (optional)',title),el('button',{type:'submit'},'Add link'));
  form.addEventListener('submit',async e=>{e.preventDefault();try{await app.repo.addLink(url.value,title.value,app.videos);form.reset();app.notice(app.repo.temporary?'Link kept for this tab only.':'Link added to Saved.');}catch(error){app.notice(error.message);}});
  return el('section',{},el('div',{className:'hero'},el('p',{className:'eyebrow'},'YOUR PERSONAL COLLECTION'),el('h1',{},'A familiar place to return.'),el('p',{className:'intro'},'Your visits, saves and optional personal notes. Revisit counts don’t measure effectiveness.')),views,
    el('p',{className:'history-explanation'},state.view==='frequent'?'Videos opened at least twice, ordered by number of visits.':state.view==='recent'?'Your latest video visits, most recent first.':state.view==='saved'?'Videos you explicitly saved, ordered by use count.':'Your optional ratings, most recently updated first.'),
    el('details',{className:'add-link'},el('summary',{},'+ Add a YouTube link'),form),filtersControl(state.filters,app.catalog.creators,(k,v)=>app.changeFilter('history',k,v),{collapsed:true,includeArea:true,history:true,toolsOpen:state.toolsOpen,onToolsToggle:v=>state.toolsOpen=v}),app.results('history'));
}
