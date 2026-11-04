/* Runtime-independent purchase rules; callers supply SHA-256. */
module.exports=function createPolicy(hash) {
const PRODUCT='conduit_pro_lifetime';
const PACKAGE='com.oneday1fact.conduit';
const accountId=uid=>hash('conduit:'+uid);
function validate(purchase,uid) {
  if(purchase.purchaseState!==0 || purchase.consumptionState!==0 ||
    (purchase.productId && purchase.productId!==PRODUCT) ||
    purchase.obfuscatedExternalAccountId!==accountId(uid) ||
    (purchase.quantity??1)!==1 || purchase.refundableQuantity===0) return false;
  return true;
}
return {PRODUCT,PACKAGE,hash,accountId,validate};
};
