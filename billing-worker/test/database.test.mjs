import {test} from 'node:test';import assert from 'node:assert/strict';import {database} from '../src/google.mjs';
test('missing documents can be read/deleted; a missing database cannot silently accept writes',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:404});
 try {const db=database({FIREBASE_PROJECT_ID:'demo-conduit'},'test-only');assert.equal(await db.get('playAccounts/alice'),null);await db.remove('users/alice');await assert.rejects(db.put('users/alice/private/entitlement',{pro:true}),e=>e.status===404);}finally{globalThis.fetch=original;}
});
