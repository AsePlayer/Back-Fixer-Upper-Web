import { spawnSync } from 'node:child_process';
const args=['--import','tsx','scripts/content-update.ts','--mode',process.env.BFU_MODE||'auto','--creator',process.env.BFU_CREATOR||'all'];
if(process.env.BFU_DRY_RUN==='true')args.push('--dry-run');
const result=spawnSync(process.execPath,args,{stdio:'inherit',shell:false});process.exitCode=result.status??1;
