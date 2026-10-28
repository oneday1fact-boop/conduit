#!/usr/bin/env node
// Release-safe data validation: no dependencies and no gameplay modifications.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const data = JSON.parse(read('www/puzzle-library.json'));
const fail = message => { throw new Error(message); };

assert.equal(data.schemaVersion, 1, 'Unsupported puzzle library schema');
assert(Number.isInteger(data.contentVersion) && data.contentVersion >= 1);
assert(Array.isArray(data.puzzles) && data.puzzles.length > 0);
assert(Array.isArray(data.approvedCompounds));
const approved = new Set(data.approvedCompounds.map(s => String(s).toUpperCase()));
assert.equal(approved.size, data.approvedCompounds.length, 'Duplicate approved compounds');

const seen = new Set();
for (const [index, p] of data.puzzles.entries()) {
  const tag = `puzzles[${index}]`;
  if (typeof p.id !== 'string' || !p.id.trim() || seen.has(p.id)) fail(`${tag}: missing or duplicate id`);
  seen.add(p.id);
  if (typeof p.name !== 'string' || !p.name.trim()) fail(`${tag}: missing name`);
  if (!Array.isArray(p.chain) || p.chain.length !== 5) fail(`${tag}: expected 5 chain words`);
  if (!Array.isArray(p.decoys) || p.decoys.length !== 3) fail(`${tag}: expected 3 decoys`);
  const words = [...p.chain, ...p.decoys];
  if (words.some(w => typeof w !== 'string' || !/^[A-Z]+$/.test(w))) fail(`${tag}: invalid word`);
  if (new Set(words).size !== words.length) fail(`${tag}: duplicate chain or decoy word`);
  for (let i = 0; i < p.chain.length - 1; i++) {
    const compound = p.chain[i] + p.chain[i + 1];
    if (!approved.has(compound)) fail(`${tag}: unapproved link ${compound}`);
  }
}
for (const file of ['www/index.html', 'www/admob-bridge.js', 'www/service-worker.js',
  'www/manifest.webmanifest', 'capacitor.config.json', 'android/gradlew']) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing release file: ${file}`);
}
const config = JSON.parse(read('capacitor.config.json'));
assert.equal(config.appId, 'com.oneday1fact.conduit');
assert.equal(config.webDir, 'www');
console.log(`PASS: ${data.puzzles.length} puzzles validated; release assets and Capacitor config present.`);
