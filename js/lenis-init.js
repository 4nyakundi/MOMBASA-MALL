// Lenis smooth-scrolling integration and ScrollTrigger update hook
// Requires Lenis and GSAP+ScrollTrigger to already be loaded on the page.
(function () {
  if (typeof Lenis === 'undefined') return;
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    direction: 'vertical'
  });

  window.lenis = lenis;

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // If GSAP ScrollTrigger exists, update it on Lenis scroll
  if (window.ScrollTrigger) {
    lenis.on('scroll', () => ScrollTrigger.update());
  }

  // Create progress bar dynamically
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.scroll-progress-bar')) {
      const bar = document.createElement('div');
      bar.className = 'scroll-progress-bar';
      document.body.appendChild(bar);

      if (window.gsap && window.ScrollTrigger) {
        gsap.to(bar, {
          width: '100%',
          ease: 'none',
          scrollTrigger: {
            trigger: 'body',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.3
          }
        });
      }
    }
  });
})();
