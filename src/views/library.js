import { el } from '../ui/dom.js';
import { filtersControl } from '../ui/filters.js';
export function libraryView(app) {
  const state=app.state.library;
  return el('section',{},el('div',{className:'hero'},el('p',{className:'eyebrow'},'THE COMPLETE COLLECTION'),el('h1',{},'Room to explore.'),el('p',{className:'intro'},`${app.videos.length.toLocaleString()} original videos, organized by body area and subject.`)),filtersControl(state.filters,app.catalog.creators,(k,v)=>app.changeFilter('library',k,v),{includeArea:true,toolsOpen:state.toolsOpen,onToolsToggle:v=>state.toolsOpen=v}),app.results('library'));
}
