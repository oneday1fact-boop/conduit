const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'../www');
async function game(){
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/not implemented/i.test(e.message)) errors.push(e);});
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="[^\"]+"><\/script>/g,'');
 // Evaluate the actual app scripts in browser order, with only external network/platform services mocked.
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 html=html.replace(/<script>[\s\S]*?<\/script>/g,'');
 const dom=new JSDOM(html,{url:'https://conduit.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'puzzle-library.json'),'utf8'))});
 w.ConduitAdMob={rewardHint:async()=>({earned:false})};
 w.ConduitCloud={configured:false,user:null,pro:false,init(){},sync:async()=>{}};
 w.localStorage.setItem('conduit-closed-compounds-v1',JSON.stringify({records:{},completedDates:[],tutorialSeen:true}));
 vm.runInContext(fs.readFileSync(path.join(root,'pro-core.js'),'utf8'),dom.getInternalVMContext());
 vm.runInContext(scripts[0],dom.getInternalVMContext());
 await w.conduitStarted;
 vm.runInContext(fs.readFileSync(path.join(root,'pro-ui.js'),'utf8'),dom.getInternalVMContext());
 return {dom,w,errors,click:id=>w.document.getElementById(id).click()};
}
test('free gameplay, Pro unavailable state and login screen work without Firebase configuration',async()=>{
 const {dom,w,errors,click}=await game();try{
 assert.match(w.document.getElementById('puzzleTitle').textContent,/Daily:/);
 click('proButton');assert.equal(w.document.getElementById('buyPro').disabled,true);assert.match(w.document.getElementById('proFeedback').textContent,/\$2.99/);
 click('closeAccountPanel');click('accountButton');assert.equal(w.document.getElementById('submitAccount').disabled,true);
 click('closeAccountPanel');click('practiceButton');assert.equal(w.document.querySelectorAll('.practice-choice').length,3);
 w.document.querySelector('.practice-choice').click();assert.match(w.document.getElementById('puzzleTitle').textContent,/Practice:/);
 assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
 }finally{dom.window.close();}
});
test('verified entitlement opens calendar; archive completion leaves Daily streak unchanged',async()=>{
 const {dom,w,click,errors}=await game();try{
 w.ConduitCloud.pro=true;click('proButton');assert.ok(w.document.getElementById('calendarGrid'));
 const date=w.document.querySelector('.calendar-day:not(:disabled)');assert.ok(date);date.click();assert.match(w.document.getElementById('puzzleTitle').textContent,/Archive:/);
 assert.equal(w.document.getElementById('proButton').getAttribute('aria-pressed'),'true');
 const words=vm.runInContext('game.puzzle.chain.slice(1,4)',dom.getInternalVMContext());
 words.forEach((word,i)=>{click('tile-'+word);click('slot-'+i);});
 const result=JSON.parse(w.localStorage.getItem('conduit-closed-compounds-v1'));
 const record=Object.values(result.records).find(r=>r.completed);
 assert.ok(record);assert.equal(record.dailyWin,false);assert.equal(result.completedDates.length,0);
 assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
 }finally{dom.window.close();}
});

test('account switching isolates local saves and sign-out restores guest progress',async()=>{
 const {dom,w,click}=await game();try{
 click('practiceButton');w.document.querySelector('.practice-choice').click();click('tile-FALL');click('slot-0');
 const guest=JSON.parse(w.localStorage.getItem('conduit-closed-compounds-v1'));
 const account=uid=>{w.ConduitCloud.user=uid?{uid,email:uid+'@example.test'}:null;w.dispatchEvent(new w.CustomEvent('conduit:account',{detail:{user:w.ConduitCloud.user}}));};
 account('alice');
 assert.ok(w.localStorage.getItem('conduit-closed-compounds-v1:account:alice'));
 const context=dom.getInternalVMContext();
 vm.runInContext("store.records['practice:alice-only']={puzzleId:'alice-only',slots:[null,null,null],elapsed:0,hintsUsed:0};persist()",context);
 account('bob');
 const bob=JSON.parse(w.localStorage.getItem('conduit-closed-compounds-v1:account:bob'));
 assert.equal(bob.records['practice:alice-only'],undefined);
 account(null);
 const restored=JSON.parse(w.localStorage.getItem('conduit-closed-compounds-v1'));
 assert.equal(restored.records['practice:alice-only'],undefined);
 const practiceKey=Object.keys(guest.records).find(k=>k.startsWith('practice:'));
 assert.deepEqual(restored.records[practiceKey].slots,guest.records[practiceKey].slots);
 }finally{dom.window.close();}
});

test('native haptics follow the player toggle and distinguish completion feedback',async()=>{
 const {dom,w,click}=await game();try{
 const effects=[];
 let registrations=0;
 w.Capacitor={Plugins:{},isPluginAvailable:name=>name==='ConduitHaptics',registerPlugin(name){
  assert.equal(name,'ConduitHaptics');registrations++;
  return this.Plugins[name]={perform:async({kind})=>{effects.push(kind);}};
 }};
 click('hapticsButton'); // Off: no feedback, including subsequent tile selections.
 click('practiceButton');w.document.querySelector('.practice-choice').click();
 click('tile-FALL');assert.deepEqual(effects,[]);
 click('hapticsButton');assert.deepEqual(effects,['light']);
 click('slot-0');click('tile-BACK');click('slot-1');click('tile-FIRE');click('slot-2');
 assert.equal(registrations,1);
 assert.ok(effects.includes('success'));
 assert.equal(effects.filter(k=>k==='complete').length,1);
 assert.equal(w.document.getElementById('hapticsButton').getAttribute('aria-pressed'),'true');
 }finally{dom.window.close();}
});
