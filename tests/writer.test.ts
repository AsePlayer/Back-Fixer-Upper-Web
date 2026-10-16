import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
test('bot writer pushes its resulting commit normally, excludes unrelated files, and stops visibly on an advanced branch',async()=>{
  const root=await mkdtemp(join(tmpdir(),'bfu-writer-')),work=join(root,'work'),remote=join(root,'remote.git'),other=join(root,'other');
  const script=resolve('scripts/commit-content.mjs'),output=join(root,'output');
  const git=(cwd:string,...args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const identity=(cwd:string)=>{git(cwd,'config','user.name','Synthetic test');git(cwd,'config','user.email','fixture@example.invalid');};
  try{
    await mkdir(work);git(root,'init','--bare',remote);git(work,'init');identity(work);git(work,'checkout','-b','main');await writeFile(join(work,'README.md'),'Synthetic fixture\n');git(work,'add','--','README.md');git(work,'commit','-m','fixture');
    git(work,'remote','add','origin','https://github.com/fixture/back-fixer-upper-web');git(work,'config','remote.origin.pushurl',remote);git(work,'push','origin','main');
    await mkdir(join(work,'public/data'),{recursive:true});await mkdir(join(work,'.tmp'));await writeFile(join(work,'public/data/status.json'),'{"schema":1}\n');await writeFile(join(work,'private.json'),'Synthetic unrelated file, never stage\n');await writeFile(join(work,'.tmp/update-result.json'),'{"outcome":"successful","changedRecords":1,"publicChanged":false}');
    const run=()=>execFileSync(process.execPath,[script],{cwd:work,env:{...process.env,GITHUB_REPOSITORY:'fixture/back-fixer-upper-web',BFU_BRANCH:'main',GITHUB_OUTPUT:output},encoding:'utf8',stdio:['ignore','pipe','pipe']});
    run();const sha=git(work,'rev-parse','HEAD');assert.equal(git(remote,'rev-parse','refs/heads/main'),sha);assert.match(await readFile(output,'utf8'),new RegExp(`commit=${sha}`));assert.match(git(work,'status','--porcelain','--','private.json'),/\?\?/);
    run();assert.equal(git(work,'rev-parse','HEAD'),sha);
    git(root,'clone','--branch','main',remote,other);identity(other);await writeFile(join(other,'README.md'),'Synthetic human change\n');git(other,'add','--','README.md');git(other,'commit','-m','human fixture');git(other,'push','origin','main');const human=git(other,'rev-parse','HEAD');
    await writeFile(join(work,'public/data/status.json'),'{"schema":1,"attempt":"fixture"}\n');assert.throws(run,/Command failed/);assert.equal(git(remote,'rev-parse','refs/heads/main'),human);assert.match(await readFile(join(work,'.tmp/content-writer.patch'),'utf8'),/public\/data\/status.json/);
  }finally{const target=await realpath(root);assert.equal(dirname(target),await realpath(tmpdir()));assert.match(basename(target),/^bfu-writer-/);await rm(target,{recursive:true,force:true});}
});
