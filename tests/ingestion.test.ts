import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { classify, applyOverride } from "../src/content/classification/classify";
import type { CatalogVideo, ChannelSurface, ContentCatalog, Creator, SourceMetadata } from "../src/content/model";
import { youtubeId as youtubeVideoId } from "../src/domain/urls.js";


import { ChannelCache, writeJson } from "../tools/youtube-sync/cache";
import { IncrementalBoundary, syncChannel } from "../tools/youtube-sync/channelScanner";

import { normalizeVideo } from "../tools/youtube-sync/normalize";
import { type ChannelContentProvider, type DiscoveredVideo, type DiscoveryIssue, type RawMetadata, ProviderRateLimited, channelUrl } from "../tools/youtube-sync/provider";
import { validateCatalog, validateOverrides } from "../tools/youtube-sync/validate";
const creator: Creator = { id: "fixture", displayName: "Fixture creator", channelId: `UC${"a".repeat(22)}`, canonicalUrl: `https://www.youtube.com/channel/UC${"a".repeat(22)}`, credential: "", verificationUrl: "", sourceUrl: "", enabled: true };
const vid = (n: number) => `video${String(n).padStart(6, "0")}`;
const source = (id = vid(1), title = "Lower Back and Hip Mobility Stretches"): SourceMetadata => ({ youtubeVideoId: id, title, tags: [], categories: [], url: `https://www.youtube.com/watch?v=${id}`, contentKind: "video", discoveries: [{ surface: "videos", kind: "video", order: 1 }] });
const item = (id = vid(1), title?: string): CatalogVideo => { const metadata = source(id, title); const automatic = classify(metadata); return { youtubeVideoId: id, creatorId: creator.id, sourceMetadata: metadata, automatic, derived: automatic, presence: "present", metadataStatus: "complete" }; };
const catalog = (videos: CatalogVideo[], revision: string): ContentCatalog => ({ schemaVersion: 1, classifierVersion: 1, revision, creators: [creator], videos });
class FixtureProvider implements ChannelContentProvider {
  feed: Partial<Record<ChannelSurface, string[]>> = { videos: [vid(1), vid(2), vid(3)] };
  fetched: string[] = [];
  enumerated: Partial<Record<ChannelSurface, number>> = {};
  failures = new Set<string>();
  brokenSurface?: ChannelSurface;
  breakAt = 0;
  malformed = false;
  rateLimited = false;
  rateLimitedDiscovery = false;
  async version() { return "fixture-1"; }
  async resolveChannel() { return creator; }
  async *enumerateChannel(_creator: Creator, surface: ChannelSurface): AsyncGenerator<DiscoveredVideo | DiscoveryIssue> {
    this.enumerated[surface] = 0;
    if (this.rateLimitedDiscovery) throw new ProviderRateLimited("HTTP Error 429: Too Many Requests");
    if (this.malformed && surface === "videos") yield { error: "Malformed fixture ID" };
    for (const id of this.feed[surface] ?? []) {
      if (surface === this.brokenSurface && this.enumerated[surface]! >= this.breakAt) throw new Error("Network interrupted");
      this.enumerated[surface]!++;
      yield { youtubeVideoId: id, discovery: { surface, kind: surface === "shorts" ? "short" : surface === "streams" ? "stream" : "video", order: this.enumerated[surface]! }, raw: { id, title: "Lower Back Stretch", duration: 45 } };
    }
  }
  async fetchVideoMetadata(id: string): Promise<RawMetadata> {
    this.fetched.push(id);
    if (this.rateLimited) throw new ProviderRateLimited("HTTP Error 429: Too Many Requests");
    if (this.failures.has(id)) throw new Error("Unavailable fixture video");
    return { id, title: "Lower Back Stretch", description: "A lumbar stretch", upload_date: "20261010", tags: ["lumbar"] };
  }
}
async function temporary(fn: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "cb02-"));
  try { await fn(directory); }
  finally {
    const target = await realpath(directory);
    assert.equal(dirname(target), await realpath(tmpdir())); assert.match(basename(target), /^cb02-/);
    await rm(target, { recursive: true, force: true });
  }
}
const fixed = () => "2026-10-10T12:00:00.000Z";
test("external identity canonicalizes watch/Shorts/live/embed links and channel forms", () => {
  for (const url of ["https://youtube.com/watch?v=t1aA2JEaRpw&list=abc", "https://youtu.be/t1aA2JEaRpw", "https://m.youtube.com/shorts/t1aA2JEaRpw", "https://www.youtube.com/live/t1aA2JEaRpw", "https://youtube.com/embed/t1aA2JEaRpw"]) assert.equal(youtubeVideoId(url), "t1aA2JEaRpw");
  assert.equal(youtubeVideoId("https://youtube.com.evil.test/watch?v=t1aA2JEaRpw"), undefined);
  assert.equal(channelUrl("@fixture"), "https://www.youtube.com/@fixture");
  assert.equal(channelUrl("https://youtube.com/c/fixture/shorts?x=1"), "https://www.youtube.com/c/fixture");
  assert.throws(() => channelUrl("https://evil.test/channel/anything"));
});
test("classification is multi-dimensional, explainable and resists generic description boilerplate", () => {
  const result = classify({ ...source(), tags: ["sciatica", "strengthening"] });
  assert.deepEqual(result.bodyRegions, ["lower_back", "hips"]);
  assert.ok(result.intents.includes("stretch") && result.intents.includes("mobility") && result.intents.includes("strengthening"));
  assert.deepEqual(result.topics, ["sciatica"]);
  assert.ok(result.evidence.some(e => e.label === "lower_back" && e.score === 6 && e.matchedTerms.includes("lower back")));
  assert.deepEqual(classify({ ...source(vid(2), "Wrist Stretch"), description: "Our clinic also treats neck, lower back and sciatica pain." }).bodyRegions, ["wrists"]);
  assert.equal(classify(source(vid(3), "Quick relief")).bodyRegions.length, 0);
  assert.deepEqual(classify(source(vid(4), "Hip and Lower-Back Stretches")).bodyRegions, ["lower_back", "hips"]);
});
test("discovery deduplicates surfaces, records explicit Shorts evidence, and does not guess from duration", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.feed.shorts = [vid(1)];
  const cache = new ChannelCache(directory, creator.channelId!);
  const state = await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  const videos = await cache.readVideos();
  assert.equal(videos.size, 3); assert.equal(provider.fetched.length, 3); assert.equal(state.duplicatesPrevented, 1);
  assert.equal(normalizeVideo(videos.get(vid(1))!).contentKind, "short");
  assert.equal(normalizeVideo(videos.get(vid(2))!).contentKind, "video");
  assert.equal(normalizeVideo({ youtubeVideoId: vid(9), discoveries: [], discoveryRaw: { duration: 30 }, presence: "present" }).contentKind, "unknown");
}));
test("one malformed discovery preserves other entries but cannot claim a complete inventory", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.malformed = true;
  const cache = new ChannelCache(directory, creator.channelId!);
  const state = await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  assert.equal((await cache.readVideos()).size, 3); assert.equal(provider.fetched.length, 3);
  assert.equal(state.initialScanComplete, false); assert.equal(state.outcome, "partial");
}));
test("incremental pass tolerates a pinned known item, adds new items and stops after high-water plus known streak", async () => temporary(async directory => {
  const repeated = new IncrementalBoundary(vid(1));
  for (let i = 0; i < 30; i++) assert.equal(repeated.visit(vid(1), true), false);
  const provider = new FixtureProvider(); provider.feed.videos = Array.from({ length: 40 }, (_,i) => vid(i + 1));
  const cache = new ChannelCache(directory, creator.channelId!);
  await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  provider.fetched = []; provider.feed.videos = [vid(35), vid(100), vid(101), ...provider.feed.videos];
  const state = await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  assert.equal(state.surfaces.videos?.status, "stopped"); assert.equal(provider.enumerated.videos, 23);
  assert.deepEqual(provider.fetched.sort(), [vid(100), vid(101)]); assert.equal((await cache.readVideos()).size, 42);
}));
test("interrupted inventory and partial enrichment resume without refetching successes or claiming completion", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.brokenSurface = "videos"; provider.breakAt = 2; provider.failures.add(vid(2));
  const cache = new ChannelCache(directory, creator.channelId!);
  const failed = await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  assert.equal(failed.initialScanComplete, false); assert.equal(failed.lastSyncCompletedAt, undefined); assert.equal(failed.outcome, "partial");
  provider.brokenSurface = undefined; provider.failures.clear(); provider.fetched = [];
  const resumed = await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  assert.equal(resumed.initialScanComplete, true); assert.equal(resumed.outcome, "successful");
  assert.deepEqual(provider.fetched.sort(), [vid(2), vid(3)]);
}));
test("recent refresh is bounded; full reconciliation retains missing items and failed tabs cannot mark them missing", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.feed.videos = Array.from({ length: 30 }, (_,i) => vid(i + 1));
  const cache = new ChannelCache(directory, creator.channelId!);
  await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  provider.fetched = [];
  await syncChannel(provider, cache, creator, { now: () => "2026-10-12T12:00:00.000Z", recentRefreshCount: 2, log: () => {} });
  assert.deepEqual(provider.fetched.sort(), [vid(1), vid(2)]);
  provider.feed.videos = [vid(1), vid(2)]; provider.brokenSurface = "videos"; provider.breakAt = 1;
  await syncChannel(provider, cache, creator, { full: true, now: fixed, log: () => {} });
  assert.equal((await cache.readVideos()).get(vid(3))!.presence, "present");
  provider.brokenSurface = undefined;
  await syncChannel(provider, cache, creator, { full: true, now: fixed, log: () => {} });
  assert.equal((await cache.readVideos()).get(vid(3))!.presence, "missing");
  assert.equal((await cache.readVideos()).size, 30);
}));
test("repeated metadata failures stop boundedly and leave untouched records resumable", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.feed.videos = Array.from({ length: 30 }, (_,i) => vid(i + 1)); provider.feed.videos.forEach(id => provider.failures.add(id));
  const cache = new ChannelCache(directory, creator.channelId!);
  const state = await syncChannel(provider, cache, creator, { concurrency: 1, metadataErrorLimit: 3, now: fixed, log: () => {} });
  assert.equal(provider.fetched.length, 3); assert.equal(state.outcome, "partial"); assert.equal(state.lastSyncCompletedAt, undefined);
  assert.equal((await cache.readVideos()).size, 30);
}));
test("provider throttling stops enrichment immediately rather than exhausting the library", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.rateLimited = true;
  const cache = new ChannelCache(directory, creator.channelId!);
  const state = await syncChannel(provider, cache, creator, { concurrency: 1, now: fixed, log: () => {} });
  assert.equal(provider.fetched.length, 1); assert.equal(state.outcome, "partial");
  assert.equal(state.initialScanComplete, true); assert.equal(state.lastSyncCompletedAt, undefined);
  assert.match(state.errors[0]!.message, /429/);
}));
test("throttled discovery skips remaining surfaces and makes no detailed requests", async () => temporary(async directory => {
  const provider = new FixtureProvider(); provider.rateLimitedDiscovery = true;
  const cache = new ChannelCache(directory, creator.channelId!);
  const state = await syncChannel(provider, cache, creator, { now: fixed, log: () => {} });
  assert.equal(provider.enumerated.shorts, undefined); assert.equal(provider.fetched.length, 0);
  assert.equal(state.initialScanComplete, false); assert.equal(state.outcome, "failed");
}));

