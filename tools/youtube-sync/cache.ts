import { mkdir, readFile, readdir, rename, writeFile, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { ChannelSurface, Creator, Discovery } from "../../src/content/model";
import type { RawMetadata } from "./provider";
export interface CachedVideo {
  cacheSchemaVersion?: number;
  seedMetadata?: import('../../src/content/model').SourceMetadata;
  provenance?: { kind: string; [key: string]: unknown };
  youtubeVideoId: string;
  discoveries: Discovery[];
  discoveryRaw: RawMetadata;
  metadataRaw?: RawMetadata;
  enrichedAt?: string;
  extractorVersion?: string;
  presence: "present" | "missing";
  lastError?: { at: string; message: string };
}
export interface SyncState {
  channelId: string;
  canonicalUrl: string;
  initialScanComplete: boolean;
  lastSyncStartedAt?: string;
  lastSyncCompletedAt?: string;
  lastFullReconcileAt?: string;
  newestKnownVideoId?: string;
  newestKnownPublishedAt?: string;
  highWater: Partial<Record<ChannelSurface, string>>;
  extractorVersion?: string;
  catalogVersion: number;
  outcome: "running" | "successful" | "partial" | "failed";
  surfaces: Partial<Record<ChannelSurface, { status: "complete" | "stopped" | "absent" | "failed"; scanned: number; error?: string }>>;
  errors: { context: string; message: string }[];
  duplicatesPrevented: number;
}
export async function readJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
}
export async function writeJson(path: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  try { if (await readFile(path, "utf8") === text) return; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, "utf8");
  // Windows scanners/readers can briefly hold a destination file open. Never
  // delete the destination: retry the atomic replacement a bounded number of times.
  for (let attempt = 0; ; attempt++) {
    try { await rename(temporary, path); return; }
    catch (error) {
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await delay(50 * 2 ** attempt);
    }
  }
}
export class ChannelCache {
  readonly directory: string;
  constructor(root: string, channelId: string) {
    if (!/^UC[\w-]{22}$/.test(channelId)) throw new Error("Invalid channel cache ID.");
    this.directory = join(root, channelId);
  }
  async prepare() { await mkdir(join(this.directory, "videos"), { recursive: true }); }
  async lock() {
    const path = join(this.directory, "sync.lock");
    const handle = await open(path, "wx").catch(error => { throw new Error(`Channel is locked (${path}). After checking no sync is running, remove a stale lock. ${error.message}`); });
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    return async () => { await handle.close(); await unlink(path); };
  }
  async readState() { return readJson<SyncState>(join(this.directory, "sync-state.json")); }
  async writeState(state: SyncState) { await writeJson(join(this.directory, "sync-state.json"), state); }
  async readCreator() { return readJson<Creator>(join(this.directory, "channel.json")); }
  async writeCreator(creator: Creator) { await writeJson(join(this.directory, "channel.json"), creator); }
  async readVideos() {
    const files = (await readdir(join(this.directory, "videos"))).filter(file => /^[\w-]{11}\.json$/.test(file)).sort();
    const records = await Promise.all(files.map(file => readJson<CachedVideo>(join(this.directory, "videos", file))));
    for(let i=0;i<records.length;i++) {
      const record=records[i];
      if(!record || `${record.youtubeVideoId}.json`!==files[i])throw new Error('Source cache filename/identity mismatch.');
      if(record.cacheSchemaVersion!==undefined&&record.cacheSchemaVersion!==1)throw new Error('Unsupported durable source cache version. Migrate explicitly before generation.');
    }
    return new Map(records.filter((v): v is CachedVideo => !!v).map(v => [v.youtubeVideoId, v]));
  }
  async writeVideo(video: CachedVideo) {
    if (!/^[\w-]{11}$/.test(video.youtubeVideoId)) throw new Error("Invalid cached video ID.");
    await writeJson(join(this.directory, "videos", `${video.youtubeVideoId}.json`), video);
  }
}
