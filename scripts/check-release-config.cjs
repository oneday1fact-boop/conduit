// Public Firebase config must be present before building a release that advertises cloud/Pro.
const fs=require('node:fs');const vm=require('node:vm');
const context={window:{}};
try {
 vm.runInNewContext(fs.readFileSync('www/firebase-config.js','utf8'),context,{timeout:1000});
 const config=context.window.CONDUIT_FIREBASE_CONFIG;
 for(const key of ['apiKey','authDomain','projectId','appId']) {
  if(typeof config?.[key]!=='string' || !config[key].trim() || /YOUR_|REPLACE|EXAMPLE/i.test(config[key])) throw new Error('Missing Firebase '+key);
 }
 if(context.window.CONDUIT_CLOUD_SERVICES_READY!==true) throw new Error('Cloud services have not completed deployment and validation');
 if(!context.window.CONDUIT_GOOGLE_WEB_CLIENT_ID?.endsWith('.apps.googleusercontent.com')) throw new Error('Google sign-in client is missing');
 if(!context.window.CONDUIT_BILLING_API_URL?.startsWith('https://')) throw new Error('Verified free-tier billing endpoint is missing');
 console.log('PASS: public Firebase release configuration is present. Backend deployment and Play license testing still require verification.');
} catch(error) { console.error('ERROR: '+error.message+'. Connect the existing Firebase project before building the Pro release.');process.exit(1); }
