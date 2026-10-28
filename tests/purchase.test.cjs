const {test}=require('node:test');const assert=require('node:assert/strict');const {validate,accountId,hash}=require('../functions/purchase-policy.cjs');
const purchase={purchaseState:0,consumptionState:0,obfuscatedExternalAccountId:accountId('user'),quantity:1,refundableQuantity:1,productId:'conduit_pro_lifetime'};
test('paid unconsumed purchase bound to this account is valid',()=>assert.equal(validate(purchase,'user'),true));
test('pending, refunded, consumed, wrong product and other-account tokens never grant Pro',()=>{
 for(const p of [{purchaseState:2},{purchaseState:1},{consumptionState:1},{productId:'wrong'},{quantity:2},{refundableQuantity:0},{obfuscatedExternalAccountId:null}]) assert.equal(validate({...purchase,...p},'user'),false);
 assert.equal(validate(purchase,'other'),false);
});
test('purchase ownership uses stable opaque hashes, never a raw email/UID',()=>{assert.equal(accountId('user').length,64);assert.notEqual(accountId('user'),hash('user'));});
