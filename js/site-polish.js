(function () {
  'use strict';
  const paths = {
    store: '<path d="M3 10h18M4 10v11h16V10M2 10l3-7h14l3 7M9 21v-7h6v7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-12 4h2m4 0h2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="m7 3 3 5-3 3c1 3 3 5 6 6l3-3 5 3c0 3-2 5-5 4C9 19 5 15 3 8 2 5 4 3 7 3Z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    chat: '<path d="M21 11a9 9 0 0 1-9 9H4l-3 2 2-6a9 9 0 1 1 18-5Z"/><path d="M7 11h10m-10 4h6"/>',
    parking: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
    wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a5 5 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',
    access: '<circle cx="12" cy="4" r="2"/><path d="M4 9h16m-8 0v6m0 0-5 7m5-7 5 7"/>',
    bank: '<path d="m2 8 10-6 10 6H2Zm2 3v8m5-8v8m6-8v8m5-8v8M2 22h20"/>',
    bolt: '<path d="m14 2-9 12h7l-2 8 9-12h-7l2-8Z"/>',
    game: '<path d="M7 7h10c3 0 5 12 2 13-2 1-4-4-7-4s-5 5-7 4C2 19 4 7 7 7Z"/><path d="M6 11h6m-3-3v6m7-3h.01m2 3h.01"/>',
    work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    camera: '<path d="M3 7h4l2-4h6l2 4h4v14H3Z"/><circle cx="12" cy="13" r="4"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    alert: '<path d="m12 2 10 19H2L12 2Zm0 6v6m0 3h.01"/>',
    star: '<path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1 3-7Z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>'
  };
  const emoji = {'📅':'calendar','📍':'pin','📞':'phone','✉':'mail','💬':'chat','🚗':'parking','🛡':'shield','📶':'wifi','♿':'access','🏧':'bank','⚡':'bolt','✨':'star','🎮':'game','💼':'work','👤':'user','📸':'camera','👗':'store','💡':'bolt','🎵':'calendar','✅':'check','⚠':'alert'};
  function icon(name) { return '<svg class="mall-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' + (paths[name] || paths.store) + '</svg>'; }
  function replaceEmoji(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement || node.parentElement.closest('script,style,textarea,svg,[contenteditable]')) continue;
      if (Object.keys(emoji).some(symbol => node.nodeValue.includes(symbol))) nodes.push(node);
    }
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      let text = node.nodeValue;
      const pattern = /(📅|📍|📞|✉|💬|🚗|🛡|📶|♿|🏧|⚡|✨|🎮|💼|👤|📸|👗|💡|🎵|✅|⚠)\uFE0F?/gu;
      let last = 0;
      for (const match of text.matchAll(pattern)) {
        fragment.append(document.createTextNode(text.slice(last,match.index)));
        const span = document.createElement('span'); span.className='mall-icon-slot'; span.innerHTML=icon(emoji[match[1]]); fragment.append(span);
        last=match.index+match[0].length;
      }
      fragment.append(document.createTextNode(text.slice(last))); node.replaceWith(fragment);
    });
  }
  function init() {
    // A native single-row carousel keeps logos usable without animation libraries.
    const brandSection = document.getElementById('brandCloud');
    if (brandSection) {
      const track = brandSection.querySelector('.brands-grid');
      const play = brandSection.querySelector('[data-brand-play]');
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let playing = !motion.matches, visible = false, hovered = false, timer;
      function move(direction) {
        const step = track.firstElementChild.getBoundingClientRect().width + 16;
        const end = track.scrollWidth - track.clientWidth;
        let left = track.scrollLeft + direction * step;
        if (left > end + 2) left = 0;
        if (left < -2) left = end;
        track.scrollTo({ left, behavior: motion.matches ? 'auto' : 'smooth' });
      }
      function schedule() {
        clearInterval(timer);
        play.textContent = playing ? 'Pause' : 'Play';
        play.setAttribute('aria-label', playing ? 'Pause logo slider' : 'Play logo slider');
        play.setAttribute('aria-pressed', String(playing));
        if (playing && visible && !hovered && !document.hidden && !brandSection.contains(document.activeElement) && !motion.matches) timer = setInterval(() => move(1), 3500);
      }
      function stop() { playing = false; schedule(); }
      brandSection.querySelector('[data-brand-prev]').addEventListener('click', () => { stop(); move(-1); });
      brandSection.querySelector('[data-brand-next]').addEventListener('click', () => { stop(); move(1); });
      play.addEventListener('click', () => { playing = !playing; schedule(); });
      track.addEventListener('pointerdown', stop);
      track.addEventListener('wheel', stop, { passive: true });
      track.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); stop(); move(event.key === 'ArrowRight' ? 1 : -1); }
      });
      brandSection.addEventListener('mouseenter', () => { hovered = true; schedule(); });
      brandSection.addEventListener('mouseleave', () => { hovered = false; schedule(); });
      brandSection.addEventListener('focusin', schedule);
      brandSection.addEventListener('focusout', () => setTimeout(schedule, 0));
      document.addEventListener('visibilitychange', schedule);
      motion.addEventListener('change', () => { if (motion.matches) playing = false; schedule(); });
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: .15 }).observe(brandSection);
      schedule();
    }
    document.querySelectorAll('[data-mall-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    replaceEmoji(document.body);
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType===1 && !node.closest('svg,.mall-icon-slot')) replaceEmoji(node);
    }))).observe(document.body,{childList:true,subtree:true});
    const content=document.querySelector('main,.subpage-content,#page-stage');
    if(content) {
      if(!content.id)content.id='main-content';
      content.setAttribute('tabindex','-1');
      const skip=document.createElement('a');skip.className='mall-skip-link';skip.href='#'+content.id;skip.textContent='Skip to content';document.body.prepend(skip);
    }
    // Keep touch interaction native; hover animation runs only with a fine pointer.
    if(window.gsap&&window.ScrollTrigger&&document.body.classList.contains('activation-page')) {
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
        document.querySelectorAll('.activation-card').forEach(card=>gsap.from(card,{y:20,opacity:0,duration:.55,clearProps:'opacity,transform',scrollTrigger:{scroller:document.querySelector('.subpage-content'),trigger:card,start:'top 93%',once:true}}));
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
