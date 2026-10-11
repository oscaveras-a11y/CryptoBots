import test from 'node:test';
import assert from 'node:assert/strict';
import code from '../agents/code/index.js';

const mission={targets:['example.com'],excludedTargets:['db.example.com'],operations:['http_headers']};
test('mission policy enforces exclusions and verified scope',async()=>{
 const context={authorizationVerified:true};
 const allowed=await code({data:{operation:'mission_check',mission,step:{target:'www.example.com',operation:'http_headers'}}},context);
 assert.equal(allowed.allowed,true);
 const excluded=await code({data:{operation:'mission_check',mission,step:{target:'db.example.com',operation:'http_headers'}}},context);
 assert.equal(excluded.reason,'excluded_target');
 const outside=await code({data:{operation:'mission_check',mission,step:{target:'other.org',operation:'http_headers'}}},context);
 assert.equal(outside.reason,'outside_scope');
 const unverified=await code({data:{operation:'mission_check',mission,step:{target:'example.com',operation:'http_headers'}}});
 assert.equal(unverified.reason,'authorization_unverified');
});
