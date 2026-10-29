import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

test('browser ESM bundle starts without dynamic require and keeps service disabled',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'conduit-worker-'));
 try {
  const outfile=join(dir,'worker.mjs');
  await build({entryPoints:[fileURLToPath(new URL('../src/index.mjs',import.meta.url))],bundle:true,platform:'browser',format:'esm',external:['node:crypto'],outfile});
  const source=await readFile(outfile,'utf8');
  assert.doesNotMatch(source,/__require\(["']node:crypto["']\)/);
  const {default:worker}=await import(pathToFileURL(outfile).href);
  const response=await worker.fetch(new Request('https://example.test/v1/billing/account',{method:'POST'}),{SERVICE_ENABLED:'false'});
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/being prepared/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
