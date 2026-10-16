export function el(tag,attributes={},...children) {
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attributes)){
    if(value===undefined||value===null||value===false)continue;
    if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='className')node.className=value;
    else if(key==='value')node.value=value;
    else if(key==='checked')node.checked=value;
    else node.setAttribute(key,value===true?'':String(value));
  }
  for(const child of children.flat(Infinity))if(child!==undefined&&child!==null&&child!==false)node.append(child instanceof Node?child:document.createTextNode(String(child)));
  return node;
}
export const button=(text,action,attributes={})=>el('button',{type:'button',...attributes,onClick:action},text);
export const externalLink=(text,url,attributes={})=>el('a',{href:url,target:'_blank',rel:'noopener noreferrer',...attributes},text);
export const message=(title,copy)=>el('div',{className:'empty'},el('h3',{},title),el('p',{},copy));
export function download(text) {const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=el('a',{href:url,download:`back-fixer-upper-${new Date().toISOString().slice(0,10)}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
