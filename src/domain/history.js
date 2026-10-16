export function summarize(events, timeField, countField) {
  const map = new Map();
  for (const e of events) { const prior = map.get(e.videoId) ?? {count:0,lastAt:''}; prior.count += countField ? e[countField] : 1; if (e[timeField] > prior.lastAt) prior.lastAt = e[timeField]; map.set(e.videoId,prior); }
  return map;
}
export function personalSummary(data) {
  return { opens: summarize(data.opens,'openedAt'), usage: summarize(data.uses,'at','count'),
    bookmarks: new Map(data.bookmarks.map(v=>[v.id,v])), ratings: new Map(data.ratings.map(v=>[v.id,v])) };
}
export function historyVideos(videos, data, view) {
  const s = personalSummary(data);
  return videos.filter(v=> view === 'frequent' ? (s.opens.get(v.id)?.count ?? 0)>=2 : view === 'recent' ? s.opens.has(v.id) : view === 'saved' ? s.bookmarks.get(v.id)?.saved : !!s.ratings.get(v.id)?.rating)
    .sort((a,b)=> {
      if (view === 'frequent') { const n=s.opens.get(b.id).count-s.opens.get(a.id).count; if(n)return n; }
      if (view === 'saved') { const n=(s.usage.get(b.id)?.count??0)-(s.usage.get(a.id)?.count??0); if(n)return n; }
      const at=v=> view === 'saved' ? s.usage.get(v.id)?.lastAt || s.bookmarks.get(v.id).updatedAt : view === 'rated' ? s.ratings.get(v.id).updatedAt : s.opens.get(v.id).lastAt;
      return at(b).localeCompare(at(a)) || a.id.localeCompare(b.id);
    });
}
