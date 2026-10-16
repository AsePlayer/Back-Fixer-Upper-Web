import { el, button, externalLink } from './dom.js';
import { durationLabel } from '../domain/filtering.js';
import { personalSummary } from '../domain/history.js';
import { regionNames, ratingNames, intentNames } from '../domain/taxonomy.js';
import { safeThumbnail, safeHttps, youtubeUrl } from '../domain/urls.js';
export function videoCard(video,app,{personal=false}={}) {
  const s=personalSummary(app.repo.data),saved=s.bookmarks.get(video.id)?.saved,rating=s.ratings.get(video.id)?.rating,opens=s.opens.get(video.id),uses=s.usage.get(video.id);
  const card=el('article',{className:'video-card','data-video':video.id}),url=youtubeUrl(video.externalId);
  const open=()=>{void app.repo.open(video).catch(()=>app.notice('This visit could not be recorded. You can still open videos.'));};
  const auxiliary=e=>{if(e.button===1)open();};
  const thumbnail=externalLink('',url,{className:'thumbnail','aria-label':`Thumbnail: watch ${video.title}`,onClick:open,onAuxClick:auxiliary});
  thumbnail.append(el('span',{className:'play','aria-hidden':'true'},'▶'));
  const image=safeThumbnail(video.thumbnail);if(image)thumbnail.append(el('img',{src:image,alt:'',loading:'lazy',decoding:'async',onError:e=>e.target.remove()}));
  thumbnail.append(el('span',{className:'duration'},durationLabel(video.duration)));
  card.append(el('div',{className:'video-top'},thumbnail,el('div',{},el('p',{className:'eyebrow'},`${{short:'Short',video:'Video',stream:'Live video',unknown:'YouTube'}[video.kind]??'YouTube'} · ${video.publishedAt??'Date unknown'}`),el('h3',{},video.title),el('p',{className:'creator'},video.creator))));
  const tags=el('div',{className:'tags'});for(const region of video.regions)tags.append(button(regionNames[region],()=>app.chooseRegion(region),{className:'tag'}));if(!video.regions.length)tags.append(el('span',{},'Body area not assigned'));card.append(tags);
  if(personal&&opens)card.append(el('p',{className:'small'},`Opened ${opens.count} ${opens.count===1?'time':'times'} · Last ${new Date(opens.lastAt).toLocaleDateString()}`));
  if(rating)card.append(el('p',{className:rating==='worse'?'worse-note':'rating-note'},`${ratingNames[rating]} · Your personal note`));
  if(video.presence==='missing')card.append(el('p',{className:'small'},'No longer listed on the creator’s channel. Your history is retained.'));
  if(app.isFlagged(video))card.append(el('p',{className:'small'},'You previously flagged this movement for review.'));
  const save=button(saved?'✓ Saved':'+ Save',async()=>{await app.repo.bookmark(video,!saved);app.notice(app.repo.temporary?'Bookmark kept for this tab only.':!saved?'Video saved.':'Bookmark removed.');},{'aria-pressed':String(!!saved),'data-focus':`save:${video.id}`});
  card.append(el('div',{className:'actions'},externalLink('▶ YouTube',url,{className:'primary-button','aria-label':`Watch ${video.title} on YouTube`,onClick:open,onAuxClick:auxiliary}),save));
  if(personal){
    const editor=el('details',{className:'rating-editor',open:app.ratingEditors.has(video.id),onToggle:e=>e.target.open?app.ratingEditors.add(video.id):app.ratingEditors.delete(video.id)},el('summary',{},rating?'Edit rating':'Rate (optional)'));
    editor.append(el('p',{className:'small'},'An optional personal note. Change or clear it anytime.'),el('div',{className:'actions'},Object.entries(ratingNames).map(([value,name])=>button(name,()=>app.repo.rate(video,value),{'aria-pressed':String(value===rating),'data-focus':`rate:${video.id}:${value}`})),rating?button('Clear rating',()=>app.repo.rate(video,null),{'data-focus':`clear:${video.id}`}):null));card.append(editor);
  }
  const details=el('details',{className:'source-details',open:app.expanded.has(video.id)},el('summary',{},'Source & details'));
  const body=el('div',{className:'detail-body'});details.append(body);let loaded=false;
  const showDetails=async()=>{
    if(loaded)return;loaded=true;body.replaceChildren(el('p',{},'Loading source details…'));
    try{
      const full=await app.catalog.details(video),source=full?.sourceMetadata,creator=app.catalog.creators.find(c=>c.id===video.creatorId);
      body.replaceChildren(el('p',{className:'small','data-use-count':video.id},`Did this: ${uses?.count??0} ${uses?.lastAt?`· Last ${new Date(uses.lastAt).toLocaleDateString()}`:''}`),button('Did this (optional)',async()=>{const id=await app.repo.use(video);app.undo(id);},{'data-focus':`use:${video.id}`}));
      if(creator)body.append(el('p',{},`${creator.displayName}${creator.credential?` · ${creator.credential}`:''}`));
      body.append(el('p',{className:'small'},'Automatically indexed source metadata. Labels describe video subjects; demonstration and personal suitability have not been reviewed.'));
      if(video.intents.length)body.append(el('p',{},`Subjects: ${video.intents.map(i=>intentNames[i]).join(', ')}`));
      if(source?.description)body.append(el('h4',{},'Creator’s description'),el('p',{className:'description'},source.description));
      else body.append(el('p',{},'No creator description available.'));
      for(const [label,address] of [['Creator’s profile',creator?.verificationUrl],['Source page',creator?.sourceUrl]])if(safeHttps(address))body.append(externalLink(label,safeHttps(address)));
      if(full){const provenance=el('details',{},el('summary',{},'Classification & discovery evidence'));provenance.append(el('pre',{},JSON.stringify({presence:full.presence,metadataStatus:full.metadataStatus,discoveries:source.discoveries,automatic:full.automatic,manualOverride:full.manualOverride},null,2)));body.append(provenance);}
      if(!full)body.append(el('p',{className:'small'},'Personal link. No privileged metadata was fetched.'));
    }catch{loaded=false;body.replaceChildren(el('p',{},'Source details are unavailable. You can still open the original video.'),button('Retry details',showDetails));}
  };
  details.addEventListener('toggle',()=>{if(details.open){app.expanded.add(video.id);void showDetails();}else app.expanded.delete(video.id);});if(details.open)void showDetails();card.append(details);return card;
}
