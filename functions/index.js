'use strict';
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue,FieldPath}=require('firebase-admin/firestore');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {onMessagePublished}=require('firebase-functions/v2/pubsub');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {google}=require('googleapis');
const {PRODUCT,PACKAGE,hash,accountId,validate}=require('./purchase-policy.cjs');
initializeApp();
const db=getFirestore();
const publisher=google.androidpublisher({version:'v3',auth:new google.auth.GoogleAuth({scopes:['https://www.googleapis.com/auth/androidpublisher']})});
function uidOf(request){
  if(!request.auth) throw new HttpsError('unauthenticated','Sign in to continue.');
  return request.auth.uid;
}
const entitlement=uid=>db.doc(`users/${uid}/private/entitlement`);
async function lookup(token){return (await publisher.purchases.products.get({packageName:PACKAGE,productId:PRODUCT,token})).data;}
async function reconcile(uid,token){
  const purchase=await lookup(token);
  const valid=validate(purchase,uid);
  if(valid && purchase.acknowledgementState!==1) await publisher.purchases.products.acknowledge({packageName:PACKAGE,productId:PRODUCT,token,requestBody:{}});
  await entitlement(uid).set({pro:valid,productId:PRODUCT,checkedAt:FieldValue.serverTimestamp()});
  return valid;
}
exports.billingAccount=onCall(request=>({accountId:accountId(uidOf(request))}));
exports.verifyProPurchase=onCall(async request=>{
  const uid=uidOf(request), token=request.data?.token;
  if(!request.auth.token.email_verified) throw new HttpsError('failed-precondition','Verify your email first.');
  if(typeof token!=='string' || token.length<8 || token.length>4096) throw new HttpsError('invalid-argument','Invalid purchase.');
  const purchase=await lookup(token);
  if(!validate(purchase,uid)) throw new HttpsError('failed-precondition','Purchase is pending, refunded, or belongs to a different CONDUIT account.');
  const ref=db.doc(`playPurchases/${hash(token)}`);
  await db.runTransaction(async t=>{
    const existing=await t.get(ref);
    if(existing.exists && existing.data().uid!==uid) throw new HttpsError('permission-denied','Purchase already belongs to another account.');
    t.set(ref,{uid,token,productId:PRODUCT,updatedAt:FieldValue.serverTimestamp()});
    t.set(db.doc(`playAccounts/${uid}`),{tokenHash:hash(token)});
  });
  return {pro:await reconcile(uid,token)};
});
exports.refreshPro=onCall(async request=>{
  const uid=uidOf(request);
  const account=await db.doc(`playAccounts/${uid}`).get();
  if(!account.exists) return {pro:false};
  const purchase=await db.doc(`playPurchases/${account.data().tokenHash}`).get();
  if(!purchase.exists || purchase.data().uid!==uid) return {pro:false};
  return {pro:await reconcile(uid,purchase.data().token)};
});
// Configure the Play RTDN topic as conduit-play-billing. Verify its publisher IAM before enabling.
exports.playPurchaseUpdate=onMessagePublished('conduit-play-billing',async event=>{
  const message=event.data.message.json;
  if(message.packageName!==PACKAGE) return;
  const token=message.oneTimeProductNotification?.purchaseToken || message.voidedPurchaseNotification?.purchaseToken;
  if(!token) return;
  const ref=await db.doc(`playPurchases/${hash(token)}`).get();
  if(ref.exists) await reconcile(ref.data().uid,token);
});
// Recovery for missed refund notifications. No client can write purchase tokens or entitlements.
exports.recheckProPurchases=onSchedule('every 6 hours',async()=>{
  let cursor;
  for(;;){
    let query=db.collection('playPurchases').orderBy(FieldPath.documentId()).limit(200);
    if(cursor) query=query.startAfter(cursor);
    const batch=await query.get(); if(batch.empty) break;
    for(const purchase of batch.docs) if(purchase.data().uid) {
      try {await reconcile(purchase.data().uid,purchase.data().token);} catch {console.error('Purchase recheck failed',purchase.id);}
    }
    cursor=batch.docs.at(-1);
  }
});
exports.deleteConduitAccount=onCall(async request=>{
  const uid=uidOf(request);
  if(Date.now()/1000-request.auth.token.auth_time>300) throw new HttpsError('unauthenticated','Sign out and sign in again before deleting your account.');
  await db.recursiveDelete(db.doc(`users/${uid}`));
  const account=await db.doc(`playAccounts/${uid}`).get();
  if(account.exists){
    // Keep only the token hash as a purchase-reuse guard; remove the token and account link.
    await db.doc(`playPurchases/${account.data().tokenHash}`).set({deleted:true});
    await account.ref.delete();
  }
  await getAuth().deleteUser(uid);
  return {deleted:true};
});
