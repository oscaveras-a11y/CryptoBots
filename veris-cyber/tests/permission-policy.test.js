import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeJarvisAction} from '../agents/action/permission-policy.js';
test('assessment grant never authorizes file changes',()=>{
 const grant={kind:'assessment',approved:true,targets:['lab-pc'],operations:['inspect_ports']};
 assert.equal(authorizeJarvisAction({kind:'assessment',operation:'inspect_ports',target:'lab-pc'},grant).allowed,true);
 assert.equal(authorizeJarvisAction({kind:'file_change',operation:'delete',target:'C:/data/a.txt'},grant).allowed,false);
});
test('file change requires exact target, operation, destination and confirmation',()=>{
 const grant={kind:'file_change',approved:true,confirmed:true,operation:'move',target:'C:/data/a.txt',destination:'C:/archive/a.txt'};
 const request={kind:'file_change',operation:'move',target:'C:/data/a.txt',destination:'C:/archive/a.txt'};
 assert.equal(authorizeJarvisAction(request,grant).allowed,true);
 assert.equal(authorizeJarvisAction({...request,destination:'C:/other/a.txt'},grant).allowed,false);
 assert.equal(authorizeJarvisAction(request,{...grant,confirmed:false}).allowed,false);
});
test('unknown operations are denied',()=>{
 assert.equal(authorizeJarvisAction({kind:'file_change',operation:'format',target:'C:/'},{kind:'file_change',approved:true,confirmed:true}).allowed,false);
});
