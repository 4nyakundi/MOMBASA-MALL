(function(){
 'use strict';
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const loader=document.getElementById('ledLoader');
 const start=performance.now();
 function tick(time){const progress=Math.min(100,Math.round((time-start)/9));document.getElementById('ledLoaderCount').textContent=progress+'%';document.querySelector('.led-loader-fill').style.transform=`scaleX(${progress/100})`;if(progress<100&&!loader.hidden)requestAnimationFrame(tick);else{loader.hidden=true;clearTimeout(window.ledLoaderSafety)}}
 if(!loader.hidden)requestAnimationFrame(tick);
 reduced.addEventListener('change',()=>{if(reduced.matches)loader.hidden=true});
 const networkViewport=document.querySelector('.led-horizontal-window');
 const networkTrack=document.querySelector('.led-horizontal-track');
 const columnCount=networkTrack.querySelector('.led-row').children.length;
 let networkTrigger=null;
 function networkStatus(progress){
  const value=Math.max(0,Math.min(1,progress));
  document.querySelector('.led-network-progress span').style.transform=`scaleX(${value})`;
  document.getElementById('ledNetworkPosition').textContent=String(Math.round(value*(columnCount-1))+1).padStart(2,'0')+' / '+String(columnCount).padStart(2,'0');
 }
 networkViewport.addEventListener('scroll',()=>{if(!networkTrigger)networkStatus(networkViewport.scrollLeft/Math.max(1,networkTrack.scrollWidth-networkViewport.clientWidth))},{passive:true});
 function moveNetwork(direction){
  if(networkTrigger){const step=(networkTrigger.end-networkTrigger.start)/(columnCount-1);window.scrollTo({top:Math.max(networkTrigger.start,Math.min(networkTrigger.end,window.scrollY+direction*step)),behavior:reduced.matches?'auto':'smooth'})}
  else networkViewport.scrollBy({left:direction*(networkTrack.querySelector('.led-tile').offsetWidth+12),behavior:reduced.matches?'auto':'smooth'});
 }
 document.querySelector('[data-network-prev]').addEventListener('click',()=>moveNetwork(-1));
 document.querySelector('[data-network-next]').addEventListener('click',()=>moveNetwork(1));
 document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  const target=document.querySelector(link.hash);if(!target)return;event.preventDefault();
  if(link.dataset.package){const select=document.getElementById('screenSelect');select.value=link.dataset.package;select.dispatchEvent(new Event('change'))}
  if(window.gsap&&window.ScrollTrigger){ScrollTrigger.getAll().filter(trigger=>trigger.pin).forEach(trigger=>trigger.update());ScrollTrigger.refresh()}
  target.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});
 }));
 if(!window.gsap||!window.ScrollTrigger)return;
 gsap.registerPlugin(ScrollTrigger);
 gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
  gsap.from('.led-hero-copy > *',{y:35,opacity:0,stagger:.12,duration:.8,delay:.85,ease:'power3.out',clearProps:'opacity,transform'});
  gsap.to('.led-road',{scaleX:.15,yPercent:45,ease:'none',scrollTrigger:{trigger:'.led-hero',start:'top top',end:'bottom top',scrub:1}});
  gsap.to('.led-sun',{yPercent:-30,ease:'none',scrollTrigger:{trigger:'.led-hero',start:'top top',end:'bottom top',scrub:1}});
  document.querySelectorAll('.led-manifesto h2 span').forEach(line=>gsap.from(line,{yPercent:40,opacity:0,duration:.8,ease:'power3.out',clearProps:'opacity,transform',scrollTrigger:{trigger:line,start:'top 90%',once:true}}));
  gsap.from('.led-booking-intro,.led-form-panel,.led-practical > *',{y:30,opacity:0,duration:.7,stagger:.1,clearProps:'opacity,transform',scrollTrigger:{trigger:'.led-booking',start:'top 85%',once:true}});
 });
 gsap.matchMedia().add('(min-width: 801px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)',()=>{
  const viewport=document.querySelector('.led-horizontal-window');const track=document.querySelector('.led-horizontal-track');
  viewport.style.overflowX='hidden';
  viewport.scrollLeft=0;
  const travel=()=>Math.max(0,track.scrollWidth-viewport.clientWidth);
  const horizontal=gsap.to(track,{x:()=>-travel(),ease:'none',scrollTrigger:{id:'ledNetworkScroll',trigger:'.led-horizontal',start:'top top',end:()=>'+='+travel(),scrub:.7,pin:true,invalidateOnRefresh:true,onUpdate:self=>networkStatus(self.progress)}});
  networkTrigger=horizontal.scrollTrigger;
  track.querySelectorAll('.led-tile-photo img').forEach(img=>gsap.fromTo(img,{scale:1.12},{scale:1,ease:'none',scrollTrigger:{trigger:img.parentElement,containerAnimation:horizontal,start:'left right',end:'right left',scrub:true}}));
  // Keyboard navigation leaves the pinned scene through the document's scroll position.
  const keys=event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();window.scrollBy({top:event.key==='ArrowRight'?350:-350,behavior:'smooth'})}};
  viewport.addEventListener('keydown',keys);
  gsap.to('.led-zoom-circle',{scale:14,ease:'none',scrollTrigger:{trigger:'.led-zoom',start:'top top',end:'+=900',scrub:.7,pin:true,invalidateOnRefresh:true}});
  return()=>{networkTrigger=null;viewport.style.overflowX='';viewport.removeEventListener('keydown',keys);networkStatus(viewport.scrollLeft/Math.max(1,track.scrollWidth-viewport.clientWidth))};
 });
 window.addEventListener('load',()=>ScrollTrigger.refresh(),{once:true});
 if(document.fonts)document.fonts.ready.then(()=>ScrollTrigger.refresh());
})();
