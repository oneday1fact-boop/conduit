// Exercise release preparation and cleanup using disposable files and mocked build tools.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'conduit-release-'));
const write = (name, content, mode) => {
  const dest = path.join(fixture, name);
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  fs.writeFileSync(dest, content, mode ? {mode} : undefined);
};
try {
  const script = fs.readFileSync(path.join(root, 'build-android-production.sh'), 'utf8')
    .replaceAll('$HOME/.conduit-signing', fixture + '/signing');
  write('build-android-production.sh', script);
  write('admob-bridge-src.js', fs.readFileSync(path.join(root, 'admob-bridge-src.js')));
  const original = '// ORIGINAL DEVELOPMENT BUNDLE\n';
  write('www/admob-bridge.js', original);
  const run = fail => spawnSync('bash', ['build-android-production.sh'], {
    cwd:fixture, encoding:'utf8', env:{...process.env, PATH:fixture+'/bin:'+process.env.PATH, FAIL_SYNC:fail?'1':'0'}
  });
  // A missing signing setup must fail without truncating the development bundle.
  assert.notEqual(run(false).status, 0);
  assert.equal(fs.readFileSync(path.join(fixture,'www/admob-bridge.js'),'utf8'), original);
  write('signing/key.properties', '# disposable fixture, no credentials');
  write('signing/conduit-upload.jks', 'fixture');
  write('node_modules/.bin/esbuild', '#!/bin/bash\nset -e\ncp "$1" www/admob-bridge.js\n', 0o755);
  write('bin/npx', '#!/bin/bash\nset -e\nmkdir -p android/app/src/main/assets/public\ncp www/admob-bridge.js android/app/src/main/assets/public/admob-bridge.js\nif [ "${FAIL_SYNC:-0}" = "1" ]; then exit 1; fi\n', 0o755);
  write('android/gradlew', '#!/bin/bash\nset -e\nmkdir -p app/build/outputs/bundle/release\ncp app/src/main/assets/public/admob-bridge.js app/build/outputs/bundle/release/app-release.aab\n', 0o755);
  const result = run(false);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const prepared = fs.readFileSync(path.join(fixture,'android/app/build/outputs/bundle/release/app-release.aab'),'utf8');
  assert(prepared.includes('const USE_TEST_ADS = false;'));
  assert(!prepared.includes('initializeForTesting: true'));
  assert(!prepared.includes('isTesting: true'));
  for (const flag of ['tagForChildDirectedTreatment: true','tagForUnderAgeOfConsent: true','maxAdContentRating: MaxAdContentRating.General']) assert(prepared.includes(flag));
  for (const name of ['www/admob-bridge.js','android/app/src/main/assets/public/admob-bridge.js']) assert.equal(fs.readFileSync(path.join(fixture,name),'utf8'),original);
  assert.notEqual(run(true).status,0);
  assert.equal(fs.readFileSync(path.join(fixture,'www/admob-bridge.js'),'utf8'),original);
  console.log('PASS: missing-signing, production flags, successful cleanup and sync-failure cleanup. Native build tools were mocked.');
} finally { fs.rmSync(fixture,{recursive:true,force:true}); }