test('removed high-water scans the whole surface; empty or truncated full responses retain inventory and success markers',async()=>temporary(async directory=>{
  const provider=new FixtureProvider();provider.feed.videos=Array.from({length:40},(_,i)=>vid(i+1));
  const cache=new ChannelCache(directory,creator.channelId!);await syncChannel(provider,cache,creator,{now:fixed,log:()=>{}});
  provider.feed.videos=[vid(90),...provider.feed.videos.slice(1)];
  const incremental=await syncChannel(provider,cache,creator,{now:fixed,log:()=>{}});assert.equal(incremental.surfaces.videos?.status,'complete');assert.equal(provider.enumerated.videos,40);assert.equal((await cache.readVideos()).get(vid(1))?.presence,'present');
  const lastFull=incremental.lastFullReconcileAt;provider.feed.videos=[];
  const empty=await syncChannel(provider,cache,creator,{full:true,minimumFullInventoryRatio:.8,now:()=> '2026-10-12T12:00:00.000Z',log:()=>{}});assert.equal(empty.outcome,'partial');assert.equal(empty.lastFullReconcileAt,lastFull);
  provider.feed.videos=Array(40).fill(vid(90));const duplicateTruncation=await syncChannel(provider,cache,creator,{full:true,minimumFullInventoryRatio:.8,now:fixed,log:()=>{}});assert.equal(duplicateTruncation.outcome,'partial');assert((await cache.readVideos()).values().every(v=>v.presence==='present'));
}));
test('metadata failure after reliable full discovery cannot infer absence or advance full success',async()=>temporary(async directory=>{
  const provider=new FixtureProvider(),cache=new ChannelCache(directory,creator.channelId!);const first=await syncChannel(provider,cache,creator,{now:fixed,log:()=>{}});
  provider.feed.videos=[vid(1),vid(90),vid(2)];provider.failures.add(vid(90));
  const partial=await syncChannel(provider,cache,creator,{full:true,concurrency:1,now:()=> '2026-10-12T12:00:00.000Z',log:()=>{}});
  assert.equal(partial.outcome,'partial');assert.equal(partial.lastFullReconcileAt,first.lastFullReconcileAt);assert.equal(partial.lastSyncCompletedAt,first.lastSyncCompletedAt);assert.equal((await cache.readVideos()).get(vid(3))?.presence,'present');
}));
test('bounded rotating stale refresh does not monopolize a run or erase good metadata with nulls',async()=>temporary(async directory=>{
  const provider=new FixtureProvider(),cache=new ChannelCache(directory,creator.channelId!);await syncChannel(provider,cache,creator,{now:fixed,log:()=>{}});
  const previous=provider.fetchVideoMetadata.bind(provider);provider.fetchVideoMetadata=async id=>({...await previous(id),description:null,tags:undefined,url:'https://media.invalid/expiring',http_headers:{Authorization:'never persist'}});
  provider.fetched=[];
  const options={refreshStale:true,staleDays:30,enrichmentLimit:1,recentRefreshCount:0,concurrency:1,now:()=> '2026-11-12T12:00:00.000Z',log:()=>{}};
  const first=await syncChannel(provider,cache,creator,options);assert.equal(first.outcome,'successful');assert.deepEqual(provider.fetched,[vid(1)]);
  const raw=(await cache.readVideos()).get(vid(1))?.metadataRaw;assert.equal(raw?.description,'A lumbar stretch');assert.equal(raw?.url,undefined);assert.equal(raw?.http_headers,undefined);
  provider.fetched=[];await syncChannel(provider,cache,creator,options);assert.deepEqual(provider.fetched,[vid(2)]);
}));
