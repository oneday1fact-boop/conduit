import {initializeApp} from 'firebase/app';
import {getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, signOut, getIdToken} from 'firebase/auth';
import {getFirestore, collection, doc, onSnapshot, runTransaction} from 'firebase/firestore';
import {getFunctions, httpsCallable} from 'firebase/functions';
import {registerPlugin} from '@capacitor/core';
const Billing = registerPlugin('ConduitBilling');
let auth, db, functions, user = null, pro = false, generation = 0, stop = [], ready = false;
let cloudRecords = {}, sent = new Map();
const emit = (name, detail) => window.dispatchEvent(new CustomEvent('conduit:' + name,{detail}));
const configured = !!window.CONDUIT_FIREBASE_CONFIG?.projectId;
function requireUser() { if (!user) throw new Error('Sign in first.'); }
function stopListeners() { stop.forEach(fn=>fn()); stop=[]; sent.clear(); cloudRecords={}; pro=false; ready=false; }
function init() {
  if (!configured) return;
  const app = initializeApp(window.CONDUIT_FIREBASE_CONFIG);
  auth=getAuth(app); db=getFirestore(app); functions=getFunctions(app,window.CONDUIT_FUNCTIONS_REGION || 'us-central1');
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
      if (epoch!==generation) return;
      cloudRecords={}; snapshot.forEach(d=>{cloudRecords[d.id]=d.data();}); ready=true;
      emit('progress',{records:cloudRecords});
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
        const ref=doc(db,'users',uid,'progress',key);
        const saved=await transaction.get(ref);
        const merged=window.ConduitProCore.mergeRecord(saved.data(),record);
        if (JSON.stringify(saved.data())!==JSON.stringify(merged)) transaction.set(ref,merged);
      });
      sent.set(key,JSON.stringify(record));
    }
    if (epoch===generation) emit('sync',{message:'Progress synced'});
  } catch { if(epoch===generation) emit('sync',{message:'Saved on this device · waiting to sync'}); }
}
async function verify(purchase) {
  if(purchase.state===2) throw new Error('Payment is pending. Pro unlocks after Google Play confirms payment.');
  if(purchase.state!==1) return;
  await httpsCallable(functions,'verifyProPurchase')({token:purchase.token});
}
async function refresh() {
  requireUser();
  const result=await httpsCallable(functions,'refreshPro')({});
  pro=result.data.pro===true; emit('entitlement',{pro}); return pro;
}
window.ConduitCloud={configured,init,sync,
  get user(){return user;}, get pro(){return pro;},
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
    const id=await httpsCallable(functions,'billingAccount')({});
    const purchase=await Billing.purchase({accountId:id.data.accountId}); await verify(purchase); await refresh();},
  async restore(){requireUser(); const result=await Billing.restore(); for(const p of result.purchases) await verify(p); return refresh();},
  async deleteAccount(){requireUser(); await httpsCallable(functions,'deleteConduitAccount')({}); await signOut(auth);},
  async resendVerification(){requireUser(); await sendEmailVerification(user);}
};
