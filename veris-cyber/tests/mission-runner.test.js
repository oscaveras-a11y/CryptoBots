import test from 'node:test';
import assert from 'node:assert/strict';
import {runCyberMission} from '../agents/cyber/mission-runner.js';
test('runner follows mission policy',async()=>{
 const mission={targets:['example.com'],excludedTargets:['db.example.com'],operations:['http_headers']};
 const steps=[{target:'example.com',operation:'http_headers'},{target:'db.example.com',operation:'http_headers'}];
 const visited=[];
 const result=await runCyberMission(mission,steps,async step=>{visited.push(step.target);return {ok:true};},true);
 assert.deepEqual(visited,['example.com']);
 assert.deepEqual(result.results.map(x=>x.status),['completed','blocked']);
});
test('runner requires verified permission',async()=>{
 const mission={targets:['example.com'],operations:['http_headers']};
 let count=0;
 const result=await runCyberMission(mission,[{target:'example.com',operation:'http_headers'}],async()=>{count++;},false);
 assert.equal(count,0);
 assert.equal(result.results[0].reason,'authorization_unverified');
});
