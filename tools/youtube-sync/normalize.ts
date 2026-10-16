import type { SourceMetadata } from "../../src/content/model";
import type { CachedVideo } from "./cache";
const str = (v: unknown) => typeof v === "string" && v.length ? v : undefined;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : undefined;
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
export function normalizeVideo(video: CachedVideo): SourceMetadata {
  if (video.seedMetadata) return { ...video.seedMetadata, discoveries: video.discoveries };
  const raw = { ...video.discoveryRaw, ...video.metadataRaw };
  const date = str(raw.upload_date) ?? str(raw.release_date);
  const publishedAt = date && /^\d{8}$/.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : undefined;
  const kind = video.discoveries.some(d => d.kind === "short") ? "short" : video.discoveries.some(d => d.kind === "stream") ? "stream" : video.discoveries.some(d => d.kind === "video") ? "video" : "unknown";
  return {
    youtubeVideoId: video.youtubeVideoId, title: str(raw.title) ?? str(video.discoveryRaw.title), description: str(raw.description),
    tags: strings(raw.tags), categories: strings(raw.categories), publishedAt,
    releaseTimestamp: num(raw.release_timestamp), durationSeconds: num(raw.duration),
    url: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
    channelId: str(raw.channel_id) ?? str(raw.playlist_channel_id), channelName: str(raw.channel) ?? str(raw.uploader) ?? str(raw.playlist_channel), handle: str(raw.uploader_id) ?? str(raw.playlist_uploader_id),
    thumbnailUrl: str(raw.thumbnail) ?? (Array.isArray(raw.thumbnails) ? str(raw.thumbnails.at(-1)?.url) : undefined), availability: str(raw.availability), liveStatus: str(raw.live_status),
    contentKind: kind, discoveries: [...video.discoveries].sort((a,b) => a.surface.localeCompare(b.surface)),
  };
}
