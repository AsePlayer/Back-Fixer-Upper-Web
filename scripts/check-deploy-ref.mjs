import { execFileSync } from 'node:child_process';
const expected=process.env.EXPECTED_COMMIT;
if(!/^[a-f0-9]{40}$/.test(expected??''))throw new Error('Deploy requires an exact full commit SHA.');
const actual=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(actual!==expected)throw new Error('Checked-out commit differs from requested deployment.');
console.log(`Building exact committed source ${actual}`);
