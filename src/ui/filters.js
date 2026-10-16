import { el, button } from './dom.js';
import { regionNames, intentNames, topicNames } from '../domain/taxonomy.js';
export function filtersControl(filters,creators,onChange,{collapsed=false,includeArea=false,history=false,toolsOpen,onToolsToggle}={}) {
  const root=el('div',{className:'filters'}),search=el('input',{type:'search',value:filters.query,placeholder:'Title, body area, topic or YouTube link','aria-label':'Search videos',onInput:e=>onChange('query',e.target.value)});
  root.append(el('label',{className:'search-label'},'Search the library',search));
  const tools=el('details',{className:'filter-tools',open:toolsOpen??!collapsed,onToggle:e=>onToolsToggle?.(e.target.open)},el('summary',{},'Search & filters'));
  const fields=el('div',{className:'filter-fields'});
  const select=(label,key,options)=>{
    const input=el('select',{'aria-label':label,onChange:e=>onChange(key,e.target.value)},options.map(([value,text])=>el('option',{value},text)));input.value=filters[key];fields.append(el('label',{},label,input));
  };
  if(includeArea)select('Body area','area',[['all','All body areas'],['unclassified','Other videos'],...Object.entries(regionNames)]);
  select('Format','kind',[['all','All formats'],['video','Video'],['short','Short'],['stream','Live video'],['unknown','Unknown']]);
  select('Subject','intent',[['all','Any subject'],...Object.entries(intentNames)]);
  select('Topic','topic',[['all','Any topic'],...Object.entries(topicNames)]);
  select('Length','duration',[['all','Any length'],['under_5','Under 5 min'],['5_to_10','5–10 min'],['over_10','Over 10 min']]);
  if(creators.length>1)select('Creator','creator',[['all','All creators'],...creators.map(c=>[c.id,c.displayName])]);
  select('Order','sort',[...(history?[['personal','View order']]:[]),['newest','Newest'],['shortest','Shortest'],['title','Title A–Z'],['most_used','Use count']]);
  tools.append(fields,button('Reset filters',()=>onChange('reset',''),{className:'text-button'}));root.append(tools);return root;
}
