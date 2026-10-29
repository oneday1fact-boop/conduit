const {createHash}=require('node:crypto');
const createPolicy=require('./purchase-rules.cjs');
module.exports=createPolicy(value=>createHash('sha256').update(value).digest('hex'));
