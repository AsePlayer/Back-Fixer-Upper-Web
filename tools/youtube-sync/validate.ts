import { bodyRegions, intents, topics, type ContentCatalog, type ManualOverride } from "../../src/content/model";
export function validateOverrides(input: unknown): Record<string, ManualOverride> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Overrides must be an object keyed by YouTube video ID.");
  for (const [id, value] of Object.entries(input)) {
    if (!/^[\w-]{11}$/.test(id) || !value || typeof value !== "object") throw new Error(`Invalid override ${id}.`);
    const override = value as ManualOverride;
    if (typeof override.reason !== "string" || !override.reason.trim()) throw new Error(`Override ${id} needs a reason.`);
    for (const [key, allowed] of [["bodyRegions", bodyRegions], ["intents", intents], ["topics", topics]] as const) {
      const labels = override[key];
      if (labels !== undefined && (!Array.isArray(labels) || labels.some(label => !(allowed as readonly string[]).includes(label)) || new Set(labels).size !== labels.length)) throw new Error(`Invalid ${key} override for ${id}.`);
    }
  }
  return input as Record<string, ManualOverride>;
}
export function validateCatalog(catalog: ContentCatalog) {
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.videos) || !Array.isArray(catalog.creators)) throw new Error("Unsupported catalog shape.");
  const creators = new Set(catalog.creators.map(c => c.id));
  if (creators.size !== catalog.creators.length) throw new Error("Duplicate creator IDs.");
  const ids = new Set<string>();
  for (const video of catalog.videos) {
    if (!/^[\w-]{11}$/.test(video.youtubeVideoId) || ids.has(video.youtubeVideoId)) throw new Error(`Duplicate/invalid video ${video.youtubeVideoId}.`);
    ids.add(video.youtubeVideoId);
    if (!creators.has(video.creatorId)) throw new Error(`Missing creator for ${video.youtubeVideoId}.`);
    if (video.sourceMetadata.youtubeVideoId !== video.youtubeVideoId || video.sourceMetadata.url !== `https://www.youtube.com/watch?v=${video.youtubeVideoId}`) throw new Error(`Identity mismatch for ${video.youtubeVideoId}.`);
    if (!["video", "short", "stream", "unknown"].includes(video.sourceMetadata.contentKind)) throw new Error(`Invalid kind for ${video.youtubeVideoId}.`);
    for (const classification of [video.automatic, video.derived]) {
      for (const [key, allowed] of [["bodyRegions", bodyRegions], ["intents", intents], ["topics", topics]] as const) {
        if (!Array.isArray(classification[key]) || classification[key].some(label => !(allowed as readonly string[]).includes(label))) throw new Error(`Invalid ${key} for ${video.youtubeVideoId}.`);
      }
      if (classification.classifierVersion !== catalog.classifierVersion) throw new Error(`Classifier version mismatch for ${video.youtubeVideoId}.`);
    }
  }
  return { creators: creators.size, videos: ids.size, classifierVersion: catalog.classifierVersion };
}
