import type { BodyRegion, Intent, Topic } from "../model";
export const CLASSIFIER_VERSION = 1;
// Phrase boundaries prevent e.g. "hip" from matching "scholarship".
export const regionTerms: Record<BodyRegion, string[]> = {
  neck: ["neck", "cervical"], head: ["head", "headache", "headaches", "migraine"],
  jaw: ["jaw", "tmj"], shoulders: ["shoulder", "shoulders", "rotator cuff"],
  upper_back: ["upper back", "trapezius", "traps", "rhomboid", "rhomboids"],
  mid_back: ["mid back", "middle back", "thoracic"], lower_back: ["lower back", "low back", "lumbar"],
  ribs_chest: ["rib", "ribs", "chest", "pectoral", "pecs"],
  pelvis_si: ["pelvis", "pelvic", "sacroiliac", "si joint", "sacrum", "tailbone"],
  hips: ["hip", "hips", "hip flexor", "hip flexors"], glutes: ["glute", "glutes", "gluteal", "buttock", "buttocks", "piriformis"],
  arms: ["arm", "arms", "biceps", "triceps"], elbows: ["elbow", "elbows"], forearms: ["forearm", "forearms"],
  wrists: ["wrist", "wrists", "carpal tunnel"], hands: ["hand", "hands", "finger", "fingers", "thumb"],
  thighs: ["thigh", "thighs", "quadriceps", "quads", "adductor", "adductors"], hamstrings: ["hamstring", "hamstrings"],
  knees: ["knee", "knees", "patella"], calves: ["calf", "calves", "gastrocnemius", "soleus"],
  ankles: ["ankle", "ankles", "achilles"], feet: ["foot", "feet", "toe", "toes", "plantar fasciitis", "heel"],
  whole_body: ["whole body", "full body", "entire body"],
};
export const intentTerms: Record<Intent, string[]> = {
  stretch: ["stretch", "stretches", "stretching"], mobility: ["mobility", "range of motion", "stiff", "stiffness", "tight", "tightness"],
  pain_relief: ["pain relief", "relieve", "relief", "pain"], strengthening: ["strength", "strengthening", "strengthen", "stronger", "endurance"],
  stability: ["stability", "stabilize", "balance"], posture: ["posture", "rounded shoulders", "hunchback"],
  nerve_related: ["nerve", "nerves", "sciatica", "tingling", "numbness"], warm_up: ["warm up", "warmup"],
  recovery: ["recovery", "recover", "soreness"], self_massage: ["self massage", "massage", "foam roll", "foam rolling", "trigger point"],
  education: ["explained", "why", "what causes", "learn", "understanding"],
};
export const topicTerms: Record<Topic, string[]> = {
  sciatica: ["sciatica", "sciatic"], piriformis: ["piriformis"], scoliosis: ["scoliosis"],
  plantar_fasciitis: ["plantar fasciitis"], carpal_tunnel: ["carpal tunnel"], headaches: ["headache", "headaches", "migraine"],
  hip_flexor: ["hip flexor", "hip flexors", "iliopsoas", "psoas"], si_joint: ["si joint", "sacroiliac"], rounded_shoulders: ["rounded shoulders"],
};
