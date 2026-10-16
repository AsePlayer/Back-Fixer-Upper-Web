import { mkdir, writeFile, readFile, rename, readdir, realpath, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import type { ContentCatalog } from '../../src/content/model';
import { hash } from './generate';
import { searchableText } from '../../src/domain/filtering.js';
export function listRecord(item: ContentCatalog['videos'][number], creators: ContentCatalog['creators']) {
  const s = item.sourceMetadata;
  return { id: `youtube:${item.youtubeVideoId}`, externalId: item.youtubeVideoId, title: s.title ?? 'YouTube video (title unavailable)',
    creatorId: item.creatorId, creator: creators.find(c => c.id === item.creatorId)!.displayName, url: s.url,
    regions: item.derived.bodyRegions, intents: item.derived.intents, topics: item.derived.topics,
    kind: s.contentKind, duration: s.durationSeconds, publishedAt: s.publishedAt, thumbnail: s.thumbnailUrl, presence: item.presence,
    search: searchableText({ title: s.title, creator: creators.find(c => c.id === item.creatorId)!.displayName, externalId: item.youtubeVideoId,
      regions: item.derived.bodyRegions, intents: item.derived.intents, topics: item.derived.topics, tags: s.tags }) };
}
export async function publishCatalog(catalog: ContentCatalog, directory = 'public/data') {
  // A revision contains immutable index + chunks. Manifest is replaced last.
  const revisionDirectory = join(directory, catalog.revision);
  await mkdir(revisionDirectory, { recursive: true });
  const resource = async (name: string, data: unknown) => {
    const bytes = JSON.stringify(data) + '\n';
    const path = join(revisionDirectory, name);
    if (await readFile(path, 'utf8').catch(() => '') !== bytes) await writeFile(path, bytes);
    return { path: `${catalog.revision}/${name}`, sha256: hash(bytes), bytes: Buffer.byteLength(bytes) };
  };
  const chunks = [];
  const index = catalog.videos.map(v => listRecord(v, catalog.creators));
  for (let start = 0; start < catalog.videos.length; start += 64) {
    const number = chunks.length;
    const entries = catalog.videos.slice(start, start + 64);
    for (let i = start; i < Math.min(start + 64, index.length); i++) (index[i] as any).chunk = number;
    chunks.push({ ...await resource(`details-${String(number).padStart(3,'0')}.json`, entries), count: entries.length });
  }
  const manifest = { schema: 1, revision: catalog.revision, classifierVersion: catalog.classifierVersion,
    count: index.length, creators: catalog.creators, index: await resource('index.json', index), chunks,
    regions: [...new Set(index.flatMap(v => v.regions))].sort(), unclassified: index.filter(v => !v.regions.length).length };
  const text = JSON.stringify(manifest, null, 2) + '\n';
  await mkdir(directory, { recursive: true });
  if (await readFile(join(directory,'manifest.json'),'utf8').catch(() => '') !== text) {
    await writeFile(join(directory,'manifest.json.tmp'), text); await rename(join(directory,'manifest.json.tmp'),join(directory,'manifest.json'));
  }
  return manifest;
}
export async function pruneRevisions(directory:string,keep:string[]) {
  const root=await realpath(directory);
  for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()&&!entry.isSymbolicLink()&&/^[a-f0-9]{64}$/.test(entry.name)&&!keep.includes(entry.name)){
    const target=await realpath(join(root,entry.name));if(dirname(target)!==root)throw new Error('Refusing catalog cleanup outside public data directory.');await rm(target,{recursive:true,force:true});
  }
}
