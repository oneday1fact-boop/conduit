const {createHash}=require('node:crypto');
const PRODUCT='conduit_pro_lifetime';
const PACKAGE='com.oneday1fact.conduit';
const hash=value=>createHash('sha256').update(value).digest('hex');
const accountId=uid=>hash('conduit:'+uid);
function validate(purchase,uid) {
  if(purchase.purchaseState!==0 || purchase.consumptionState!==0 ||
    (purchase.productId && purchase.productId!==PRODUCT) ||
    purchase.obfuscatedExternalAccountId!==accountId(uid) ||
    (purchase.quantity??1)!==1 || purchase.refundableQuantity===0) return false;
  return true;
}
module.exports={PRODUCT,PACKAGE,hash,accountId,validate};
