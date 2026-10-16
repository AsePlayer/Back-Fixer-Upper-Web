import { resolve, join } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ChannelCache, readJson, writeJson } from '../youtube-sync/cache';
import { normalizeVideo } from '../youtube-sync/normalize';
import { sanitizeRaw } from '../youtube-sync/sanitize';
import type { ContentCatalog } from '../../src/content/model';
export async function bootstrap(snapshotPath: string, rawRoot?: string) {
  const bytes = await readFile(snapshotPath);
  const catalog = JSON.parse(bytes.toString()) as ContentCatalog;
  let imported = 0, reconstructed = 0;
  for (const creator of catalog.creators) {
    const cache = new ChannelCache('content/source/youtube', creator.channelId!);
    await cache.prepare(); await cache.writeCreator(creator);
    for (const item of catalog.videos.filter(v => v.creatorId === creator.id)) {
      if (await readJson(join(cache.directory, 'videos', `${item.youtubeVideoId}.json`))) continue;
      const raw = rawRoot ? await readJson<any>(join(rawRoot, creator.channelId!, 'videos', `${item.youtubeVideoId}.json`)) : undefined;
      const video: any = raw ? {
        youtubeVideoId: item.youtubeVideoId, discoveries: raw.discoveries,
        discoveryRaw: sanitizeRaw(raw.discoveryRaw), metadataRaw: raw.metadataRaw ? sanitizeRaw(raw.metadataRaw) : undefined,
        enrichedAt: raw.enrichedAt, extractorVersion: raw.extractorVersion, presence: item.presence,
        cacheSchemaVersion: 1, provenance: { kind: 'sanitized-extractor-cache', sourceRepository: 'AsePlayer/Back-FIxer-Upper', sourceSha: 'ffcfdddc4c1107ea269d9a8696b77976ca14f2d4' }
      } : {
        youtubeVideoId: item.youtubeVideoId, discoveries: item.sourceMetadata.discoveries, discoveryRaw: {}, presence: item.presence,
        cacheSchemaVersion: 1, provenance: { kind: 'normalized-snapshot-seed', sourceRevision: catalog.revision, requiresEnrichment: true }
      };
      // Preserve the exact checked-in baseline if reconstruction or a newer PC cache differs.
      if (JSON.stringify(normalizeVideo(video)) !== JSON.stringify(item.sourceMetadata)) video.seedMetadata = item.sourceMetadata;
      await cache.writeVideo(video);
      raw ? imported++ : reconstructed++;
    }
    const previous = rawRoot ? await readJson<any>(join(rawRoot, creator.channelId!, 'sync-state.json')) : undefined;
    if (!await cache.readState()) await cache.writeState({
      ...(previous ?? {}), channelId: creator.channelId!, canonicalUrl: creator.canonicalUrl,
      initialScanComplete: false, highWater: previous?.highWater ?? {}, catalogVersion: catalog.classifierVersion,
      outcome: 'partial', surfaces: {}, errors: [], duplicatesPrevented: 0,
      // The new durable writer still needs its own successful full reconciliation.
      lastFullReconcileAt: undefined, bootstrapRequiresFullDiscovery: true,
      lastSyncStartedAt: undefined, lastSyncCompletedAt: undefined,
      bootstrapSourceCheck: previous?.lastSyncCompletedAt,
    } as any);
  }
  const kinds = Object.fromEntries(['video','short','stream','unknown'].map(kind => [kind, catalog.videos.filter(v => v.sourceMetadata.contentKind === kind).length]));
  const regions = Object.fromEntries([...new Set(catalog.videos.flatMap(v => v.derived.bodyRegions))].sort().map(region => [region, catalog.videos.filter(v => v.derived.bodyRegions.includes(region)).length]));
  await writeJson('content/baseline.json', { sourceSha: 'ffcfdddc4c1107ea269d9a8696b77976ca14f2d4', sourceRevision: catalog.revision, snapshotSha256: createHash('sha256').update(bytes).digest('hex'), snapshotBytes: (await stat(snapshotPath)).size, total: catalog.videos.length, kinds, regions, unclassified: catalog.videos.filter(v => !v.derived.bodyRegions.length).length, importedRawRecords: imported, reconstructedRecords: reconstructed });
  console.log(`Seeded ${imported} sanitized extractor records and ${reconstructed} normalized snapshot records. Full discovery remains required.`);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('tools/catalog/bootstrap.ts')) bootstrap(process.argv[2] ?? 'content/catalog.json', process.argv[3]).catch(e => { console.error(e.message); process.exitCode = 1; });
