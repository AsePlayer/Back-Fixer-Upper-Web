import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { ChannelSurface, Creator } from "../../src/content/model";
import { type ChannelContentProvider, type DiscoveredVideo, type DiscoveryIssue, type RawMetadata, ProviderRateLimited, SurfaceUnavailable, channelUrl } from "./provider";
import { sanitizeRaw } from './sanitize';
const common = ["--ignore-config", "--no-update", "--simulate", "--skip-download", "--no-write-info-json", "--no-write-thumbnail", "--no-write-subs", "--no-write-auto-subs", "--no-progress", "--socket-timeout", "20", "--retries", "2", "--extractor-retries", "2", "--encoding", "utf-8"];
const string = (v: unknown) => typeof v === "string" ? v : undefined;
// Stable source fields are allowlisted by sanitizeRaw, never direct media URLs or credentials.
export class YtDlpProvider implements ChannelContentProvider {
  constructor(private executable = process.env.YT_DLP_PATH || "yt-dlp", private discoveryTimeoutMs = 180000, private metadataTimeoutMs = 60000) {}
  private async *lines(args: string[], timeoutMs = this.metadataTimeoutMs): AsyncGenerator<string> {
    const child = spawn(this.executable, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", data => { stderr = (stderr + data).slice(-12000); });
    const completion = new Promise<{ code: number | null; error?: Error }>(resolve => {
      child.on("error", error => resolve({ code: null, error }));
      child.on("close", code => resolve({ code }));
    });
    const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
    let ended = false;
    try {
      for await (const line of reader) if (line.trim()) yield line;
      const result = await completion;
      ended = true;
      if (timedOut) throw new Error(`yt-dlp timed out after ${timeoutMs} ms; inventory incomplete.`);
      if (result.error) throw new Error(`Cannot run yt-dlp: ${result.error.message}. Install it or set YT_DLP_PATH.`);
      if (/HTTP Error (?:429|403)|too many requests|sign in to confirm you.re not a bot|content is not available on this app/i.test(stderr)) throw new ProviderRateLimited(stderr.trim());
      if (result.code !== 0 || /(^|\n)ERROR:/.test(stderr)) {
        if (/does not have a (?:shorts|streams|live|videos) tab/i.test(stderr)) throw new SurfaceUnavailable(stderr.trim());
        throw new Error(`yt-dlp exited ${result.code}: ${stderr.trim()}`);
      }
      if (stderr.trim()) console.warn(stderr.trim());
    } finally {
      clearTimeout(timer);
      reader.close();
      // Async iterator return stops the extractor at the incremental boundary.
      if (!ended) { child.kill(); await completion; }
    }
  }
  private async json(args: string[]): Promise<RawMetadata> {
    let result: RawMetadata | undefined;
    for await (const line of this.lines(args)) result = JSON.parse(line);
    if (!result) throw new Error("yt-dlp returned no metadata.");
    return result;
  }
  async version() {
    let version = "";
    for await (const line of this.lines(["--ignore-config", "--version"])) version = line;
    return version;
  }
  async resolveChannel(input: string) {
    const url = channelUrl(input);
    const raw = await this.json([...common, "--flat-playlist", "--playlist-end", "1", "--dump-single-json", url]);
    const channelId = string(raw.channel_id) ?? string(raw.id);
    if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) throw new Error("Extractor did not resolve a stable YouTube channel ID.");
    return {
      channelId,
      canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
      displayName: string(raw.channel) ?? string(raw.uploader) ?? channelId,
      handle: string(raw.uploader_id)?.startsWith("@") ? string(raw.uploader_id) : undefined,
    };
  }
  async *enumerateChannel(channel: Creator, surface: ChannelSurface): AsyncGenerator<DiscoveredVideo | DiscoveryIssue> {
    let order = 0;
    for await (const line of this.lines([...common, "--flat-playlist", "--lazy-playlist", "--dump-json", `${channel.canonicalUrl}/${surface}`], this.discoveryTimeoutMs)) {
      let raw: RawMetadata;
      try {
        raw = JSON.parse(line);
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Expected a JSON object");
      } catch (error) { yield { error: `Malformed ${surface} JSON: ${error instanceof Error ? error.message : error}` }; continue; }
      const videoId = string(raw.id);
      if (!videoId || !/^[\w-]{11}$/.test(videoId)) { yield { error: `Malformed ${surface} video ID at ${order + 1}.` }; continue; }
      if (raw.channel_id && raw.channel_id !== channel.channelId) { yield { error: `Unexpected channel ID on ${surface} for ${videoId}.` }; continue; }
      yield { youtubeVideoId: videoId, discovery: { surface, kind: surface === "shorts" ? "short" : surface === "streams" ? "stream" : "video", order: ++order }, raw: sanitizeRaw(raw) };
    }
  }
  async fetchVideoMetadata(videoId: string) {
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error("Invalid YouTube video ID.");
    const raw = await this.json([...common, "--no-playlist", "--ignore-no-formats-error", "--dump-json", `https://www.youtube.com/watch?v=${videoId}`]);
    if (raw.id !== videoId) throw new Error(`Metadata ID mismatch for ${videoId}.`);
    return sanitizeRaw(raw);
  }
}
