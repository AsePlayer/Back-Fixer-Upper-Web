export const regionNames = {
  head: 'Head', jaw: 'Jaw', neck: 'Neck', shoulders: 'Shoulders', upper_back: 'Upper back', mid_back: 'Mid back', lower_back: 'Lower back',
  ribs_chest: 'Ribs & chest', pelvis_si: 'Pelvis & SI joint', hips: 'Hips', glutes: 'Glutes', arms: 'Upper arms', elbows: 'Elbows', forearms: 'Forearms',
  wrists: 'Wrists', hands: 'Hands', thighs: 'Thighs', hamstrings: 'Hamstrings', knees: 'Knees', calves: 'Calves', ankles: 'Ankles', feet: 'Feet', whole_body: 'Whole body'
};
export const regionGroups = [ ['Head & neck', ['head','jaw','neck']], ['Back & torso', ['upper_back','mid_back','lower_back','ribs_chest','pelvis_si']],
  ['Shoulders, arms & hands', ['shoulders','arms','elbows','forearms','wrists','hands']], ['Hips & legs', ['hips','glutes','thighs','hamstrings','knees','calves','ankles','feet']], ['Full body',['whole_body']] ];
export const intentNames = { stretch: 'Stretching', mobility: 'Mobility', pain_relief: 'Pain relief', strengthening: 'Strengthening', stability: 'Stability', posture: 'Posture', nerve_related: 'Nerve topics', warm_up: 'Warm-up', recovery: 'Recovery', self_massage: 'Self-massage', education: 'Education' };
export const topicNames = { sciatica: 'Sciatica', piriformis: 'Piriformis', scoliosis: 'Scoliosis', plantar_fasciitis: 'Plantar fasciitis', carpal_tunnel: 'Carpal tunnel', headaches: 'Headaches', hip_flexor: 'Hip flexors', si_joint: 'SI joint', rounded_shoulders: 'Rounded shoulders' };
export const ratingNames = { helpful: 'Helpful', neutral: 'Neutral', worse: 'Made it worse' };
export const legacyRegion = key => ({upper:'upper_back', middle:'mid_back', lower:'lower_back', hip:'hips'}[key] ?? key);
