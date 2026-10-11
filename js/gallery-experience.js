(function(){
 'use strict';
 if(!document.body.classList.contains('gallery-page'))return;
 const scroller=document.querySelector('.subpage-content');
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 const chapters=[...document.querySelectorAll('.gallery-chapters a')];
 let scheduled=false;
 function update(){
  scheduled=false;
  const max=scroller.scrollHeight-scroller.clientHeight;
  document.querySelector('.gallery-progress span').style.transform=`scaleX(${max?scroller.scrollTop/max:0})`;
  let current=chapters[0];
  chapters.forEach(link=>{const section=document.querySelector(link.hash);if(section.getBoundingClientRect().top-scroller.getBoundingClientRect().top<160)current=link});
  chapters.forEach(link=>{if(link===current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});
 }
 scroller.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}},{passive:true});
 window.addEventListener('resize',update);document.addEventListener('lifestyle-content-updated',update);update();
 chapters.forEach(link=>link.addEventListener('click',event=>{event.preventDefault();document.querySelector(link.hash).scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'})}));
 const stage=document.querySelector('.gallery-viewer-stage');
 const zoom=document.getElementById('lightboxZoom');
 const thumbs=document.getElementById('galleryThumbnails');
 function resetZoom(){stage.classList.remove('is-zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='Zoom in +';stage.scrollTop=stage.scrollLeft=0}
 zoom.addEventListener('click',()=>{const active=stage.classList.toggle('is-zoomed');zoom.setAttribute('aria-pressed',String(active));zoom.textContent=active?'Zoom out −':'Zoom in +'});
 document.addEventListener('gallery-photo-changed',event=>{
  resetZoom();const restoreThumbnailFocus=thumbs.contains(document.activeElement);const {items,index}=event.detail;thumbs.replaceChildren();
  items.forEach((item,i)=>{
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','View '+item.caption);button.setAttribute('aria-current',String(i===index));
   const img=document.createElement('img');img.src=item.imageUrl;img.alt='';img.loading='lazy';button.append(img);
   button.addEventListener('click',()=>{document.dispatchEvent(new CustomEvent('gallery-select-photo',{detail:{index:i}}));thumbs.children[i]?.focus({preventScroll:true})});thumbs.append(button);
  });
  thumbs.children[index]?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  if(restoreThumbnailFocus)thumbs.children[index]?.focus({preventScroll:true});
 });
 let touchX=null;
 stage.addEventListener('touchstart',event=>{touchX=event.touches.length===1?event.touches[0].clientX:null},{passive:true});
 stage.addEventListener('touchend',event=>{if(touchX===null||stage.classList.contains('is-zoomed'))return;const delta=event.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(delta)>60)document.getElementById(delta<0?'lightboxNext':'lightboxPrev').click()},{passive:true});
 const video=document.getElementById('galleryVideo');
 new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&!video.paused)video.pause()},{root:scroller,threshold:.05}).observe(video);
 if(!window.gsap||!window.ScrollTrigger)return;
 gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
  gsap.from('.gallery-hero-top,.gallery-hero-bottom',{opacity:0,duration:1,delay:.4,clearProps:'opacity'});
  gsap.from('.gallery-intro h2,.gallery-intro p',{y:40,opacity:0,stagger:.12,duration:1,ease:'power3.out',clearProps:'opacity,transform',scrollTrigger:{scroller,trigger:'.gallery-intro',start:'top 85%',once:true}});
  gsap.fromTo('.gallery-postcard-image img',{scale:1.18,yPercent:-5},{scale:1.12,yPercent:5,ease:'none',scrollTrigger:{scroller,trigger:'.gallery-postcard',start:'top bottom',end:'bottom top',scrub:1}});
  gsap.from('.gallery-postcard-copy > *',{y:30,opacity:0,stagger:.12,duration:.8,clearProps:'opacity,transform',scrollTrigger:{scroller,trigger:'.gallery-postcard-copy',start:'top 85%',once:true}});
  gsap.from('.gallery-visit > *',{y:32,opacity:0,stagger:.12,duration:.8,clearProps:'opacity,transform',scrollTrigger:{scroller,trigger:'.gallery-visit',start:'top 88%',once:true}});
 });
})();
