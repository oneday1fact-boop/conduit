const {test}=require('node:test');const assert=require('node:assert/strict');
const load=()=>import('../billing-client.mjs');
test('a purchase response from a signed-out account cannot unlock the next account',async()=>{
 const {requestBilling}=await load();let state={user:{uid:'alice'},epoch:1,url:'https://billing.test'};let finish;
 const pending=requestBilling(()=>state,async()=> 'private-token',()=>new Promise(r=>{finish=r;}),'billing/restore');
 await new Promise(r=>setImmediate(r));state={...state,user:{uid:'bob'},epoch:2};
 finish({ok:true,json:async()=>({pro:true})});await assert.rejects(pending,/Account changed/);
});
test('changing accounts while reading the auth token prevents the request being sent',async()=>{
 const {requestBilling}=await load();let state={user:{uid:'alice'},epoch:1,url:'https://billing.test'},finish,sent=0;
 const pending=requestBilling(()=>state,()=>new Promise(r=>{finish=r;}),async()=>{sent++;},'billing/restore');
 state={...state,user:null,epoch:2};finish('private-token');await assert.rejects(pending,/Account changed/);assert.equal(sent,0);
});
