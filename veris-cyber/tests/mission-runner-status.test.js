import test from 'node:test';
import assert from 'node:assert/strict';
import {runCyberMission} from '../agents/cyber/mission-runner.js';

const mission={targets:['example.com'],excludedTargets:['db.example.com'],operations:['http_headers']};
test('mission runner reports successful and rejected tasks',async()=>{
 const steps=[{target:'example.com',operation:'http_headers'},{target:'db.example.com',operation:'http_headers'}];
 const result=await runCyberMission(mission,steps,async()=>({ok:true}),true);
 assert.equal(result.executed,true);
 assert.deepEqual(result.results.map(x=>x.status),['completed','blocked']);
});
test('mission runner captures adapter failure without continuing outside scope',async()=>{
 const steps=[{target:'example.com',operation:'http_headers'},{target:'other.org',operation:'http_headers'}];
 const result=await runCyberMission(mission,steps,async()=>{throw Error('private details');},true);
 assert.equal(result.executed,false);
 assert.equal(result.results[0].reason,'adapter_error');
 assert.equal(result.results[1].reason,'outside_scope');
});
test('mission runner rejects missing adapter and empty steps',async()=>{
 assert.equal((await runCyberMission(mission,[],async()=>{},true)).status,'invalid_steps');
 assert.equal((await runCyberMission(mission,[{target:'example.com',operation:'http_headers'}])).status,'runner_required');
});
