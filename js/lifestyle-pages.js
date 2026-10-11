(function () {
  'use strict';
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scroller = document.querySelector('.subpage-content');
  const $ = id => document.getElementById(id);
  const photoUrl = name => './assets/lifestyle/' + name + '.webp';
  const photos = [
    ['mall-night','The mall after dark','spaces'], ['city-night','Mombasa from above','spaces'],
    ['facade-night','A brighter welcome','spaces'], ['mall-day','In the heart of the city','spaces'],
    ['community','Moments together','people'], ['team','The people behind your visit','people'],
    ['naivas','Everyday essentials at Naivas','shopping'], ['rudra','Discover Rudra','shopping'],
    ['grand-computer','Inside Grand Computer','shopping'], ['fresh-market','Fresh finds','shopping'],
    ['west-eleven','West 11 lifestyle','shopping'], ['mall-wings','A moment worth capturing','spaces']
  ].map(([name,caption,category]) => ({ imageUrl: photoUrl(name), caption, category }));

  document.querySelectorAll('.lp-links a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault(); target.scrollIntoView({behavior: reduced() ? 'auto' : 'smooth', block: 'start'});
  }));

  // Native scroll-snap provides touch swiping even when animation libraries fail.
  document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const track = carousel.querySelector('.lp-carousel-track');
    const slides = [...track.children];
    const dots = carousel.querySelector('.lp-dots');
    const status = carousel.querySelector('.lp-carousel-status');
    const play = carousel.querySelector('[data-play]');
    let active = 0, timer = null, playing = false, visible = false;
    slides.forEach((slide,index) => {
      slide.setAttribute('role','group'); slide.setAttribute('aria-roledescription','slide');
      slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);
      const dot = document.createElement('button'); dot.type = 'button'; dot.className = 'lp-dot';
      dot.setAttribute('aria-label',`Go to slide ${index + 1}`);
      dot.addEventListener('click', () => { stop(); go(index); }); dots.appendChild(dot);
    });
    function sync() {
      const left = track.scrollLeft;
      active = slides.reduce((best,slide,index) => Math.abs(slide.offsetLeft-left) < Math.abs(slides[best].offsetLeft-left) ? index : best, 0);
      [...dots.children].forEach((dot,index) => dot.setAttribute('aria-current',String(index === active)));
      status.textContent = String(active+1).padStart(2,'0') + ' / ' + String(slides.length).padStart(2,'0');
    }
    function go(index) {
      const next = (index + slides.length) % slides.length;
      track.scrollTo({left: slides[next].offsetLeft, behavior: reduced() ? 'auto' : 'smooth'});
    }
    function stop() { playing = false; clearInterval(timer); timer = null; if(play) { play.textContent = 'Play slideshow'; play.setAttribute('aria-pressed','false'); } }
    function schedule() {
      clearInterval(timer); timer = null;
      if (playing && visible && !document.hidden && !reduced()) timer = setInterval(() => go(active+1),5000);
    }
    carousel.querySelector('[data-prev]').addEventListener('click',() => {stop();go(active-1)});
    carousel.querySelector('[data-next]').addEventListener('click',() => {stop();go(active+1)});
    track.addEventListener('scroll',sync,{passive:true});
    track.addEventListener('pointerdown',stop);
    track.addEventListener('keydown',event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault();stop();go(active+(event.key==='ArrowRight'?1:-1)); }
    });
    carousel.addEventListener('focusin',() => {clearInterval(timer);timer=null});
    carousel.addEventListener('focusout',event => {if(!carousel.contains(event.relatedTarget))schedule()});
    if(play) play.addEventListener('click',() => {
      if(reduced())return;
      if(playing)stop();else {playing=true;play.textContent='Pause slideshow';play.setAttribute('aria-pressed','true');schedule()}
    });
    carousel.addEventListener('mouseenter',() => {clearInterval(timer);timer=null});
    carousel.addEventListener('mouseleave',schedule);
    document.addEventListener('visibilitychange',schedule);
    const motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
    function motionChanged(){if(motionQuery.matches)stop();if(play){play.disabled=motionQuery.matches;play.title=motionQuery.matches?'Slideshow paused for your reduced-motion preference':''}}
    motionQuery.addEventListener('change',motionChanged);motionChanged();
    new IntersectionObserver(entries => {visible=entries[0].isIntersecting;schedule()},{root:scroller,threshold:.2}).observe(carousel);
    window.addEventListener('resize',sync); sync();
  });

  const grid = $('photoGalleryGrid');
  let galleryItems = [...photos], galleryCategory = 'all', lightboxIndex = 0, returnFocus;
  function visiblePhotos() {return galleryItems.filter(item => galleryCategory==='all'||item.category===galleryCategory)}
  function showPhoto(index) {
    const items=visiblePhotos(); lightboxIndex=(index+items.length)%items.length;
    $('lightboxImg').src=items[lightboxIndex].imageUrl;
    $('lightboxImg').alt=items[lightboxIndex].caption;
    $('lightboxCaption').textContent=items[lightboxIndex].caption + ` · ${lightboxIndex+1} / ${items.length}`;
    document.dispatchEvent(new CustomEvent('gallery-photo-changed',{detail:{items,index:lightboxIndex}}));
  }
  function openPhoto(index) {
    returnFocus=document.activeElement; showPhoto(index);
    $('lightboxModal').hidden=false;
    $('page-stage').inert=true;
    $('lightboxModal').classList.add('is-active');$('lightboxModal').setAttribute('aria-hidden','false');
    scroller.style.overflowY='hidden';$('lightboxClose').focus();
  }
  function closePhoto() {
    $('lightboxModal').classList.remove('is-active');$('lightboxModal').setAttribute('aria-hidden','true');
    $('lightboxModal').hidden=true;
    $('page-stage').inert=false;
    scroller.style.overflowY='';if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
  }
  function renderGallery() {
    if(!grid)return;
    grid.replaceChildren();
    visiblePhotos().forEach((item,index) => {
      const button=document.createElement('button');button.type='button';button.className='lp-photo';
      button.setAttribute('aria-label','Enlarge '+item.caption);
      const img=document.createElement('img');img.src=item.imageUrl;img.alt=item.caption;img.loading='lazy';img.decoding='async';
      const caption=document.createElement('span');caption.className='lp-photo-caption';caption.textContent=item.caption;
      const category=document.createElement('small');category.textContent=item.category;caption.appendChild(category);
      button.append(img,caption);button.addEventListener('click',()=>openPhoto(index));grid.appendChild(button);
    });
    $('galleryCount').textContent=visiblePhotos().length+' photos';
    document.dispatchEvent(new CustomEvent('lifestyle-content-updated'));
  }
  if(grid) {
    document.addEventListener('gallery-select-photo',event=>showPhoto(event.detail.index));
    document.querySelectorAll('[data-gallery-filter]').forEach(filter => filter.addEventListener('click',()=>{
      galleryCategory=filter.dataset.galleryFilter;
      document.querySelectorAll('[data-gallery-filter]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===filter)));renderGallery();
    }));
    $('lightboxClose').addEventListener('click',closePhoto);
    $('lightboxPrev').addEventListener('click',()=>showPhoto(lightboxIndex-1));
    $('lightboxNext').addEventListener('click',()=>showPhoto(lightboxIndex+1));
    $('lightboxModal').addEventListener('click',event=>{if(event.target===$('lightboxModal'))closePhoto()});
    document.addEventListener('keydown',event=>{
      if(!$('lightboxModal').classList.contains('is-active'))return;
      if(event.key==='Escape')closePhoto();
      if(event.key==='ArrowRight'){event.preventDefault();showPhoto(lightboxIndex+1)}
      if(event.key==='ArrowLeft'){event.preventDefault();showPhoto(lightboxIndex-1)}
      if(event.key==='Tab') {
        const buttons=[...$('lightboxModal').querySelectorAll('button')];
        if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus()}
        else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus()}
      }
    });renderGallery();
  }

  function cached(key) {try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
  async function localEvents() {
    const local=cached('mombasa_live_events');if(Array.isArray(local)&&local.length)return local;
    try {const response=await fetch('./json/events.json');if(!response.ok)return [];const data=await response.json();return [...(data.upcoming||[]).map(e=>({...e,type:'upcoming'})),...(data.past||[]).map(e=>({...e,type:'past'}))]}catch{return []}
  }
  function renderEvents(events) {
    const upcoming=$('eventsUpcomingGrid'), past=$('eventsPastGrid');if(!upcoming)return;
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const eventDate=item=>String(item.eventDate||item.date||'').slice(0,10);
    const hasDate=item=>/^\d{4}-\d{2}-\d{2}$/.test(eventDate(item));
    const expired=item=>item.type==='past'||(hasDate(item)&&eventDate(item)<today);
    const groups=[[upcoming,events.filter(item=>!expired(item)).sort((a,b)=>eventDate(a).localeCompare(eventDate(b)))],[past,events.filter(expired).sort((a,b)=>eventDate(b).localeCompare(eventDate(a)))]];
    groups.forEach(([container,items])=>{
      container.replaceChildren();
      if(!items.length){const empty=document.createElement('div');empty.className='lp-empty';const heading=document.createElement('h3');heading.textContent=container===upcoming?'Something new is on the way.':'More moments to come.';const text=document.createElement('p');text.textContent=container===upcoming?'New dates will appear here when announced. Explore our gallery or contact the events team to plan your own activation.':'Our event highlights will appear here.';empty.append(heading,text);container.appendChild(empty);return}
      items.forEach((item,index)=>{
        const card=document.createElement('article');card.className='lp-event-card';
        const photo=document.createElement('img');photo.src=item.photoUrls?.[0]||item.photo||photoUrl(['community','naivas','rudra'][index%3]);photo.alt=item.photoUrls?.[0]||item.photo?(item.title||'Event photograph'):'A scene from Mombasa Mall';photo.loading='lazy';photo.decoding='async';
        const copy=document.createElement('div');copy.className='lp-event-copy';const date=document.createElement('time');
        date.textContent=hasDate(item)?new Date(eventDate(item)+'T12:00:00+03:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Nairobi'}):'Date to be announced';if(hasDate(item))date.dateTime=eventDate(item);
        const title=document.createElement('h3');title.textContent=item.title||'Mall event';const summary=document.createElement('p');summary.textContent=item.details||item.summary||'';
        const meta=document.createElement('small');meta.textContent=[expired(item)?'Past event':'Upcoming',item.eventTime||item.time,item.venue].filter(Boolean).join(' · ');
        copy.append(date,title,summary,meta);card.append(photo,copy);container.appendChild(card);
      });
    });document.dispatchEvent(new CustomEvent('lifestyle-content-updated'));
  }
  if($('eventsUpcomingGrid'))localEvents().then(renderEvents);
  // Local content renders first. Cloud failures never remove the curated assets.
  async function loadCloud() {
    if(!grid&&!$('eventsUpcomingGrid'))return;
    try {
      const request=(async()=>{
        const {db}=await import('./firebase-config.js');
        const {collection,getDocs}=await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js');
        return getDocs(collection(db,grid?'gallery':'events'));
      })();
      let timeout;const snap=await Promise.race([request,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Cloud content timeout')),5000)})]).finally(()=>clearTimeout(timeout));
      if(snap.empty)return;
      const items=snap.docs.map(doc=>doc.data());
      if(grid){const valid=items.filter(item=>item.imageUrl).map(item=>({...item,caption:item.caption||'Mombasa Mall',category:item.category||'spaces'}));galleryItems=[...photos,...valid.filter(item=>!photos.some(photo=>photo.imageUrl===item.imageUrl))];renderGallery()}
      else renderEvents(items);
    }catch(error){console.info('Using local page content:',error.message)}
  }
  loadCloud();

  if(!window.gsap||!window.ScrollTrigger)return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
    const reveals=new Map();
    const revealSelector='.lp-section-heading,.section-header,.lp-event-card,.lp-photo,.lp-about-intro,.category-values__row,.category-quote,.lp-carousel,.bento,.category-next-banner';
    function bindReveals(){
      reveals.forEach((tween,element)=>{if(!element.isConnected){tween.scrollTrigger?.kill();tween.kill();reveals.delete(element)}});
      scroller.querySelectorAll(revealSelector).forEach(element=>{
        if(reveals.has(element))return;
        const tween=gsap.from(element,{y:28,opacity:0,duration:.65,ease:'power3.out',clearProps:'opacity,transform',scrollTrigger:{scroller,trigger:element,start:'top 94%',once:true}});
        reveals.set(element,tween);
      });ScrollTrigger.refresh();
    }
    gsap.from('.lp-hero-copy > *',{y:28,opacity:0,duration:.8,stagger:.12,ease:'power3.out',clearProps:'opacity,transform'});
    gsap.fromTo('.lp-hero > img',{scale:1.03,yPercent:-2},{scale:1.12,yPercent:8,ease:'none',scrollTrigger:{scroller,trigger:'.lp-hero',start:'top top',end:'bottom top',scrub:1}});
    bindReveals();document.addEventListener('lifestyle-content-updated',bindReveals);
    const refresh=()=>ScrollTrigger.refresh();window.addEventListener('load',refresh,{once:true});
    scroller.querySelectorAll('img').forEach(img=>{if(!img.complete)img.addEventListener('load',refresh,{once:true})});
    if(document.fonts)document.fonts.ready.then(refresh);
    return()=>{document.removeEventListener('lifestyle-content-updated',bindReveals);window.removeEventListener('load',refresh);reveals.forEach(tween=>{tween.scrollTrigger?.kill();tween.revert()})};
  });
})();
