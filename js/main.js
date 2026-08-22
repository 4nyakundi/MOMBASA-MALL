/**
 * main.js — Mombasa Mall
 * Global micro-interactions, custom cursor, 3D tilt, and active navigation.
 * Uses the refined coastal palette (#e7ecef, #274c77, #6096ba, #a3cef1).
 */

(function () {
  'use strict';

  // Safely register GSAP plugins if available
  if (typeof gsap !== 'undefined') {
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }
  }

  /* ============================================================
     CUSTOM CURSOR (Coastal Blue Palette)
     ============================================================ */
  const cursor = document.querySelector('.cursor');
  if (cursor) {
    let follower = document.querySelector('.cursor-follower');
    if (!follower) {
      follower = document.createElement('div');
      follower.className = 'cursor-follower';
      document.body.appendChild(follower);
    }

    let mx = 0, my = 0, cx = 0, cy = 0, fx = 0, fy = 0;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
    });

    (function animateCursor() {
      cx += (mx - cx) * 0.28;
      cy += (my - cy) * 0.28;
      cursor.style.left = cx + 'px';
      cursor.style.top = cy + 'px';

      fx += (mx - fx) * 0.1;
      fy += (my - fy) * 0.1;
      follower.style.left = fx + 'px';
      follower.style.top = fy + 'px';

      requestAnimationFrame(animateCursor);
    })();

    const hoverSelectors = 'a, button, .bento, .floor-pill, .category-pill, .selection-card, input, select, textarea, [role="button"]';

    function updateHoverListeners() {
      if (typeof gsap === 'undefined') return;
      document.querySelectorAll(hoverSelectors).forEach((el) => {
        if (el.dataset.cursorBound) return;
        el.dataset.cursorBound = 'true';

        el.addEventListener('mouseenter', () => {
          gsap.to(cursor, { width: 5, height: 5, backgroundColor: '#d62828', duration: 0.2 });
          gsap.to(follower, {
            width: 44,
            height: 44,
            borderColor: '#f77f00',
            backgroundColor: 'rgba(252, 191, 73, 0.18)',
            duration: 0.25
          });
        });

        el.addEventListener('mouseleave', () => {
          gsap.to(cursor, { width: 8, height: 8, backgroundColor: '#f77f00', duration: 0.2 });
          gsap.to(follower, {
            width: 28,
            height: 28,
            borderColor: 'rgba(247, 127, 0, 0.45)',
            backgroundColor: 'transparent',
            duration: 0.25
          });
        });
      });
    }

    updateHoverListeners();
    setInterval(updateHoverListeners, 2000);
  }

  /* ============================================================
     ACTIVE NAVIGATION HIGHLIGHT
     ============================================================ */
  function highlightActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.site-nav__link, .offcanvas-nav a');

    navLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const linkPath = href.split('/').pop().split('#')[0];

      if (linkPath === path || (path === '' && linkPath === 'index.html')) {
        link.classList.add('is-active');
      } else {
        link.classList.remove('is-active');
      }
    });
  }

  /* ============================================================
     3D PERSPECTIVE TILT ON CARDS
     ============================================================ */
  function init3DTilt() {
    if (typeof gsap === 'undefined') return;
    const cards = document.querySelectorAll('.bento');

    cards.forEach((card) => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = 'true';

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;

        gsap.to(card, {
          rotationY: x * 6,
          rotationX: -y * 6,
          duration: 0.3,
          ease: 'power2.out',
          transformPerspective: 1000
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotationY: 0,
          rotationX: 0,
          duration: 0.6,
          ease: 'power3.out'
        });
      });
    });
  }

  /* ============================================================
     GENERIC LIGHTBOX (for Gallery & Media)
     ============================================================ */
  window.openLightbox = function (src) {
    let modal = document.getElementById('lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'lightbox-modal';
      modal.className = 'lightbox-modal';
      modal.innerHTML = `
        <div class="lightbox-img-wrap">
          <button class="lightbox-close-btn" onclick="closeLightbox()">&times;</button>
          <img id="lightbox-img" src="" alt="Preview">
        </div>
      `;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLightbox();
      });
      document.body.appendChild(modal);
    }

    const img = modal.querySelector('#lightbox-img');
    if (img) img.src = src;
    modal.classList.add('is-open');
  };

  window.closeLightbox = function () {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.classList.remove('is-open');
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeLightbox();
    }
  });

  /* ============================================================
     SUBPAGE CINEMATIC HERO SPLIT-PAN & PARALLAX ENGINE
     ============================================================ */
  function initCinematicSubpageHero() {
    const hero = document.querySelector('.subpage-cinematic-hero');
    if (!hero) return;

    const bgImg = hero.querySelector('.subpage-hero-bg-img');
    const splitLeft = hero.querySelector('.split-left');
    const splitRight = hero.querySelector('.split-right');
    const bottomFlow = hero.querySelector('.subpage-hero-bottom-flow');
    const scrollContainer = document.querySelector('.subpage-content') || window;

    // Initial entrance animation on load
    if (typeof gsap !== 'undefined') {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      if (bgImg) {
        tl.fromTo(bgImg, { scale: 1.25, opacity: 0 }, { scale: 1.12, opacity: 1, duration: 1.2 }, 0);
      }
      if (splitLeft) {
        tl.fromTo(splitLeft, { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, 0.2);
      }
      if (splitRight) {
        tl.fromTo(splitRight, { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, 0.2);
      }
      if (bottomFlow) {
        tl.fromTo(bottomFlow, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.4);
      }
    }

    // Scroll listener for dynamic continuous parallax & sideways parting
    function onSubpageScroll() {
      const scrollTop = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
      const progress = Math.min(scrollTop / 350, 1);

      if (bgImg) {
        // Image scales inward smoothly
        const scaleVal = 1.12 - (progress * 0.08); // 1.12 -> 1.04
        const yVal = progress * 35;
        bgImg.style.transform = `scale(${scaleVal}) translateY(${yVal}px)`;
      }

      if (splitLeft) {
        // Left word pans outward to the left
        const xLeft = -(progress * 120);
        splitLeft.style.transform = `translateX(${xLeft}px)`;
        splitLeft.style.opacity = Math.max(0.3, 1 - progress * 0.65);
      }

      if (splitRight) {
        // Right word pans outward to the right
        const xRight = (progress * 120);
        splitRight.style.transform = `translateX(${xRight}px)`;
        splitRight.style.opacity = Math.max(0.3, 1 - progress * 0.65);
      }

      if (bottomFlow) {
        // Bottom text flows smoothly
        const yFlow = -(progress * 12);
        bottomFlow.style.transform = `translateY(${yFlow}px)`;
      }
    }

    if (scrollContainer === window) {
      window.addEventListener('scroll', onSubpageScroll, { passive: true });
    } else {
      scrollContainer.addEventListener('scroll', onSubpageScroll, { passive: true });
      window.addEventListener('scroll', onSubpageScroll, { passive: true });
    }
  }

  /* ============================================================
     INIT ON DOM READY
     ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    highlightActiveNav();
    init3DTilt();
    initCinematicSubpageHero();
  });

  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  });

})();

