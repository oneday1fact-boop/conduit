/* Fit modal content into pages. Keep live controls and their listeners intact. */
(() => {
  let active = null;
  function mount(dialog) {
    active?.stop();
    const title = dialog.querySelector('#dialogTitle');
    const close = dialog.querySelector('.dialog-close');
    const content = [...dialog.children].filter(node => node !== title && node !== close);
    const heading = document.createElement('div'); heading.className = 'dialog-heading';
    if (title) heading.append(title);
    if (close) heading.append(close);
    const viewport = document.createElement('div'); viewport.className = 'dialog-viewport';
    const pager = document.createElement('nav'); pager.className = 'dialog-pager'; pager.setAttribute('aria-label','Dialog pages');
    const previous = document.createElement('button'); previous.type = 'button'; previous.className = 'secondary'; previous.textContent = 'Previous';
    const status = document.createElement('span'); status.setAttribute('aria-live','polite');
    const next = document.createElement('button'); next.type = 'button'; next.className = 'secondary'; next.textContent = 'Next';
    pager.append(previous,status,next); dialog.replaceChildren(heading,viewport,pager);
    let pages = [], index = 0, frame = null, stopped = false;
    const observer = new MutationObserver(() => schedule());
    function show(focus = false) {
      pages.forEach((page,i) => page.hidden = i !== index);
      previous.disabled = index === 0; next.disabled = index === pages.length-1;
      status.textContent = `${index+1} / ${pages.length}`;
      pager.hidden = pages.length < 2;
      if (focus) (pages[index].querySelector('button:not(:disabled),input:not(:disabled),a[href]') || title || dialog).focus({preventScroll:true});
    }
    function fit() {
      frame = null; if (stopped || !dialog.isConnected || dialog.closest('[hidden]')) return;
      observer.disconnect();
      // Reserve navigation space consistently so adding a page cannot cause another reflow.
      pager.hidden = false;
      const oldNode = pages[index]?.firstElementChild;
      viewport.replaceChildren(); pages = [];
      function page() {const p=document.createElement('section'); p.className='dialog-page'; viewport.append(p); pages.push(p); return p;}
      let current = page();
      const budget = viewport.clientHeight;
      for (const node of content) {
        current.append(node);
        if (budget > 0 && current.scrollHeight > budget+1 && current.children.length > 1) {
          node.remove(); current.hidden = true; current = page(); current.append(node);
        }
      }
      const retained = pages.findIndex(p => oldNode && p.contains(oldNode));
      index = retained >= 0 ? retained : Math.min(index,pages.length-1);
      show();
      observer.observe(viewport,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
    }
    function schedule() {if (!stopped && frame === null) frame = requestAnimationFrame(fit);}
    previous.onclick = () => {if(index>0){index--;show(true);}};
    next.onclick = () => {if(index<pages.length-1){index++;show(true);}};
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    resize?.observe(dialog);
    window.visualViewport?.addEventListener('resize',schedule);
    window.addEventListener('resize',schedule);
    active = {stop(){stopped=true;observer.disconnect();resize?.disconnect();if(frame!==null)cancelAnimationFrame(frame);window.visualViewport?.removeEventListener('resize',schedule);window.removeEventListener('resize',schedule);}};
    content.forEach(node => viewport.append(node));
    schedule();
  }
  window.ConduitDialogLayout = {mount};
})();
