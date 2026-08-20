document.addEventListener('DOMContentLoaded', async () => {
  // 1. Safe Plugin Registration
  if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, Flip, ScrambleTextPlugin);

    // 2. Smooth Scrolling
    if (typeof ScrollSmoother !== 'undefined') {
      ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.5,
        effects: true
      });
    }

    // 3. Hero SplitText Stagger
    if (typeof SplitText !== 'undefined') {
      const heroSplit = new SplitText('.hero-title', { type: 'words,chars' });
      gsap.from(heroSplit.chars, {
        y: 70,
        opacity: 0,
        rotateX: -45,
        stagger: 0.018,
        duration: 1.1,
        ease: 'power4.out'
      });
    }

    // 4. Hero Video Parallax Scrubbing
    gsap.to('.video-frame', {
      scrollTrigger: {
        trigger: '.video-frame',
        start: 'top 75%',
        end: 'bottom top',
        scrub: 1
      },
      scale: 0.97,
      borderRadius: '44px'
    });

    // 5. ScrambleText Metric Ticker
    if (typeof ScrambleTextPlugin !== 'undefined') {
      gsap.to('#statTicker', {
        duration: 2,
        scrambleText: {
          text: '● 150,000+ DAILY FOOTFALL',
          chars: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          speed: 0.4
        },
        scrollTrigger: {
          trigger: '.video-frame',
          start: 'top 80%'
        }
      });
    }
  }

  // 6. Specular Cursor Glow on Bento Cards
  const attachSpecularGlow = () => {
    document.querySelectorAll('.bento-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      });
    });
  };
  attachSpecularGlow();

  // 7. Load Stores Dynamically from stores.json
  try {
    const res = await fetch('./json/stores.json');
    if (res.ok) {
      const data = await res.json();
      const container = document.getElementById('storesContainer');
      if (data && data.floors && container) {
        let html = '';
        data.floors.forEach(floor => {
          (floor.shops || []).slice(0, 2).forEach(shop => {
            html += `
              <div class="bento-card store-card" data-floor="${floor.name}">
                <span class="font-mono text-xs text-[#e5c07b] uppercase">${floor.name} • ${shop.room || 'Store'}</span>
                <h3 class="font-display text-2xl font-bold mt-2 mb-3">${shop.name}</h3>
                <p class="text-slate-400 text-sm mb-6">${shop.description || 'Premium retail tenant.'}</p>
                <a href="./stores.html" class="text-xs font-mono uppercase text-[#ff6b4a] font-semibold flex items-center gap-1.5">Explore Floor →</a>
              </div>
            `;
          });
        });
        container.innerHTML = html;
        attachSpecularGlow();
      }
    }
  } catch (err) {
    console.warn('Using fallback pre-rendered stores:', err);
  }
});

// 8. Global Floor Filtering Function with Flip Animation
window.filterFloor = function (floor, btn) {
  document.querySelectorAll('.floor-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const cards = document.querySelectorAll('.store-card');
  const state = Flip.getState(cards);

  cards.forEach(card => {
    if (floor === 'all' || card.dataset.floor === floor) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });

  Flip.from(state, {
    duration: 0.6,
    ease: 'power3.inOut',
    stagger: 0.03,
    absolute: true,
    onEnter: elements => gsap.fromTo(elements, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.35 }),
    onLeave: elements => gsap.to(elements, { opacity: 0, scale: 0.85, duration: 0.25 })
  });
};
