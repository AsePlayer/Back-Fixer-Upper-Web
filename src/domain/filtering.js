import { regionNames, intentNames, topicNames } from './taxonomy.js';
import { youtubeId } from './urls.js';
export const normalize = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const defaultFilters = () => ({ area:'all', query:'', kind:'all', intent:'all', topic:'all', duration:'all', creator:'all', sort:'newest' });
export const searchableText = v => normalize([v.title,v.creator,v.externalId,...(v.regions ?? []).map(r=>regionNames[r]),...(v.intents ?? []).map(i=>intentNames[i]),...(v.topics ?? []).map(t=>topicNames[t]),...(v.tags ?? [])].join(' '));
export function filterVideos(videos, filters, usage = new Map()) {
  const externalId = youtubeId(filters.query), terms = normalize(filters.query).split(' ').filter(Boolean);
  return videos.filter(v => {
    if (filters.area === 'unclassified' ? v.regions.length !== 0 : filters.area !== 'all' && !v.regions.includes(filters.area)) return false;
    if (filters.kind !== 'all' && v.kind !== filters.kind || filters.creator !== 'all' && v.creatorId !== filters.creator) return false;
    if (filters.intent !== 'all' && !v.intents.includes(filters.intent) || filters.topic !== 'all' && !v.topics.includes(filters.topic)) return false;
    if (filters.duration !== 'all' && !(v.duration > 0)) return false;
    if (filters.duration === 'under_5' && v.duration >= 300 || filters.duration === '5_to_10' && (v.duration < 300 || v.duration > 600) || filters.duration === 'over_10' && v.duration <= 600) return false;
    return externalId ? v.externalId === externalId : terms.every(term => (v.search ?? searchableText(v)).includes(term));
  }).sort((a,b) => {
    if (filters.sort === 'personal') return 0;
    if (filters.sort === 'most_used') { const difference = (usage.get(b.id)?.count ?? 0) - (usage.get(a.id)?.count ?? 0) || (usage.get(b.id)?.lastAt ?? '').localeCompare(usage.get(a.id)?.lastAt ?? ''); if (difference) return difference; }
    if (filters.sort === 'shortest') { const difference = (a.duration || Infinity) - (b.duration || Infinity); if (!Number.isNaN(difference) && difference) return difference; }
    if (['newest','most_used'].includes(filters.sort)) { const difference = (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''); if (difference) return difference; }
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}
export function durationLabel(seconds) {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return 'Length unknown';
  const s = Math.floor(seconds); return s >= 3600 ? `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
