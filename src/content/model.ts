// Provider-independent content model. No yt-dlp or Node imports belong here.
export type ContentKind = "video" | "short" | "stream" | "unknown";
export type ChannelSurface = "videos" | "shorts" | "streams";
export const bodyRegions = [
  "neck", "head", "jaw", "shoulders", "upper_back", "mid_back", "lower_back",
  "ribs_chest", "pelvis_si", "hips", "glutes", "arms", "elbows", "forearms",
  "wrists", "hands", "thighs", "hamstrings", "knees", "calves", "ankles", "feet", "whole_body",
] as const;
export type BodyRegion = (typeof bodyRegions)[number];
export const intents = ["stretch", "mobility", "pain_relief", "strengthening", "stability", "posture", "nerve_related", "warm_up", "recovery", "self_massage", "education"] as const;
export type Intent = (typeof intents)[number];
export const topics = ["sciatica", "piriformis", "scoliosis", "plantar_fasciitis", "carpal_tunnel", "headaches", "hip_flexor", "si_joint", "rounded_shoulders"] as const;
export type Topic = (typeof topics)[number];
export interface Creator {
  id: string;
  displayName: string;
  canonicalUrl: string;
  channelId?: string;
  handle?: string;
  credential: string;
  verificationUrl: string;
  sourceUrl: string;
  enabled: boolean;
}
export interface Discovery {
  surface: ChannelSurface;
  kind: ContentKind;
  order: number;
}
export interface SourceMetadata {
  youtubeVideoId: string;
  title?: string;
  description?: string;
  tags: string[];
  categories: string[];
  publishedAt?: string;
  releaseTimestamp?: number;
  durationSeconds?: number;
  url: string;
  channelId?: string;
  channelName?: string;
  handle?: string;
  thumbnailUrl?: string;
  availability?: string;
  liveStatus?: string;
  contentKind: ContentKind;
  discoveries: Discovery[];
}
export interface Match {
  dimension: "bodyRegions" | "intents" | "topics";
  label: string;
  score: number;
  matchedTerms: string[];
  fields: string[];
}
export interface Classification {
  classifierVersion: number;
  bodyRegions: BodyRegion[];
  intents: Intent[];
  topics: Topic[];
  evidence: Match[];
  confidence: "unclassified" | "weak" | "strong";
}
export interface ManualOverride {
  bodyRegions?: BodyRegion[];
  intents?: Intent[];
  topics?: Topic[];
  reason: string;
}
export interface CatalogVideo {
  youtubeVideoId: string;
  creatorId: string;
  sourceMetadata: SourceMetadata;
  automatic: Classification;
  manualOverride?: ManualOverride;
  derived: Classification;
  presence: "present" | "missing";
  metadataStatus: "complete" | "partial" | "missing";
}
export interface ContentCatalog {
  schemaVersion: 1;
  classifierVersion: number;
  revision: string;
  creators: Creator[];
  videos: CatalogVideo[];
}
