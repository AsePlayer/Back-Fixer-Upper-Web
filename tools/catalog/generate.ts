// Offline only: no provider/extractor imports, source records never mutated here.
import { createHash } from 'node:crypto';
import { ChannelCache, readJson, writeJson } from '../youtube-sync/cache';
import { normalizeVideo } from '../youtube-sync/normalize';
import { validateCatalog, validateOverrides } from '../youtube-sync/validate';
import { classify, applyOverride } from '../../src/content/classification/classify';
import { CLASSIFIER_VERSION } from '../../src/content/classification/rules';
import type { Creator, ContentCatalog, CatalogVideo } from '../../src/content/model';
export const hash = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');
export async function generateCatalog(options = { cacheRoot: 'content/source/youtube', creatorsPath: 'content/creators.json', overridesPath: 'content/overrides.json' }) {
  const creators = (await readJson<Creator[]>(options.creatorsPath) ?? []).filter(c => c.enabled).sort((a,b) => a.id.localeCompare(b.id));
  const overrides = validateOverrides(await readJson(options.overridesPath) ?? {});
  const videos: CatalogVideo[] = [];
  for (const creator of creators) {
    const cache = new ChannelCache(options.cacheRoot, creator.channelId!);
    const records = await cache.readVideos();
    if (!records.size) throw new Error(`Source cache is missing/empty for ${creator.id}. Existing catalog retained.`);
    for (const cached of records.values()) {
      const sourceMetadata = normalizeVideo(cached);
      const automatic = classify(sourceMetadata);
      const manualOverride = overrides[cached.youtubeVideoId];
      videos.push({ youtubeVideoId: cached.youtubeVideoId, creatorId: creator.id, sourceMetadata, automatic,
        ...(manualOverride ? { manualOverride } : {}), derived: applyOverride(automatic, manualOverride), presence: cached.presence,
        metadataStatus: cached.metadataRaw || (cached as any).seedMetadata ? sourceMetadata.title && sourceMetadata.description ? 'complete' : 'partial' : 'missing' });
    }
  }
  videos.sort((a,b) => a.creatorId.localeCompare(b.creatorId) || (b.sourceMetadata.publishedAt ?? '').localeCompare(a.sourceMetadata.publishedAt ?? '') || a.youtubeVideoId.localeCompare(b.youtubeVideoId));
  const payload = { schemaVersion: 1 as const, classifierVersion: CLASSIFIER_VERSION, creators, videos };
  const catalog: ContentCatalog = { ...payload, revision: hash(JSON.stringify(payload)) };
  validateCatalog(catalog);
  return catalog;
}
