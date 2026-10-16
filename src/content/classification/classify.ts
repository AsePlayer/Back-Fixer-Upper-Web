import { bodyRegions, intents, topics, type Classification, type ManualOverride, type Match, type SourceMetadata } from "../model";
import { CLASSIFIER_VERSION, regionTerms, intentTerms, topicTerms } from "./rules";
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function classify(source: SourceMetadata): Classification {
  const fields = [
    { name: "title", text: normalize(source.title ?? ""), weight: 6 },
    { name: "tags", text: source.tags.map(normalize).join(" | "), weight: 4 },
    // Boilerplate descriptions can list a creator's entire practice. Use them only
    // as secondary evidence; one description keyword cannot assign a region.
    { name: "description", text: normalize((source.description ?? "").slice(0, 1200)), weight: 1 },
    { name: "categories", text: source.categories.map(normalize).join(" | "), weight: 2 },
  ];
  const evidence: Match[] = [];
  function match(dimension: Match["dimension"], rules: Record<string, string[]>) {
    for (const [label, terms] of Object.entries(rules)) {
      const found = new Set<string>();
      const matchedFields = new Set<string>();
      let score = 0;
      for (const field of fields) {
        const hits = terms.filter(term => (` ${field.text} `).includes(` ${normalize(term)} `));
        if (hits.length) {
          score += field.weight; // Synonyms within one field don't inflate confidence.
          hits.forEach(term => found.add(term));
          matchedFields.add(field.name);
        }
      }
      if (score >= 4) evidence.push({ dimension, label, score, matchedTerms: [...found].sort(), fields: [...matchedFields] });
    }
  }
  match("bodyRegions", regionTerms); match("intents", intentTerms); match("topics", topicTerms);
  // Generic back titles remain broadly browsable without treating every video as lumbar.
  if (!evidence.some(e => e.dimension === "bodyRegions") && /\bback\b/.test(normalize(source.title ?? ""))) {
    for (const label of ["upper_back", "mid_back", "lower_back"]) evidence.push({ dimension: "bodyRegions", label, score: 4, matchedTerms: ["back (unspecified)"], fields: ["title"] });
  }
  const result: Classification = {
    classifierVersion: CLASSIFIER_VERSION,
    bodyRegions: bodyRegions.filter(label => evidence.some(e => e.dimension === "bodyRegions" && e.label === label)),
    intents: intents.filter(label => evidence.some(e => e.dimension === "intents" && e.label === label)),
    topics: topics.filter(label => evidence.some(e => e.dimension === "topics" && e.label === label)),
    evidence,
    confidence: evidence.some(e => e.dimension === "bodyRegions" && e.score >= 6) ? "strong" : evidence.some(e => e.dimension === "bodyRegions") ? "weak" : "unclassified",
  };
  // Kind/duration are retained for filtering, never used to guess a medical topic or Short status.
  return result;
}
export function applyOverride(automatic: Classification, override?: ManualOverride): Classification {
  return {
    ...automatic,
    bodyRegions: override?.bodyRegions ?? automatic.bodyRegions,
    intents: override?.intents ?? automatic.intents,
    topics: override?.topics ?? automatic.topics,
  };
}
