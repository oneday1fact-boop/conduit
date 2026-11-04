const {test}=require('node:test');const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const fs=require('node:fs');

test('dialog paging retains live actions and hides other pages',async()=>{
 const dom=new JSDOM('<div id="dialog"><h2 id="dialogTitle">Help</h2><button class="dialog-close">Close</button><button data-height="90" id="one">One</button><button data-height="90" id="two">Two</button><button data-height="90" id="three">Three</button></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let count=0;
 Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return this.classList.contains('dialog-viewport')?150:0;}});
 Object.defineProperty(w.HTMLElement.prototype,'scrollHeight',{get(){return [...this.children].reduce((sum,n)=>sum+Number(n.dataset.height||0),0);}});
 w.eval(fs.readFileSync(require('node:path').join(__dirname,'../www/dialog-layout.js'),'utf8'));
 const action=d.getElementById('two');action.onclick=()=>count++;
 w.ConduitDialogLayout.mount(d.getElementById('dialog'));
 await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
 const pages=[...d.querySelectorAll('.dialog-page')];assert.equal(pages.length,3);
 assert.equal(pages.filter(p=>!p.hidden).length,1);assert.equal(pages[0].hidden,false);
 const nav=d.querySelector('.dialog-pager');nav.lastElementChild.click();
 assert.equal(pages[1].hidden,false);assert.equal(pages[0].hidden,true);
 action.click();assert.equal(count,1);assert.equal(d.getElementById('two'),action);
 assert.equal(nav.firstElementChild.disabled,false);nav.firstElementChild.click();assert.equal(pages[0].hidden,false);
 dom.window.close();
});
