// Public Firebase config must be present before building a release that advertises cloud/Pro.
const fs=require('node:fs');const vm=require('node:vm');
const context={window:{}};
try {
 vm.runInNewContext(fs.readFileSync('www/firebase-config.js','utf8'),context,{timeout:1000});
 const config=context.window.CONDUIT_FIREBASE_CONFIG;
 for(const key of ['apiKey','authDomain','projectId','appId']) {
  if(typeof config?.[key]!=='string' || !config[key].trim() || /YOUR_|REPLACE|EXAMPLE/i.test(config[key])) throw new Error('Missing Firebase '+key);
 }
 console.log('PASS: public Firebase release configuration is present. Backend deployment and Play license testing still require verification.');
} catch(error) { console.error('ERROR: '+error.message+'. Connect the existing Firebase project before building the Pro release.');process.exit(1); }
