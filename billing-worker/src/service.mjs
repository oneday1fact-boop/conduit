import policy from '../../shared/purchase-policy.cjs';
const {PRODUCT,PACKAGE,hash,accountId,validate}=policy;
export class Failure extends Error {constructor(status,message){super(message);this.status=status;}}
export function service(db,publisher,removeAuth) {
 async function reconcile(uid,token) {
  const purchase=await publisher.get(token),pro=validate(purchase,uid);
  if(pro && purchase.acknowledgementState!==1)await publisher.acknowledge(token);
  await db.put(`users/${uid}/private/entitlement`,{pro,productId:PRODUCT,checkedAt:Date.now()});
  await db.put(`playPurchases/${hash(token)}`,{uid,token,productId:PRODUCT,checkedAt:Date.now()});
  return {pro};
 }
 async function call(route,identity,data) {
  const uid=identity.sub;
  if(await db.get(`closedAccounts/${uid}`) && route!=='account/delete') throw new Failure(403,'This account has been deleted.');
  if(route==='billing/account')return {accountId:accountId(uid)};
  if(route==='billing/verify') {
   const token=data.token;
   if(!identity.email_verified)throw new Failure(403,'Verify your email before purchasing.');
   if(typeof token!=='string'||token.length<8||token.length>4096)throw new Failure(400,'Invalid purchase.');
   const purchase=await publisher.get(token);
   if(!validate(purchase,uid))throw new Failure(409,'Purchase is pending, refunded or linked to another account.');
   const key=`playPurchases/${hash(token)}`,existing=await db.get(key);
   if(existing && existing.data.uid!==uid)throw new Failure(403,'Purchase already linked to another account.');
   if(!existing) {
    try {await db.create(key,{uid,token,productId:PRODUCT,checkedAt:0});}
    catch(error){if(error.status!==409)throw error;const winner=await db.get(key);if(winner?.data.uid!==uid)throw new Failure(403,'Purchase already linked.');}
   }
   await db.put(`playAccounts/${uid}`,{tokenHash:hash(token)});
   return reconcile(uid,token);
  }
  if(route==='billing/restore') {
   const link=await db.get(`playAccounts/${uid}`);
   if(!link)return {pro:false};
   const purchase=await db.get(`playPurchases/${link.data.tokenHash}`);
   if(!purchase || purchase.data.uid!==uid)return {pro:false};
   return reconcile(uid,purchase.data.token);
  }
  if(route==='account/delete') {
   if(!Number.isFinite(identity.auth_time)||Date.now()/1000-identity.auth_time>300)throw new Failure(401,'Sign in again before deleting your account.');
   await db.put(`closedAccounts/${uid}`,{expiresAt:Date.now()+7200000});
   // Only this app's known paths are removed; pagination uses fresh pages after deletion.
   for(const collection of ['progress','progressV2','settings','private']) {
    for(let batch=0;batch<8;batch++) {
     const {docs}=await db.list(`users/${uid}/${collection}`);if(!docs.length)break;
     await db.deleteMany(docs.map(d=>d.path));
     if(batch===7)throw new Failure(503,'Deletion is still in progress. Please retry.');
    }
   }
   await db.remove(`users/${uid}`);
   const account=await db.get(`playAccounts/${uid}`);
   if(account){await db.put(`playPurchases/${account.data.tokenHash}`,{deleted:true,checkedAt:4102444800000});await db.remove(`playAccounts/${uid}`);}
   await removeAuth(uid);
   return {deleted:true};
  }
  throw new Failure(404,'Not found');
 }
 async function maintain() {
  const expired=await db.query('closedAccounts',{fieldFilter:{field:{fieldPath:'expiresAt'},op:'LESS_THAN_OR_EQUAL',value:{integerValue:String(Date.now())}}},100);
  await db.deleteMany(expired.map(d=>d.path));
  const due=await db.query('playPurchases',{fieldFilter:{field:{fieldPath:'checkedAt'},op:'LESS_THAN',value:{integerValue:String(Date.now()-3600000)}}},8);
  for(const p of due) if(p.data.uid && p.data.token) {try{await reconcile(p.data.uid,p.data.token);}catch{/* Retry on the next scheduled batch; never log tokens. */}}
 }
 return {call,maintain};
}
export {PRODUCT,PACKAGE};
