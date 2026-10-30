/* Account and archive UI. Uses the existing board, saves and focus-trapped dialog. */
'use strict';
let accountUid=null, syncTimer=null, syncing=false, syncQueued=false;
const cloud=window.ConduitCloud, core=window.ConduitProCore;
const userKey=uid=>`${STORAGE_KEY}:account:${uid}`;
function accountLabel(message) {
  $('accountStatus').textContent=message || (cloud.user ? 'Signed in · saving progress' : 'Progress saved on this device');
  $('accountButton').setAttribute('aria-label',cloud.user ? 'Your account' : 'Sign in to your account');
  $('accountButton').title=cloud.user ? 'Your account' : 'Sign in to your account';
}
function snapshotRecords() {
  const records={};
  for(const [key,r] of Object.entries(store.records)) {
    const puzzle=PUZZLES.find(p=>p.id===r.puzzleId);
    records[key]={...r, completed:r.completed===true || (puzzle && validRecord(r,puzzle) && isSolved(puzzle,r.slots)) || (key.startsWith('daily:') && store.completedDates.includes(key.slice(6))), dailyWin:r.dailyWin===true || (key.startsWith('daily:') && store.completedDates.includes(key.slice(6)))};
  }
  return core.mergeRecords({},records);
}
function queueSync() {
  clearTimeout(syncTimer);
  if(!cloud.user) return;
  syncTimer=setTimeout(async()=>{
    if(syncing) {syncQueued=true;return;}
    syncing=true;
    try {await cloud.sync(snapshotRecords());} finally {syncing=false; if(syncQueued){syncQueued=false;queueSync();}}
  },1500);
}
function mergeCloud(records) {
  const merged=core.mergeRecords(snapshotRecords(),records);
  const changed=JSON.stringify(merged)!==JSON.stringify(snapshotRecords());
  if(changed) {
    const oldRecords=snapshotRecords();
    store.records=merged;
    store.completedDates=[...new Set([...store.completedDates,...Object.entries(merged).filter(([key,r])=>key.startsWith("daily:") && r.dailyWin).map(([key])=>key.slice(6))])];
    // Archive completions do not retroactively build the Daily streak.
    if(game) {
      const r=merged[game.key];
      if(validRecord(r,game.puzzle) && JSON.stringify(r)!==JSON.stringify(oldRecords[game.key])) {
        game.slots=[...r.slots]; game.elapsed=r.elapsed; game.hintsUsed=r.hintsUsed;
        game.completed=isSolved(game.puzzle,game.slots); render(); resetClockBaseline();
      }
    }
    persist();
  }
  queueSync();
}
window.addEventListener('conduit:localsave',queueSync);
window.addEventListener('conduit:progress',event=>mergeCloud(event.detail.records));
window.addEventListener('conduit:sync',event=>accountLabel(event.detail.message));
window.addEventListener('conduit:account',event=>{
  clearTimeout(syncTimer);
  const next=event.detail.user?.uid || null;
  if(next!==accountUid) {
    settleClock(); saveGame();
    const preferences=Object.fromEntries(["theme","sound","music","haptics","tutorialSeen"].map(key=>[key,store[key]]));
    const guest=accountUid===null ? JSON.parse(JSON.stringify(store)) : null;
    accountUid=next;
    activeStorageKey=next ? userKey(next) : STORAGE_KEY;
    let saved; try {saved=JSON.parse(localStorage.getItem(activeStorageKey));} catch {}
    if(next) {
      store={...emptyStore(),...saved,records:core.mergeRecords(guest?.records,saved?.records),completedDates:[...new Set([...(guest?.completedDates||[]),...(saved?.completedDates||[])])]};
    } else store=loadStore();
    Object.assign(store,preferences);
    // No account can overwrite another account's local save or the guest save.
    game=null; openPuzzle('daily'); persist(); applyTheme(); renderMusicButton(); renderHapticsButton();
  }
  accountLabel();
});
window.addEventListener('conduit:entitlement',()=>{
  if(!cloud.pro && mode==='pro') openPuzzle('daily');
  if(modalType==='pro') showPro();
});
function closeHeader(label) {
  return `<button class="dialog-close" id="closeAccountPanel" aria-label="Close ${label}">×</button>`;
}
function wireClose(){ $('closeAccountPanel').onclick=()=>closeModal(); }
function feedback(message){const node=$('proFeedback');if(node) node.textContent=message;}
async function action(button,fn,success) {
  button.disabled=true;
  try {await fn();feedback(success||'Done.');}
  catch(error){feedback(friendlyError(error));}
  finally {if(button.isConnected) button.disabled=false;}
}
function friendlyError(error) {
  const code=error?.code||'';
  if(/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Check your email and password and try again.';
  if(/email-already-in-use/.test(code)) return 'This email already has an account. Choose Sign in.';
  if(/weak-password/.test(code)) return 'Choose a password with at least 8 characters.';
  if(/network|unavailable/.test(code)) return 'Could not connect. Your progress is saved on this device.';
  if(/too-many/.test(code)) return 'Please wait a moment before trying again.';
  return error?.message?.replace(/^Firebase: /,'').slice(0,240) || 'Could not complete this request. Try again.';
}
function showAccount(create=false) {
  if(cloud.user) {
    openModal('account',`${closeHeader('account')}<div class="pro-eyebrow">Your CONDUIT account</div><h2 id="dialogTitle">Play on any device.</h2><p id="accountEmail"></p><p id="accountVerification" class="muted"></p><div class="pro-actions"><button id="restoreAccount" class="secondary">Restore purchases</button><button id="signOutAccount" class="secondary">Sign out</button><button id="deleteAccount" class="account-link account-danger">Delete account and cloud progress</button></div><p id="proFeedback" class="pro-feedback" role="status"></p>`);
    $('accountEmail').textContent=cloud.user.email;
    $('accountVerification').textContent=cloud.user.emailVerified ? 'Email verified. Progress sync is enabled.' : 'Check your inbox to verify your email before buying Pro.';
    $('restoreAccount').onclick=event=>action(event.currentTarget,()=>cloud.restore(),'Purchases checked.');
    $('signOutAccount').onclick=event=>action(event.currentTarget,async()=>{await cloud.logout();showAccount();});
    $('deleteAccount').onclick=showDeleteAccount;
    wireClose();return;
  }
  openModal('account',`${closeHeader('account')}<div class="pro-eyebrow">Keep your chain going</div><h2 id="dialogTitle">${create?'Create an account':'Welcome back.'}</h2><p class="muted">Save puzzle progress and restore Pro on another device. Daily and Practice also work without an account.</p><button id="googleAccount" class="primary wide">Continue with Google</button><form id="accountForm" class="account-form"><label>Email<input id="accountEmailInput" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input id="accountPasswordInput" type="password" autocomplete="${create?'new-password':'current-password'}" minlength="${create?8:1}" required></label><button id="submitAccount" type="submit" class="primary">${create?'Create account':'Sign in'}</button></form><div class="account-secondary"><button id="toggleAccount">${create?'Already have an account?':'Create an account'}</button><button id="resetPassword">Reset password</button></div><p class="muted">By creating an account, you agree to our <a href="https://oneday1fact-boop.github.io/conduit/" target="_blank" rel="noopener">privacy policy</a>.</p><p id="proFeedback" class="pro-feedback" role="status"></p>`);
  wireClose();
  $('googleAccount').disabled=!cloud.configured || !window.CONDUIT_GOOGLE_WEB_CLIENT_ID;
  $('googleAccount').onclick=event=>action(event.currentTarget,async()=>{await cloud.google();showAccount();},'Signed in.');
  if(window.CONDUIT_EMAIL_SIGN_IN_ENABLED!==true) {
    $('accountForm').hidden=true;$('toggleAccount').hidden=true;$('resetPassword').hidden=true;
  }
  if(!cloud.configured){$('submitAccount').disabled=true;feedback('Account services are being prepared. Your existing progress stays on this device.');}
  $('toggleAccount').onclick=()=>showAccount(!create);
  $('accountForm').onsubmit=event=>{
    event.preventDefault();const email=$('accountEmailInput').value.trim(),password=$('accountPasswordInput').value;
    void action($('submitAccount'),async()=>{await cloud.login(email,password,create);showAccount();},create?'Account created. Check your email to verify it.':'Signed in.');
  };
  $('resetPassword').onclick=event=>action(event.currentTarget,async()=>{const email=$('accountEmailInput').value.trim();if(!email) throw new Error('Enter your email first.');await cloud.reset(email);},'If an account exists, a reset link has been sent.');
}
function showDeleteAccount() {
  openModal('account',`${closeHeader('account')}<h2 id="dialogTitle">Delete your account?</h2><p>This permanently removes your sign-in and cloud progress. Your guest progress on this device stays saved. Google Play purchases are not refunded. Contact oneday1fact@gmail.com for help moving a Pro purchase after account deletion.</p><div class="pro-actions"><button id="confirmDelete" class="secondary account-danger">Permanently delete account</button><button id="cancelDelete" class="primary">Keep account</button></div><p id="proFeedback" class="pro-feedback" role="status"></p>`);
  wireClose();$('cancelDelete').onclick=()=>showAccount();
  $('confirmDelete').onclick=event=>action(event.currentTarget,async()=>{const key=userKey(cloud.user.uid);await cloud.deleteAccount();localStorage.removeItem(key);showAccount();},'Your account was deleted.');
}
let calendarMonth=null;
function showPro() {
  settleClock();saveGame();
  if(cloud.pro) {showCalendar();return;}
  openModal('pro',`${closeHeader('Pro')}<div class="pro-eyebrow">CONDUIT PRO ✦</div><h2 id="dialogTitle">Every day deserves<br>another look.</h2><div class="pro-card"><strong>Your puzzle archive, unlocked.</strong><p>Return to any available past Daily puzzle. Pick a date and finish the chains you missed.</p><div class="pro-features"><div><b>▦</b><span>A calendar of previous puzzles</span></div><div><b>✓</b><span>Completed and in-progress markers</span></div><div><b>↻</b><span>Progress and Pro across devices</span></div></div><p>One purchase. No subscription. Daily and Practice stay free. Optional rewarded Hint ads remain available.</p></div><div class="pro-actions"><button id="buyPro" class="primary" disabled>Checking availability…</button><button id="restorePro" class="secondary">Restore purchases</button><button id="proAccount" class="account-link">${cloud.user?'Manage account':'Sign in or create an account'}</button></div><p id="proFeedback" class="pro-feedback" role="status"></p>`);
  wireClose();$('proAccount').onclick=()=>showAccount();
  $('restorePro').onclick=event=>action(event.currentTarget,()=>cloud.restore(),'Purchases restored.');
  const button=$('buyPro');
  button.onclick=event=>action(event.currentTarget,()=>cloud.buy(),'Pro unlocked.');
  if(!cloud.configured){button.textContent='Pro coming soon';feedback('Pro purchase services are not configured in this build. Planned US price: $2.99 once.');return;}
  if(!cloud.billingReady){button.textContent='Pro coming soon';feedback('The secure purchase service is being prepared. Pro is $2.99 once when available.');return;}
  if(!cloud.user){button.textContent='Sign in to unlock Pro';button.disabled=false;button.onclick=()=>showAccount();return;}
  cloud.price().then(price=>{if(button.isConnected){button.textContent=`Unlock Pro · ${price} once`;button.disabled=false;}}).catch(()=>{if(button.isConnected){button.textContent='Unavailable on this install';feedback('Install CONDUIT from Google Play to purchase or restore Pro.');}});
}
function showCalendar() {
  const today=localDateKey(), now=new Date(today+'T12:00:00');
  calendarMonth=calendarMonth||new Date(now.getFullYear(),now.getMonth(),1);
  const year=calendarMonth.getFullYear(), month=calendarMonth.getMonth();
  openModal('calendar',`${closeHeader('archive')}<div class="pro-eyebrow">CONDUIT PRO ✦</div><h2 id="dialogTitle">Your puzzle archive</h2><p class="muted">Pick a past day. Your place is saved.</p><div class="calendar-toolbar"><button id="previousMonth" class="calendar-nav" aria-label="Previous month">‹</button><h3 id="calendarMonth"></h3><button id="nextMonth" class="calendar-nav" aria-label="Next month">›</button></div><div id="calendarGrid" class="calendar-grid" role="group" aria-label="Puzzle calendar"></div><div class="calendar-legend"><span class="complete">✓ Completed</span><span class="started">• In progress</span><span>○ Unplayed</span></div><p class="muted">Archive wins stay separate from your Daily streak. The archive begins 17 October 2026.</p>`);
  wireClose();$('calendarMonth').textContent=calendarMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  $('previousMonth').disabled=year===2026 && month===9;
  $('nextMonth').disabled=year===now.getFullYear() && month===now.getMonth();
  $('previousMonth').onclick=()=>{calendarMonth=new Date(year,month-1,1);showCalendar();};
  $('nextMonth').onclick=()=>{calendarMonth=new Date(year,month+1,1);showCalendar();};
  for(const name of ['S','M','T','W','T','F','S']){const span=document.createElement('span');span.className='calendar-weekday';span.textContent=name;$('calendarGrid').append(span);}
  for(const date of core.monthCells(year,month)) {
    if(!date){$('calendarGrid').append(document.createElement('span'));continue;}
    const r=store.records['daily:'+date], puzzle=PUZZLES[dailyIndex(date)];
    const complete=store.completedDates.includes(date) || r?.completed || (puzzle && validRecord(r,puzzle) && isSolved(puzzle,r.slots));
    const started=!complete && r?.slots?.some(Boolean);
    const enabled=core.available(date,today,PUZZLES.length), status=complete?'Completed':started?'In progress':'Unplayed';
    const button=document.createElement('button');button.className='calendar-day'+(complete?' complete':started?' started':'');button.disabled=!enabled;
    button.setAttribute('aria-label',`${date}: ${enabled?status:date===today?'Today — use Daily': 'Unavailable'}`);
    button.append(document.createTextNode(String(Number(date.slice(8)))));
    const mark=document.createElement('small');mark.textContent=complete?'✓':started?'•':'○';mark.setAttribute('aria-hidden','true');button.append(mark);
    button.onclick=()=>openPuzzle('pro',0,date);$('calendarGrid').append(button);
  }
}
window.ConduitShowPro=showPro;
$('proButton').onclick=showPro;$('accountButton').onclick=()=>showAccount();
window.conduitStarted.then(()=>cloud.init()).catch(()=>accountLabel('Progress saved on this device'));

