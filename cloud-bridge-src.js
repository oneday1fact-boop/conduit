import {requestBilling} from './billing-client.mjs';
import {initializeApp} from 'firebase/app';
import {getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, signOut, getIdToken, GoogleAuthProvider, signInWithCredential} from 'firebase/auth';
import {getFirestore, collection, doc, onSnapshot, runTransaction, serverTimestamp} from 'firebase/firestore';
import {registerPlugin} from '@capacitor/core';
const Billing = registerPlugin('ConduitBilling');
const Account = registerPlugin('ConduitAccount');
let auth, db, user = null, pro = false, generation = 0, stop = [], ready = false;
let cloudRecords = {}, legacyRecords = {}, sent = new Map();
const emit = (name, detail) => window.dispatchEvent(new CustomEvent('conduit:' + name,{detail}));
const configured = !!window.CONDUIT_FIREBASE_CONFIG?.projectId && window.CONDUIT_CLOUD_SERVICES_READY === true;
function requireUser() { if (!user) throw new Error('Sign in first.'); }
function stopListeners() { stop.forEach(fn=>fn()); stop=[]; sent.clear(); cloudRecords={}; legacyRecords={}; pro=false; ready=false; }
function init() {
  if (!configured) return;
  const app = initializeApp(window.CONDUIT_FIREBASE_CONFIG);
  auth=getAuth(app); db=getFirestore(app);
  void Billing.addListener('purchaseUpdated',purchase=>{if(user) void verify(purchase).then(refresh).catch(()=>emit('sync',{message:'Purchase received. Use Restore purchases to finish checking Pro.'}));}).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && user) void window.ConduitCloud.restore().catch(()=>{});});
  onAuthStateChanged(auth, next => {
    const epoch=++generation; stopListeners(); user=next;
    emit('account',{user:next ? {uid:next.uid,email:next.email,verified:next.emailVerified} : null, pro:false});
    if (!next) return;
    stop.push(onSnapshot(doc(db,'users',next.uid,'private','entitlement'), snapshot => {
      if (epoch!==generation) return;
      // No local flag or client write can grant Pro. Only the verified backend writes this document.
      pro=snapshot.data()?.pro === true;
      emit('entitlement',{pro});
    },()=>emit('sync',{message:'Could not check Pro access. Reconnect and try Restore purchases.'})));
    stop.push(onSnapshot(collection(db,'users',next.uid,'progress'), snapshot => {
      if(epoch!==generation) return;
      legacyRecords={};snapshot.forEach(d=>{const r=d.data();legacyRecords[d.id]={...r,dailyWin:d.id.startsWith("daily:") && r.completed===true};});
      emit('progress',{records:window.ConduitProCore.mergeRecords(legacyRecords,cloudRecords)});
    },()=>{}));
    stop.push(onSnapshot(collection(db,'users',next.uid,'progressV2'), snapshot => {
      if (epoch!==generation) return;
      cloudRecords={}; snapshot.forEach(d=>{cloudRecords[d.id]=d.data();}); ready=true;
      emit('progress',{records:window.ConduitProCore.mergeRecords(legacyRecords,cloudRecords)});
    },()=>emit('sync',{message:'Progress is saved on this device. Cloud sync will retry when connected.'})));
    void refresh().catch(()=>{});
  });
}
async function sync(records) {
  if (!user || !ready) return;
  const uid=user.uid, epoch=generation;
  const changes=Object.entries(window.ConduitProCore.mergeRecords({},records)).filter(([k,r])=>sent.get(k)!==JSON.stringify(r));
  try {
    for (const [key,record] of changes) {
      if (epoch!==generation) return;
      await runTransaction(db,async transaction=>{
        const ref=doc(db,'users',uid,'progressV2',key);
        const saved=await transaction.get(ref);
        const merged=window.ConduitProCore.mergeRecord(saved.data(),record);
        if (JSON.stringify(window.ConduitProCore.cleanRecord(saved.data()))!==JSON.stringify(merged)) transaction.set(ref,{
          schemaVersion:2,puzzleId:merged.puzzleId,slots:merged.slots,elapsed:merged.elapsed,hintsUsed:merged.hintsUsed,
          rewardedHintUsed:merged.hintsUsed>0,completed:merged.completed,dailyWin:merged.dailyWin,
          modifiedAt:merged.updatedAt,updatedAt:serverTimestamp()
        });
      });
      sent.set(key,JSON.stringify(record));
    }
    if (epoch===generation) emit('sync',{message:'Progress synced'});
  } catch { if(epoch===generation) emit('sync',{message:'Saved on this device · waiting to sync'}); }
}
async function verify(purchase) {
  if(purchase.state===2) throw new Error('Payment is pending. Pro unlocks after Google Play confirms payment.');
  if(purchase.state!==1) return;
  await billingRequest('billing/verify',{token:purchase.token});
}
async function refresh() {
  requireUser();
  const result=await billingRequest('billing/restore');
  pro=result.pro===true; emit('entitlement',{pro}); return pro;
}
async function billingRequest(route,data={}) {
  return requestBilling(()=>({user,epoch:generation,url:window.CONDUIT_BILLING_API_URL}),getIdToken,fetch,route,data);
}

window.ConduitCloud={configured,init,sync,
  get billingReady(){return !!window.CONDUIT_BILLING_API_URL;},
  get user(){return user;}, get pro(){return pro;},
  async google(){
    if(!configured || !window.CONDUIT_GOOGLE_WEB_CLIENT_ID) throw new Error("Google sign-in setup is not available in this build yet.");
    const result=await Account.google({clientId:window.CONDUIT_GOOGLE_WEB_CLIENT_ID});
    await signInWithCredential(auth,GoogleAuthProvider.credential(result.idToken));
  },
  async login(email,password,create=false){
    if(!configured) throw new Error('Account setup is not available in this build yet.');
    const credential=await (create?createUserWithEmailAndPassword:signInWithEmailAndPassword)(auth,email,password);
    if(create) await sendEmailVerification(credential.user);
  },
  async reset(email){if(!configured) throw new Error('Account setup is not available yet.'); await sendPasswordResetEmail(auth,email);},
  async logout(){await signOut(auth);},
  async price(){return (await Billing.product()).price;},
  async buy(){requireUser(); if(!user.emailVerified) {await user.reload(); if(!user.emailVerified) throw new Error('Verify your email before buying Pro, then sign in again.');}
    await getIdToken(user,true);
    const id=await billingRequest('billing/account');
    const purchase=await Billing.purchase({accountId:id.accountId}); await verify(purchase); await refresh();},
  async restore(){requireUser(); const result=await Billing.restore(); for(const p of result.purchases) await verify(p); return refresh();},
  async deleteAccount(){requireUser(); await billingRequest('account/delete'); await signOut(auth);},
  async resendVerification(){requireUser(); await sendEmailVerification(user);}
};
