/**
 * selectionMenu.js — Mombasa Mall
 * Controls the "Our Floors" category overlay (like Realevate's "Our Selection")
 * and the off-canvas hamburger menu.
 */
(function () {
  'use strict';

  /* ---- Shared helpers ---- */
  function $(id) { return document.getElementById(id); }
  function $$ (sel) { return document.querySelectorAll(sel); }

  /* ============================================
     OUR FLOORS OVERLAY
     ============================================ */
  var openBtn   = $('open-selection');
  var menu      = $('selection-menu');
  var closeBtn  = $('selection-close');
  var shell     = $('selection-shell');
  if (menu) menu.inert = true;

  function openSelection() {
    if (!menu) return;
    closeOffcanvas();
    menu.inert = false;
    menu.querySelectorAll('.selection-card__cover img').forEach(function (img) {
      if (img.decode) img.decode().catch(function () {});
    });
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    // Enable pointer events on shell
    if (shell) shell.style.pointerEvents = 'all';
    if (closeBtn) closeBtn.focus({preventScroll:true});
  }

  function closeSelection() {
    if (!menu) return;
    var wasOpen = menu.classList.contains('is-open');
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    if (shell) shell.style.pointerEvents = 'none';
    menu.inert = true;
    if (wasOpen && openBtn) openBtn.focus({preventScroll:true});
  }

  if (openBtn) {
    openBtn.addEventListener('click', function () {
      var isOpen = menu && menu.classList.contains('is-open');
      isOpen ? closeSelection() : openSelection();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSelection);
  }
  $$('.selection-card').forEach(function (card) {
    card.addEventListener('click', closeSelection);
  });

  // Close on clicking the menu background (not the cards)
  if (menu) {
    menu.addEventListener('click', function (e) {
      // If click hit the root nav element (not a child card/button), close
      if (e.target === menu) closeSelection();
    });
  }

  // Load cover images for selection cards
  var coverImgs = $$('[data-selection-cover]');
  coverImgs.forEach(function (img) {
    var src = img.getAttribute('data-selection-cover');
    if (src) img.src = src;
  });

  /* ============================================
     GSAP ENTRANCE (if GSAP is available)
     ============================================ */
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof gsap === 'undefined') return;

    var cards = $$('.selection-card');
    if (!cards.length) return;

    // Cards entrance animation when overlay opens
    function animateCardsIn() {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      gsap.fromTo(cards,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 0.55, ease: 'power3.out' }
      );
    }

    // Observe menu open state via MutationObserver
    if (menu) {
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mut) {
          if (mut.attributeName === 'class') {
            if (menu.classList.contains('is-open')) animateCardsIn();
          }
        });
      });
      observer.observe(menu, { attributes: true });
    }

    /* ---- Hero text entrance (after preloader) ---- */
    var heroH1 = document.querySelector('.hero-h1');
    var heroSub = document.querySelector('.hero-sub');
    var navLinks = $$('.site-nav__link');
    var logoEl = document.querySelector('.site-logo');
    var navActions = document.querySelector('.site-nav__actions');
    var floatingHeader = document.querySelector('.floating-header');
    var marquee = document.querySelector('.marquee-reveal');
    var footer = document.querySelector('.site-footer');

    var heroRevealed = false;
    document.body.addEventListener('is-ready', revealHero, {once:true});

    // If body already has is-ready class (page reload), trigger immediately
    if (document.body.classList.contains('is-ready') || !document.getElementById('site-preloader')) {
      revealHero();
    }

    function revealHero() {
      if (heroRevealed || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      heroRevealed = true;
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      if (floatingHeader) {
        tl.fromTo(floatingHeader, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.8 }, 0);
      } else if (logoEl) {
        tl.fromTo(logoEl, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.6 }, 0);
      }

      if (navLinks.length) {
        tl.fromTo(navLinks,
          { opacity: 0, x: -12 },
          { opacity: 1, x: 0, stagger: 0.08, duration: 0.5 },
          0.15
        );
      }

      if (navActions) {
        tl.fromTo(navActions, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.4);
      }

      if (marquee) {
        tl.fromTo(marquee, { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.2);
      }

      if (heroH1) {
        // SplitText if available
        if (typeof SplitText !== 'undefined') {
          var split = new SplitText(heroH1, { type: 'lines' });
          tl.fromTo(split.lines,
            { y: '110%', opacity: 0 },
            { y: '0%', opacity: 1, stagger: 0.1, duration: 0.8, ease: 'power4.out' },
            0.35
          );
        } else {
          tl.fromTo(heroH1,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.35
          );
        }
      }

      if (heroSub) {
        tl.fromTo(heroSub, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.6);
      }

      if (footer) {
        tl.fromTo(footer, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.5);
      }
    }
  });

  /* ============================================
     OFF-CANVAS HAMBURGER MENU
     ============================================ */
  var hamburger     = $('hamburger');
  var offcanvas     = $('offcanvas-menu');
  var backdrop      = $('offcanvas-backdrop');
  var offcanvasClose = $('offcanvas-close');
  if (offcanvas) offcanvas.inert = true;

  function openOffcanvas() {
    closeSelection();
    if (offcanvas) {
      offcanvas.inert = false;
      offcanvas.classList.add('is-open');
      offcanvas.setAttribute('aria-hidden', 'false');
    }
    if (backdrop) backdrop.classList.add('is-open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (offcanvasClose) offcanvasClose.focus({preventScroll:true});
  }

  function closeOffcanvas() {
    var wasOpen = offcanvas && offcanvas.classList.contains('is-open');
    if (offcanvas) {
      offcanvas.classList.remove('is-open');
      offcanvas.setAttribute('aria-hidden', 'true');
      offcanvas.inert = true;
    }
    if (backdrop) backdrop.classList.remove('is-open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (wasOpen && hamburger) hamburger.focus({preventScroll:true});
  }

  if (hamburger) hamburger.addEventListener('click', openOffcanvas);
  if (offcanvasClose) offcanvasClose.addEventListener('click', closeOffcanvas);
  if (backdrop) backdrop.addEventListener('click', closeOffcanvas);
  if (offcanvas) offcanvas.querySelectorAll('a').forEach(function(link) { link.addEventListener('click',closeOffcanvas); });

  /* ---- Keyboard: Escape closes both overlays ---- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      var activeMenu = menu && menu.classList.contains('is-open') ? menu : offcanvas && offcanvas.classList.contains('is-open') ? offcanvas : null;
      if (activeMenu) {
        var focusables = activeMenu.querySelectorAll('a[href],button:not([disabled])');
        var first=focusables[0],last=focusables[focusables.length-1];
        if (e.shiftKey && document.activeElement===first) { e.preventDefault();last.focus(); }
        else if (!e.shiftKey && document.activeElement===last) { e.preventDefault();first.focus(); }
      }
    }
    if (e.key === 'Escape') {
      closeSelection();
      closeOffcanvas();
    }
  });

})();
