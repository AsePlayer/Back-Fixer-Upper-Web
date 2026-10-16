import { existsSync,readFileSync,appendFileSync } from 'node:fs';
const text=existsSync('.tmp/update-result.json')?readFileSync('.tmp/update-result.json','utf8'):'No durable summary. Dry-run or early failure: inspect the update step output. Public deployment is withheld on failure.';
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Content update\n\n\`\`\`json\n${text}\n\`\`\`\n`);else console.log(text);
