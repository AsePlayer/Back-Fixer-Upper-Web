import { el, button } from './dom.js';
import { regionNames, regionGroups } from '../domain/taxonomy.js';
// Coordinates and silhouette ported from the original PersonDiagram.tsx, not new anatomy.
const common=[['head',157,25,46,51],['neck',158,80,44,34],['shoulders',125,117,110,36,1],['arms',101,165,158,44,1],['elbows',91,218,178,34,1],['hands',77,292,206,37,1],['hips',126,291,108,43,1],['knees',140,403,80,35,1],['ankles',140,480,80,34,1],['feet',128,518,104,32,1]];
const views={back:[['upper_back',146,157,68,38,1],['mid_back',146,200,68,38,1],['lower_back',146,243,68,38,1],['glutes',145,335,70,30,1],['hamstrings',138,366,84,31,1],['calves',140,444,80,30,1]],front:[['ribs_chest',146,161,68,55],['pelvis_si',155,247,50,37],['thighs',138,357,84,39,1],['wrists',82,255,196,31,1]]};
export function bodySelector(state,counts,onSelect,onView) {
  const root=el('div',{className:'body-selector'}),toggle=el('div',{className:'segmented','aria-label':'Body view'});
  for(const view of ['back','front'])toggle.append(button(view==='back'?'Back':'Front',()=>onView(view),{'aria-pressed':String(state.bodyView===view),'aria-label':`${view==='back'?'Back':'Front'} view`}));
  const canvas=el('div',{className:'body-canvas'});
  // This is fixed, trusted application markup. External strings are never inserted as HTML.
  canvas.innerHTML=`<svg viewBox="0 0 360 560" aria-hidden="true"><ellipse cx="180" cy="544" rx="81" ry="9" fill="#dce5de"/><g transform="translate(-18,15) scale(1.16,1.24)" fill="#eee8dc" stroke="#9cac9f" stroke-width="1.3"><ellipse cx="170" cy="36" rx="22" ry="27"/><path d="M158 62 L158 78 C145 80 128 83 122 100 L110 151 L89 232 C85 246 89 257 97 258 C106 259 110 251 113 239 L129 183 L135 141 C139 164 137 187 132 209 C129 222 124 234 126 252 L136 328 L134 390 C133 398 128 407 130 412 C136 417 148 415 153 410 L158 339 L162 279 C166 270 174 270 178 279 L182 339 L187 410 C192 415 204 417 210 412 C212 407 207 398 206 390 L204 328 L214 252 C216 234 211 222 208 209 C203 187 201 164 205 141 L211 183 L227 239 C230 251 234 259 243 258 C251 257 255 246 251 232 L230 151 L218 100 C212 83 195 80 182 78 L182 62" stroke-linejoin="round"/></g></svg>`;
  const svg=canvas.firstElementChild,g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('transform','translate(-18,15) scale(1.16,1.24)');
  g.innerHTML=state.bodyView==='back'?'<path d="M158 94 Q137 106 146 128 M182 94 Q203 106 194 128 M135 239 Q149 251 169 243 Q191 251 205 239"/><path d="M170 86 L170 232"/>':'<path d="M146 91 Q170 101 194 91 M151 116 Q162 119 166 115 M174 115 Q178 119 189 116"/>';
  g.setAttribute('fill','none');g.setAttribute('stroke','#c1c9be');svg.append(g);
  const sides=state.bodyView==='back'?['left','right']:['right','left'];
  canvas.append(el('span',{className:'body-side left'},`Your ${sides[0]}`),el('span',{className:'body-side right'},`Your ${sides[1]}`));
  for(const [region,x,y,width,height,paired] of [...common,...views[state.bodyView]]){
    const arm=['arms','elbows','wrists','hands'].includes(region),w=paired?arm?32:Math.min(width/2-4,40):width;
    for(let i=0;i<(paired?2:1);i++){
      const left=i===0?x:x+width-w,active=state.filters.area===region;
      const hit=button('',()=>onSelect(region),{className:`body-hit${active?' active':''}`,'aria-label':`${regionNames[region]}${paired?`, your ${sides[i]}`:''}`,'aria-pressed':String(active),title:regionNames[region]});
      hit.style.cssText=`left:${left/360*100}%;top:${y/560*100}%;width:${w/360*100}%;height:${height/560*100}%;`;canvas.append(hit);
    }
  }
  root.append(toggle,canvas,el('p',{className:'hint'},'Tap a shaded area or choose a name below.'));
  const named=el('details',{className:'area-list',open:true},el('summary',{},'All 23 body areas'));
  for(const [name,regions]of regionGroups){named.append(el('h3',{},name),el('div',{className:'area-buttons'},regions.map(region=>button([regionNames[region],' · ',counts[region]??0].join(''),()=>onSelect(region),{'data-region':region,'aria-pressed':String(state.filters.area===region)}))));}
  root.append(named);return root;
}
