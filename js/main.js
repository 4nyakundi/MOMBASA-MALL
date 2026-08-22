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
          gsap.to(cursor, { width: 5, height: 5, backgroundColor: '#274c77', duration: 0.2 });
          gsap.to(follower, {
            width: 44,
            height: 44,
            borderColor: '#6096ba',
            backgroundColor: 'rgba(163, 206, 241, 0.15)',
            duration: 0.25
          });
        });

        el.addEventListener('mouseleave', () => {
          gsap.to(cursor, { width: 8, height: 8, backgroundColor: '#6096ba', duration: 0.2 });
          gsap.to(follower, {
            width: 28,
            height: 28,
            borderColor: 'rgba(96, 150, 186, 0.4)',
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
     INIT ON DOM READY
     ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    highlightActiveNav();
    init3DTilt();
  });

  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  });

})();
