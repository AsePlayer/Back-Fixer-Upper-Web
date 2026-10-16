import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export const allowedPath=path=>/^(?:content\/catalog\.json|content\/source\/youtube\/UC[\w-]{22}\/(?:channel|sync-state)\.json|content\/source\/youtube\/UC[\w-]{22}\/videos\/[\w-]{11}\.json|public\/data\/(?:manifest|status)\.json|public\/data\/[a-f0-9]{64}\/(?:index|details-[0-9]{3,5})\.json)$/.test(path);
export function commitContent() {
  const repo=process.env.GITHUB_REPOSITORY,branch=process.env.BFU_BRANCH;
  if(!repo||!branch||['aseplayer/back-fixer-upper','aseplayer/portfolio-2.0'].includes(repo.toLowerCase()))throw new Error('Writer must target the isolated new repository.');
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)||!branch.match(/^[\w./-]+$/))throw new Error('Invalid repository/branch.');
  const remote=git('remote','get-url','origin').replace(/\.git$/,'');
  if(![ `https://github.com/${repo}`,`git@github.com:${repo}`].includes(remote))throw new Error('Origin does not match this workflow repository.');
  const staged=git('diff','--cached','--name-only');if(staged)throw new Error('Unexpected pre-staged changes.');
  const changed=execFileSync('git',['status','--porcelain=v1','-z','--untracked-files=all'],{encoding:'utf8'}).split('\0').filter(Boolean).map(line=>line.slice(3).replaceAll('\\','/'));
  const paths=changed.filter(allowedPath);for(const path of paths)git('add','--',path);
  let committed=false;
  if(git('diff','--cached','--name-only')){
    git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
    const summary=existsSync('.tmp/update-result.json')?JSON.parse(readFileSync('.tmp/update-result.json','utf8')):{};
    git('commit','-m',`content: ${summary.outcome??'checkpoint'}; ${summary.changedRecords??0} records; catalog ${summary.publicChanged?'updated':'unchanged'}`);committed=true;
    try{git('push','origin',`HEAD:refs/heads/${branch}`);}catch{
      // Stop visibly on branch advancement/protection. Never force or replay old output over newer edits.
      writeFileSync('.tmp/content-writer.patch',execFileSync('git',['format-patch','-1','--stdout'],{encoding:'utf8'}));
      throw new Error('Content push rejected (branch advanced or protection). Public deployment withheld. Download the sanitized patch artifact, apply it on a fresh branch, review and open a PR; see AUTOMATION.md.');
    }
  }
  const sha=git('rev-parse','HEAD');if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`commit=${sha}\ncommitted=${committed}\n`);
  console.log(`Resulting committed revision: ${sha}${committed?' (pushed)':' (unchanged)'}`);return sha;
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/commit-content.mjs'))commitContent();
