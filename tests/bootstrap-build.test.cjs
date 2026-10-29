const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
test('billing bootstrap permits only an explicitly disabled cloud build; normal release stays blocked',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'conduit-bootstrap-'));
 try {
  mkdirSync(join(cwd,'www'));
  const file=join(cwd,'www/firebase-config.js');
  const base='window.CONDUIT_FIREBASE_CONFIG={apiKey:"fixture",authDomain:"fixture.firebaseapp.com",projectId:"fixture",appId:"fixture"};';
  const run=args=>spawnSync(process.execPath,[resolve(__dirname,'../scripts/check-release-config.cjs'),...args],{cwd,encoding:'utf8'});
  writeFileSync(file,base+'window.CONDUIT_CLOUD_SERVICES_READY=false;');
  assert.notEqual(run([]).status,0);
  const bootstrap=run(['--internal-billing-bootstrap']);
  assert.equal(bootstrap.status,0,bootstrap.stderr);
  assert.match(bootstrap.stdout,/Do not roll out/);
  writeFileSync(file,base+'window.CONDUIT_CLOUD_SERVICES_READY=true;');
  assert.notEqual(run(['--internal-billing-bootstrap']).status,0);
  assert.notEqual(run(['--skip-checks']).status,0);
 } finally {rmSync(cwd,{recursive:true,force:true});}
});
