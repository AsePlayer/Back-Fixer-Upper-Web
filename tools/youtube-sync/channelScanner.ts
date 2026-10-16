import type { ChannelSurface, Creator } from "../../src/content/model";
import { setTimeout as delay } from "node:timers/promises";
import { CLASSIFIER_VERSION } from "../../src/content/classification/rules";
import { ChannelCache, type SyncState } from "./cache";
import { normalizeVideo } from "./normalize";
import { type ChannelContentProvider, ProviderRateLimited, SurfaceUnavailable } from "./provider";
import { sanitizeRaw } from './sanitize';
export interface SyncOptions {
  full?: boolean;
  concurrency?: number;
  knownStreak?: number;
  recentRefreshCount?: number;
  recentFreshnessHours?: number;
  refreshStale?: boolean;
  staleDays?: number;
  enrichmentLimit?: number;
  metadataErrorLimit?: number;
  requestDelayMs?: number;
  now?: () => string;
  log?: (message: string) => void;
  deadline?: number;
  minimumFullInventoryRatio?: number;
}
// Per-tab high-water + 20 consecutive IDs known before this scan. A new ID
// resets the streak. If high-water is absent/removed we scan the complete tab.
export class IncrementalBoundary {
  private streak = new Set<string>();
  private reached = false;
  constructor(private highWater: string | undefined, private required = 20) {}
  visit(id: string, wasKnown: boolean) {
    if (id === this.highWater) this.reached = true;
    if (wasKnown) this.streak.add(id); else this.streak.clear();
    return this.reached && this.streak.size >= this.required;
  }
}
export async function syncChannel(provider: ChannelContentProvider, cache: ChannelCache, creator: Creator, options: SyncOptions = {}) {
  await cache.prepare();
  const unlock = await cache.lock();
  const now = options.now ?? (() => new Date().toISOString());
  const log = options.log ?? console.log;
  let state: SyncState | undefined;
  try {
    const previous = await cache.readState();
    const videos = await cache.readVideos();
    const known = new Set(videos.keys());
    const version = await provider.version();
    const full = !!options.full || !previous?.initialScanComplete;
    state = {
      ...previous, channelId: creator.channelId!, canonicalUrl: creator.canonicalUrl,
      initialScanComplete: previous?.initialScanComplete ?? false,
      lastSyncStartedAt: now(), highWater: { ...previous?.highWater },
      extractorVersion: version, catalogVersion: CLASSIFIER_VERSION, outcome: "running",
      surfaces: {}, errors: [], duplicatesPrevented: 0,
    };
    await cache.writeCreator(creator); await cache.writeState(state);
    const seen = new Set<string>();
    const recent = new Set<string>();
    const nextHighWater: SyncState["highWater"] = {};
    let providerThrottled = false;
    for (const surface of ["videos", "shorts", "streams"] as ChannelSurface[]) {
      if (providerThrottled) {
        state.surfaces[surface] = { status: "failed", scanned: 0, error: "Not attempted after provider throttling." };
        continue;
      }
      let scanned = 0;
      let stopped = false;
      let malformed = false;
      const surfaceSeen = new Set<string>();
      const boundary = new IncrementalBoundary(previous?.highWater[surface], options.knownStreak ?? 20);
      log(`Enumerating ${creator.id}/${surface} (${full ? "complete" : "incremental"})`);
      try {
        if (options.deadline && Date.now() >= options.deadline) throw new Error('Run budget exhausted before discovery.');
        for await (const entry of provider.enumerateChannel(creator, surface)) {
          if (options.deadline && Date.now() >= options.deadline) throw new Error('Run budget exhausted during discovery.');
          scanned++;
          if ("error" in entry) {
            malformed = true;
            state.errors.push({ context: `${surface}:${scanned}`, message: entry.error });
            continue;
          }
          nextHighWater[surface] ??= entry.youtubeVideoId;
          surfaceSeen.add(entry.youtubeVideoId);
          if (scanned <= (options.recentRefreshCount ?? 5)) recent.add(entry.youtubeVideoId);
          if (seen.has(entry.youtubeVideoId)) state.duplicatesPrevented++;
          seen.add(entry.youtubeVideoId);
          const old = videos.get(entry.youtubeVideoId);
          const video = {
            ...old, youtubeVideoId: entry.youtubeVideoId,
            discoveries: [...(old?.discoveries ?? []).filter(d => d.surface !== surface), entry.discovery],
            discoveryRaw: sanitizeRaw({ ...old?.discoveryRaw, ...sanitizeRaw(entry.raw) }), presence: "present" as const,
            cacheSchemaVersion: 1, provenance: old?.provenance ?? { kind: 'sanitized-extractor-cache' },
          };
          videos.set(video.youtubeVideoId, video);
          await cache.writeVideo(video);
          if (!full && boundary.visit(entry.youtubeVideoId, known.has(entry.youtubeVideoId))) { stopped = true; break; }
        }
        state.surfaces[surface] = { status: malformed ? "failed" : stopped ? "stopped" : "complete", scanned, ...(malformed ? { error: "Malformed entries were skipped; inventory is incomplete." } : {}) };
        const oldCount = [...videos.values()].filter(v => known.has(v.youtubeVideoId) && v.presence === 'present' && v.discoveries.some(d => d.surface === surface)).length;
        if (surfaceSeen.size === 0 && oldCount > 0 || full && oldCount > 0 && surfaceSeen.size < oldCount * (options.minimumFullInventoryRatio ?? 0)) {
          state.surfaces[surface] = { status: 'failed', scanned, error: 'Suspicious empty/truncated inventory. Reconciliation withheld.' };
          state.errors.push({ context: surface, message: 'Suspicious inventory response; prior presence retained.' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (error instanceof ProviderRateLimited) providerThrottled = true;
        const previouslyPopulated = [...videos.values()].some(v => known.has(v.youtubeVideoId) && v.presence === 'present' && v.discoveries.some(d => d.surface === surface));
        if (error instanceof SurfaceUnavailable && scanned === 0 && !previouslyPopulated) state.surfaces[surface] = { status: "absent", scanned };
        else {
          state.surfaces[surface] = { status: "failed", scanned, error: message };
          state.errors.push({ context: surface, message });
        }
      }
      await cache.writeState(state);
      log(`${surface}: ${scanned} entries, ${state.surfaces[surface]?.status}`);
    }
    if (!seen.size) state.errors.push({ context: 'discovery', message: 'Suspicious empty inventory; reconciliation withheld.' });
    const inventoryComplete = seen.size > 0 && Object.values(state.surfaces).every(s => s.status !== "failed");
    if (inventoryComplete && full) {
      state.initialScanComplete = true;
    }
    // Advance high-waters only after reliable discovery; failed scans can be retried safely.
    await cache.writeState(state);
    const candidates = [...videos.values()].filter(v => {
      if (v.presence === "missing") return false;
      if (full && inventoryComplete && !seen.has(v.youtubeVideoId)) return false;
      if (!v.metadataRaw || v.lastError) return true;
      const age = Date.parse(now()) - Date.parse(v.enrichedAt ?? "1970-01-01");
      return (recent.has(v.youtubeVideoId) && age >= (options.recentFreshnessHours ?? 24) * 3600000)
        || (!!options.refreshStale && age >= (options.staleDays ?? 30) * 86400000);
    }).sort((a, b) => {
      const priority = (id: string) => !known.has(id) ? 0 : recent.has(id) ? 1 : 2;
      return priority(a.youtubeVideoId) - priority(b.youtubeVideoId) || (a.enrichedAt ?? '').localeCompare(b.enrichedAt ?? '') || a.youtubeVideoId.localeCompare(b.youtubeVideoId);
    });
    const selected = providerThrottled ? [] : candidates.slice(0, options.enrichmentLimit ?? candidates.length);
    let cursor = 0;
    let enriched = 0;
    let consecutiveErrors = 0;
    let circuitOpen = providerThrottled;
    const workers = Math.max(1, Math.min(8, options.concurrency ?? 2));
    const workerResults = await Promise.allSettled(Array.from({ length: workers }, async () => {
      let firstRequest = true;
      while (cursor < selected.length && !circuitOpen) {
        if (!firstRequest && options.requestDelayMs) await delay(options.requestDelayMs);
        if (circuitOpen || cursor >= selected.length) break;
        if (options.deadline && Date.now() >= options.deadline) { circuitOpen = true; break; }
        firstRequest = false;
        const video = selected[cursor++]!;
        try {
          const fetched = sanitizeRaw(await provider.fetchVideoMetadata(video.youtubeVideoId));
          if (typeof fetched.title !== 'string' || !fetched.title.trim()) throw new Error('Incomplete metadata response; good prior metadata retained.');
          if (fetched.channel_id && fetched.channel_id !== creator.channelId) throw new Error('Metadata belongs to an unexpected channel.');
          video.metadataRaw = sanitizeRaw({ ...video.metadataRaw, ...fetched });
          delete video.seedMetadata;
          video.provenance = { kind: 'sanitized-extractor-cache' };
          video.enrichedAt = now(); video.extractorVersion = version; delete video.lastError;
          enriched++;
          consecutiveErrors = 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          video.lastError = { at: now(), message };
          state!.errors.push({ context: video.youtubeVideoId, message });
          consecutiveErrors++;
          if (error instanceof ProviderRateLimited || consecutiveErrors >= (options.metadataErrorLimit ?? 8)) circuitOpen = true;
        }
        await cache.writeVideo(video);
        if ((enriched + state!.errors.length) % 25 === 0) { await cache.writeState(state!); log(`Metadata: ${enriched}/${selected.length} enriched`); }
      }
    }));
    const failedWorker = workerResults.find(result => result.status === "rejected");
    if (failedWorker?.status === "rejected") throw failedWorker.reason;
    if (circuitOpen) state.errors.push({ context: "enrichment", message: "Stopped after provider throttling or repeated metadata failures. Cached successes remain resumable." });
    const newest = [...videos.values()].map(normalizeVideo).filter(v => v.publishedAt).sort((a,b) => b.publishedAt!.localeCompare(a.publishedAt!))[0];
    state.newestKnownVideoId = newest?.youtubeVideoId ?? nextHighWater.videos ?? previous?.newestKnownVideoId;
    state.newestKnownPublishedAt = newest?.publishedAt ?? previous?.newestKnownPublishedAt;
    const pendingRequired = candidates.slice(selected.length).some(v => !v.metadataRaw || v.lastError);
    const limited = pendingRequired || circuitOpen;
    state.outcome = state.errors.length || limited ? (videos.size ? "partial" : "failed") : "successful";
    if (state.outcome === "successful") {
      state.lastSyncCompletedAt = now();
      if (inventoryComplete) state.highWater = { ...state.highWater, ...nextHighWater };
      if (full && inventoryComplete) {
        for (const video of videos.values()) {
          video.presence = seen.has(video.youtubeVideoId) ? 'present' : 'missing';
          if (video.presence === 'missing') await cache.writeVideo(video);
        }
        state.lastFullReconcileAt = now(); (state as any).bootstrapRequiresFullDiscovery = false;
      }
    }
    await cache.writeState(state);
    log(`${creator.id}: ${videos.size} cached, ${enriched} enriched this run, ${state.outcome}`);
    return state;
  } catch (error) {
    if (state) {
      state.outcome = "failed";
      state.errors.push({ context: "sync", message: error instanceof Error ? error.message : String(error) });
      await cache.writeState(state);
    }
    throw error;
  } finally { await unlock(); }
}
