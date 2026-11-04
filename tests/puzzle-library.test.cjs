const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const data=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../www/puzzle-library.json'),'utf8'));

test('expanded daily schedule preserves published dates and separates repeated compounds',()=>{
 assert.equal(data.puzzles.length,1800);
 assert.equal(new Set(data.puzzles.map(p=>p.id)).size,1800);
 assert.equal(new Set(data.puzzles.map(p=>p.chain.join('|'))).size,1800);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(data.puzzles.slice(0,14))).digest('hex'),'833ddab5d7898c64e981b626c66ad51bad6a81f5dc28bddcce280f42e65717a3');
 const last=new Map();
 data.puzzles.forEach((p,day)=>{
  for(let i=0;i<4;i++){
   const word=(p.chain[i]+p.chain[i+1]).toLowerCase();
   if(day>=14 && last.has(word))assert.ok(day-last.get(word)>=8,`${word} repeats within eight days at day ${day}`);
   last.set(word,day);
  }
 });
});

test('every puzzle has exactly one complete solution using its six bank words',()=>{
 const approved=new Set(data.approvedCompounds);
 for(const p of data.puzzles){
  const bank=[...p.chain.slice(1,4),...p.decoys];let solutions=0;
  for(const a of bank)for(const b of bank)for(const c of bank){
   if(a===b||a===c||b===c)continue;
   const chain=[p.chain[0],a,b,c,p.chain[4]];
   if(chain.slice(0,4).every((w,i)=>approved.has((w+chain[i+1]).toLowerCase())))solutions++;
  }
  assert.equal(solutions,1,p.id);
 }
});
