const {test,before,after}=require('node:test');const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,serverTimestamp}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-conduit',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});});
after(async()=>{await env.cleanup();});
const record=(extra={})=>({schemaVersion:2,puzzleId:'p',slots:['FALL',null,null],elapsed:5,hintsUsed:0,rewardedHintUsed:false,completed:false,dailyWin:false,modifiedAt:1,updatedAt:serverTimestamp(),...extra});
test('only the owner can read and write progress; anonymous/other accounts cannot',async()=>{
 const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore(),guest=env.unauthenticatedContext().firestore();
 const path='users/alice/progressV2/daily:2026-10-17';
 await assertSucceeds(setDoc(doc(alice,path),record()));await assertSucceeds(getDoc(doc(alice,path)));
 await assertFails(getDoc(doc(bob,path)));await assertFails(setDoc(doc(bob,path),record()));await assertFails(getDoc(doc(guest,path)));
});
test('Pro entitlements are server-only and isolated by account',async()=>{
 const alice=env.authenticatedContext('alice').firestore(),bob=env.authenticatedContext('bob').firestore();const path='users/alice/private/entitlement';
 await assertFails(setDoc(doc(alice,path),{pro:true}));
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),{pro:true}));
 await assertSucceeds(getDoc(doc(alice,path)));await assertFails(getDoc(doc(bob,path)));
});
test('invalid words, duplicate slots, incomplete completions and client timestamps are rejected',async()=>{
 const db=env.authenticatedContext('validation').firestore();
 for(const bad of [{slots:['FALL','FALL',null]},{slots:['<script>',null,null]},{completed:true},{elapsed:-1},{hintsUsed:3},{updatedAt:123},{dailyWin:'yes'}])
  await assertFails(setDoc(doc(db,'users/validation/progressV2/daily:2026-10-17'),record(bad)));
});
test('legacy schema and settings stay supported; completed results cannot be downgraded',async()=>{
 const db=env.authenticatedContext('legacy').firestore();const base='users/legacy/';const old=record({schemaVersion:1});delete old.dailyWin;
 await assertSucceeds(setDoc(doc(db,base+'progress/daily:2026-10-17'),old));
 await assertSucceeds(setDoc(doc(db,base+'settings/preferences'),{schemaVersion:1,theme:'dark',sound:false,music:false,haptics:true,tutorialSeen:true,modifiedAt:1,updatedAt:serverTimestamp()}));
 const path=base+'progressV2/daily:2026-10-18';
 await assertSucceeds(setDoc(doc(db,path),record({slots:['FALL','BACK','FIRE'],completed:true})));
 await assertFails(setDoc(doc(db,path),record({modifiedAt:2})));
});
test('a deleted-account guard stops stale clients recreating cloud progress',async()=>{
 const db=env.authenticatedContext('closed').firestore();
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'closedAccounts/closed'),{expiresAt:Date.now()+7200000}));
 await assertFails(setDoc(doc(db,'users/closed/progressV2/daily:2026-10-17'),record()));
});
