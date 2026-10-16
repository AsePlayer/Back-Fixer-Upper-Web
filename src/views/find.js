import { el, button } from '../ui/dom.js';
import { bodySelector } from '../ui/body-diagram.js';
import { filtersControl } from '../ui/filters.js';
import { regionNames } from '../domain/taxonomy.js';
export function findView(app) {
  const state=app.state.find,counts=Object.fromEntries(Object.keys(regionNames).map(r=>[r,app.videos.filter(v=>v.regions.includes(r)).length]));
  const root=el('section',{},el('div',{className:'hero'},el('p',{className:'eyebrow'},'A SMALL MOMENT FOR YOURSELF'),el('h1',{},'Where does it hurt?'),el('p',{className:'intro'},'Choose an area. Find a video. Take it at your pace.')));
  const layout=el('div',{className:'finder-layout'}),aside=el('aside',{'aria-label':'Choose a body area'},bodySelector(state,counts,r=>app.chooseRegion(r),v=>{state.bodyView=v;app.render();}));
  aside.append(button(`Other videos · ${app.videos.filter(v=>!v.regions.length).length}`,()=>app.navigate('library',{area:'unclassified'}),{className:'other-videos'}));
  const results=el('section',{className:'finder-results','aria-label':'Matching videos'},filtersControl(state.filters,app.catalog.creators,(k,v)=>app.changeFilter('find',k,v),{collapsed:true,toolsOpen:state.toolsOpen,onToolsToggle:v=>state.toolsOpen=v}));
  const area=state.filters.area;
  const heading=el('div',{className:'result-heading'},el('div',{},el('p',{className:'eyebrow'},'EXPLORE BY SUBJECT'),el('h2',{id:'results-heading'},area==='all'?'Your next little stretch':regionNames[area]??'Other videos')));
  if(area!=='all')heading.append(button('All areas',()=>app.chooseRegion('all'),{className:'text-button'}));results.append(heading);
  results.append(app.results('find',area!=='all'||!!state.filters.query));
  layout.append(aside,results);root.append(layout);return root;
}
