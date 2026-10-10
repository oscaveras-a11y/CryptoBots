import test from 'node:test';
import assert from 'node:assert/strict';
import {VerisCore,AGENT_NAMES} from '../src/index.js';

test('every agent reports registration, state and missing dependencies',()=>{
 const capabilities=new VerisCore().capabilities;
 assert.deepEqual(capabilities.map(a=>a.name),AGENT_NAMES);
 for(const agent of capabilities){
   assert.equal(agent.registered,true);
   assert.equal(typeof agent.ready,'boolean');
   assert.ok(['partial','requires_adapter','local_capability','not_registered'].includes(agent.state));
   assert.ok(Array.isArray(agent.missingDependencies));
 }
 const byName=Object.fromEntries(capabilities.map(a=>[a.name,a]));
 assert.equal(byName.mind.modelReady,false);
 assert.equal(byName.mind.state,'partial');
 assert.ok(byName.mind.missingDependencies.includes('language_model_for_open_ended_answers'));
 assert.equal(byName.voice.state,'requires_adapter');
 assert.deepEqual(byName.voice.missingDependencies,['audio_transcriber','speech_synthesizer']);
 assert.equal(byName.code.ready,false);
 assert.ok(byName.code.missingDependencies.includes('isolated_test_runner'));
 assert.equal(byName.vision.ready,false);
});

test('configured adapters update capabilities without claiming missing integrations',()=>{
 const noop=async()=>({});
 const core=new VerisCore({mindResponder:noop,visionAnalyzer:noop,audioTranscriber:noop,speechSynthesizer:noop,
 actionExecutor:noop,actionAuthorizer:async()=>({allowed:false})});
 const byName=Object.fromEntries(core.capabilities.map(a=>[a.name,a]));
 assert.equal(byName.mind.modelReady,true);
 assert.deepEqual(byName.mind.missingDependencies,[]);
 assert.equal(byName.voice.transcriptionReady,true);
 assert.equal(byName.voice.speechReady,true);
 assert.deepEqual(byName.voice.missingDependencies,[]);
 assert.equal(byName.vision.ready,true);
 assert.equal(byName.action.ready,true);
 assert.ok(byName.action.missingDependencies.includes('general_action_execution'));
});
