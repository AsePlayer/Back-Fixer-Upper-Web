import type { ChannelSurface, Creator, Discovery } from "../../src/content/model";
export type RawMetadata = Record<string, unknown>;
export interface DiscoveredVideo {
  youtubeVideoId: string;
  discovery: Discovery;
  raw: RawMetadata;
}
export interface DiscoveryIssue { error: string }
export interface ChannelContentProvider {
  version(): Promise<string>;
  resolveChannel(url: string): Promise<Pick<Creator, "channelId" | "canonicalUrl" | "displayName" | "handle">>;
  enumerateChannel(channel: Creator, surface: ChannelSurface): AsyncIterable<DiscoveredVideo | DiscoveryIssue>;
  fetchVideoMetadata(youtubeVideoId: string): Promise<RawMetadata>;
}
export class SurfaceUnavailable extends Error {}
export class ProviderRateLimited extends Error {}
export function channelUrl(input: string): string {
  const value = input.trim();
  const url = new URL(value.startsWith("@") ? `https://www.youtube.com/${value}` : /^https?:\/\//.test(value) ? value : `https://${value}`);
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname.toLowerCase()) || !["http:", "https:"].includes(url.protocol)) throw new Error("Use a YouTube channel URL or @handle.");
  const parts = url.pathname.split("/").filter(Boolean);
  const path = parts[0]?.startsWith("@") ? parts.slice(0, 1) : ["channel", "c", "user"].includes(parts[0] ?? "") ? parts.slice(0, 2) : [];
  if (!path.length || (path[0]?.startsWith("@") ? path[0].length < 2 : path.length !== 2)) throw new Error("Use a YouTube channel URL or @handle.");
  return `https://www.youtube.com/${path.join("/")}`;
}
