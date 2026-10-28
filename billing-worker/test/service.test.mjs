import {test} from 'node:test';import assert from 'node:assert/strict';
import {service} from '../src/service.mjs';import policy from '../../shared/purchase-policy.cjs';
import {handler} from '../src/index.mjs';
const {accountId,hash}=policy;
function fixture(receipt={}) {
 const rows=new Map();let acks=0,deleted=null,lookups=0;
 const db={get:async p=>rows.has(p)?{path:p,data:rows.get(p)}:null,put:async(p,d)=>rows.set(p,d),create:async(p,d)=>{if(rows.has(p))throw Object.assign(new Error(),{status:409});rows.set(p,d);},remove:async p=>rows.delete(p),deleteMany:async ps=>ps.forEach(p=>rows.delete(p)),list:async p=>({docs:[...rows].filter(([k])=>k.startsWith(p+'/')).map(([path,data])=>({path,data}))}),query:async()=>[]};
 const purchase={purchaseState:0,consumptionState:0,quantity:1,productId:'conduit_pro_lifetime',obfuscatedExternalAccountId:accountId('alice'),acknowledgementState:0,...receipt};
 const pub={get:async()=>{lookups++;return purchase;},acknowledge:async()=>{acks++;}};
 const api=service(db,pub,async uid=>{deleted=uid;});
 return {api,db,rows,purchase,get acks(){return acks;},get deleted(){return deleted;},get lookups(){return lookups;}};
}
const alice={sub:'alice',email_verified:true,auth_time:Date.now()/1000};
test('verified purchases are linked, acknowledged and restored from the same account',async()=>{
 const f=fixture();assert.deepEqual(await f.api.call('billing/verify',alice,{token:'paid-token'}),{pro:true});assert.equal(f.acks,1);
 assert.equal(f.rows.get('playPurchases/'+hash('paid-token')).uid,'alice');assert.equal(f.rows.get('users/alice/private/entitlement').pro,true);
 assert.deepEqual(await f.api.call('billing/restore',alice,{}),{pro:true});
});
test('pending, refunded and wrong-account purchases never unlock Pro',async()=>{
 for(const receipt of [{purchaseState:2},{purchaseState:1},{obfuscatedExternalAccountId:accountId('bob')}]){
  const f=fixture(receipt);await assert.rejects(f.api.call('billing/verify',alice,{token:'paid-token'}),e=>e.status===409);assert.equal(f.acks,0);assert.equal(f.rows.size,0);
 }
});
test('a revoked purchase removes Pro when next checked',async()=>{
 const f=fixture();await f.api.call('billing/verify',alice,{token:'paid-token'});f.purchase.purchaseState=1;
 assert.deepEqual(await f.api.call('billing/restore',alice,{}),{pro:false});assert.equal(f.rows.get('users/alice/private/entitlement').pro,false);
});
test('token replay and unverified-account purchase attempts are rejected',async()=>{
 const f=fixture();f.rows.set('playPurchases/'+hash('paid-token'),{uid:'bob'});
 await assert.rejects(f.api.call('billing/verify',alice,{token:'paid-token'}),e=>e.status===403);
 await assert.rejects(f.api.call('billing/verify',{...alice,email_verified:false},{token:'paid-token'}),e=>e.status===403);assert.equal(f.acks,0);
});
test('account deletion requires recent sign-in and removes cloud data before identity',async()=>{
 const f=fixture();f.rows.set('users/alice/progressV2/day',{a:1});
 await assert.rejects(f.api.call('account/delete',{...alice,auth_time:1},{}),e=>e.status===401);
 assert.deepEqual(await f.api.call('account/delete',alice,{}),{deleted:true});assert.equal(f.deleted,'alice');assert.equal(f.rows.has('users/alice/progressV2/day'),false);assert.ok(f.rows.has('closedAccounts/alice'));
 await assert.rejects(f.api.call('billing/account',alice,{}),e=>e.status===403);
});
test('disabled service, untrusted origins and missing/invalid Firebase tokens fail closed',async()=>{
 let privileged=0;const api=handler({identity:async()=>{throw new Error('bad jwt');},accessToken:async()=>{privileged++;}});
 const req=(headers={})=>new Request('https://billing.test/v1/billing/verify',{method:'POST',headers,body:'{}'});
 assert.equal((await api.fetch(req(),{SERVICE_ENABLED:'false'})).status,503);
 assert.equal((await api.fetch(req({Origin:'https://evil.test'}),{SERVICE_ENABLED:'true'})).status,403);
 assert.equal((await api.fetch(req(),{SERVICE_ENABLED:'true'})).status,401);
 assert.equal((await api.fetch(req({Authorization:'Bearer fake'}),{SERVICE_ENABLED:'true'})).status,401);assert.equal(privileged,0);
});
