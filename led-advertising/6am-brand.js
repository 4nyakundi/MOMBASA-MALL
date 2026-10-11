(function(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');const logo=document.querySelector('[data-animated]');
 if(logo){const still=logo.getAttribute('src');const setLogo=()=>logo.src=reduced.matches?still:logo.dataset.animated;setLogo();reduced.addEventListener('change',setLogo)}
 if(!window.gsap||!window.ScrollTrigger)return;
 gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
  document.querySelectorAll('.led-company-heading,.led-company-story,.led-audience-stats,.led-audience-detail,.led-dayparts h2,.led-dayparts article,.led-clients h2').forEach(element=>gsap.from(element,{y:32,opacity:0,duration:.8,ease:'power3.out',clearProps:'opacity,transform',scrollTrigger:{trigger:element,start:'top 90%',once:true}}));
  gsap.from('.led-audience-bars i',{scaleX:0,duration:1,stagger:.1,scrollTrigger:{trigger:'.led-audience-bars',start:'top 85%',once:true}});
 });
})();
