/* GSAP enhances the directory; every control and store remains usable without it. */
(function () {
  'use strict';
  const scroller = document.querySelector('.subpage-content');
  const map = document.getElementById('floorMapSection');
  document.querySelectorAll('a[href="#directorySection"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); document.getElementById('directorySection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }));
  document.querySelectorAll('a[href="#floorMapSection"]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); map.open=true; map.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }));
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const motion = gsap.matchMedia();
  motion.add('(prefers-reduced-motion: no-preference)', () => {
    const intro = gsap.timeline({defaults:{ease:'power3.out',duration:.8}});
    intro.from('.discovery-copy > *',{y:22,opacity:0,stagger:.09,clearProps:'opacity,transform'})
      .from('.discovery-main-photo',{clipPath:'inset(8% 0 8% 0 round 120px 16px 16px 16px)',scale:1.035,opacity:0,clearProps:'opacity,transform,clipPath'},.12)
      .from('.discovery-orbit',{rotation:-5,opacity:0,clearProps:'opacity,transform'},.2)
      .from('.discovery-float',{y:16,opacity:0,rotation:0,clearProps:'opacity,transform'},.55);
    gsap.to('.discovery-main-photo',{yPercent:7,ease:'none',scrollTrigger:{scroller,trigger:'.discovery-hero',start:'top top',end:'bottom top',scrub:1}});
    gsap.from('.quick-picks > *',{y:14,opacity:0,stagger:.08,duration:.55,clearProps:'opacity,transform',scrollTrigger:{scroller,trigger:'.quick-picks',start:'top 95%',once:true}});
    const progress=document.createElement('div'); progress.className='store-scroll-progress'; progress.setAttribute('aria-hidden','true'); document.body.appendChild(progress);
    gsap.to(progress,{scaleX:1,ease:'none',scrollTrigger:{scroller,trigger:scroller,start:0,end:()=>Math.max(1,scroller.scrollHeight-scroller.clientHeight),scrub:.2,invalidateOnRefresh:true}});
    let cardsContext;
    window.cleanupStoreCardMotion=()=>{ if(cardsContext) {cardsContext.revert();cardsContext=null;} };
    window.animateStoreCards=()=>{
      window.cleanupStoreCardMotion();
      cardsContext=gsap.context(()=>{
        ScrollTrigger.batch('#storesGridContainer .store-card',{scroller,start:'top 97%',once:true,interval:.08,batchMax:4,onEnter:batch=>gsap.fromTo(batch,{y:20,opacity:0},{y:0,opacity:1,stagger:.055,duration:.48,ease:'power2.out',clearProps:'opacity,transform'})});
      },scroller);
      ScrollTrigger.refresh();
    };
    window.animateStoreMap=()=>{ if(map.open) gsap.fromTo('#svgUnitsGroup .svg-store-zone',{opacity:0,y:6},{opacity:1,y:0,stagger:{amount:.2},duration:.35,clearProps:'opacity,transform'}); };
    const refresh=()=>ScrollTrigger.refresh();
    map.addEventListener('toggle',refresh);
    window.addEventListener('load',refresh,{once:true});
    document.fonts?.ready.then(refresh);
    window.animateStoreCards();
    return ()=>{ window.cleanupStoreCardMotion();map.removeEventListener('toggle',refresh);window.removeEventListener('load',refresh);progress.remove();delete window.animateStoreCards;delete window.cleanupStoreCardMotion;delete window.animateStoreMap; };
  });
})();
