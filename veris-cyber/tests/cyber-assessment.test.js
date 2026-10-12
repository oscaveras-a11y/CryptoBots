import test from 'node:test';
import assert from 'node:assert/strict';
import cyber from '../agents/cyber/index.js';
const authorization={confirmed:true,targets:['localhost'],activities:['review']};
test('scoped evidence assessment produces structured report without execution',()=>{
 const result=cyber({data:{assessmentMode:'evidence',target:'localhost',activity:'review',authorization,evidence:[{title:'Configuration issue',severity:'medium',source:'local review',verified:true,recommendation:'Update configuration'}]}});
 assert.equal(result.status,'assessment_ready');
 assert.equal(result.executed,false);
 assert.equal(result.report.findingCount,1);
 assert.equal(result.labValidation.executed,false);
});
test('evidence assessment requires explicit target approval',()=>{
 const result=cyber({data:{assessmentMode:'evidence',target:'other',activity:'review',authorization}});
 assert.equal(result.status,'blocked');
});
