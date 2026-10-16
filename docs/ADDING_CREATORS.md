# Add a creator through configuration

Add a record to `content/creators.json` with a unique stable `id`, display name, verified stable YouTube `channelId`, canonical channel URL, optional handle, enabled flag, credential (empty if unknown), verification URL and source/provenance URL. Dr. Rowe’s existing reference is preserved. Do not invent credentials.

```json
{
  "id": "example-creator",
  "displayName": "Verified display name",
  "channelId": "<verified UC channel ID>",
  "canonicalUrl": "https://www.youtube.com/channel/<verified UC channel ID>",
  "handle": "@verified-handle",
  "credential": "",
  "verificationUrl": "",
  "sourceUrl": "https://www.youtube.com/channel/<verified UC channel ID>",
  "enabled": true
}
```

Replace placeholders with verified source values before running. Use `npm run content:update -- --creator example-creator --mode full --dry-run` to inspect a bounded attempt, then run without dry-run. The cache is initialized under that channel’s directory. If the inventory needs more than the per-run metadata cap, progress remains in the durable cache and later runs enrich the rest; public publication waits for reliable discovery and required metadata. Commit that public configuration and the allowlisted durable records/checkpoints in the new repository. `creator: all` handles enabled creators sequentially under one shared run budget.

The UI, scanner, normalizer and classifier need no rewrite. Creator labels/filters come from the runtime manifest; a selector appears when there is more than one enabled creator. Manual corrections remain in `overrides.json` and are applied after automatic classification. For a novel vocabulary, change deterministic rules deliberately, increase the classifier version and verify offline before publishing. No transcripts or AI calls are required.
