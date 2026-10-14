/**
 * PLAY-ON KIDS PLAYGROUND - INTERACTIVE SCRIPTS & GSAP ANIMATIONS
 * Mombasa Mall, 2nd Floor, Mwembe Tayari, Mombasa, Kenya
 * Fully optimized, smooth, zero-jitter, mobile-ready & high-performance
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let countersAnimated = false;

  /* ------------------------------------------------------------------------
     1. Lightweight Smooth Scrolling Setup (Lenis)
     ------------------------------------------------------------------------ */
  let lenis = null;
  if (!prefersReducedMotion && typeof Lenis !== 'undefined') {
    try {
      lenis = new Lenis({
        duration: 0.7,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -8 * t)),
        smoothWheel: true,
        touchMultiplier: 1.1,
        infinite: false,
      });

      // Synchronize Lenis with GSAP ScrollTrigger ticker if present
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => {
          lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
      } else {
        function raf(time) {
          lenis.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
      }
    } catch (e) {
      console.warn('Lenis smooth scroll initialization skipped:', e);
    }
  }

  /* ------------------------------------------------------------------------
     2. Scroll Progress Track & Sticky Header Class
     ------------------------------------------------------------------------ */
  const progressBar = document.querySelector('.scroll-progress-bar');
  const backToTopBtn = document.getElementById('backToTop');
  const header = document.querySelector('header');

  let scrollProgressRAF = null;
  window.addEventListener('scroll', () => {
    if (!scrollProgressRAF) {
      scrollProgressRAF = requestAnimationFrame(() => {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0 && progressBar) {
          const progress = Math.min(100, Math.max(0, (window.scrollY / scrollHeight) * 100));
          progressBar.style.width = `${progress}%`;
        }

        // Sticky Header Class (zero layout shift)
        if (header) {
          if (window.scrollY > 30) {
            header.classList.add('scrolled');
          } else {
            header.classList.remove('scrolled');
          }
        }

        // Back to top button visibility
        if (backToTopBtn) {
          if (window.scrollY > 350) {
            backToTopBtn.classList.add('is-visible');
          } else {
            backToTopBtn.classList.remove('is-visible');
          }
        }

        scrollProgressRAF = null;
      });
    }
  }, { passive: true });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget('#top');
    });
  }

  /* ------------------------------------------------------------------------
     3. Ultra-Smooth Top Navigation Links & Active ScrollSpy
     ------------------------------------------------------------------------ */
  const desktopNavLinks = document.querySelectorAll('nav.desktop-nav a[href^="#"]');
  const spySections = document.querySelectorAll('section[id], footer[id]');
  let isProgrammaticScrolling = false;
  let programmaticTimer = null;

  function scrollToTarget(targetId) {
    if (!targetId || targetId === '#') return;

    isProgrammaticScrolling = true;
    clearTimeout(programmaticTimer);

    // Instant active button highlighting
    desktopNavLinks.forEach((link) => {
      if (link.getAttribute('href') === targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    if (targetId === '#top') {
      if (lenis) {
        lenis.scrollTo(0, {
          duration: 0.7,
          onComplete: () => {
            isProgrammaticScrolling = false;
          }
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      programmaticTimer = setTimeout(() => {
        isProgrammaticScrolling = false;
      }, 750);
      return;
    }

    const targetEl = document.querySelector(targetId);
    if (targetEl) {
      const headerOffset = 88;
      const elementPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = Math.max(0, elementPosition - headerOffset);

      if (lenis) {
        lenis.scrollTo(offsetPosition, {
          duration: 0.75,
          onComplete: () => {
            isProgrammaticScrolling = false;
          }
        });
      } else {
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }

      programmaticTimer = setTimeout(() => {
        isProgrammaticScrolling = false;
      }, 800);
    } else {
      isProgrammaticScrolling = false;
    }
  }

  // Bind smooth click to all anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId !== '#') {
        e.preventDefault();
        scrollToTarget(targetId);
      }
    });
  });

  // RAF-Throttled Active Nav ScrollSpy
  let scrollSpyRAF = null;
  function updateScrollSpy() {
    if (isProgrammaticScrolling) return;

    const scrollPos = window.scrollY;
    let currentId = '';

    if (scrollPos < 180) {
      currentId = '#top';
    } else {
      spySections.forEach((section) => {
        const sectionTop = section.offsetTop - 120;
        const sectionHeight = section.offsetHeight;
        if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
          currentId = '#' + section.getAttribute('id');
        }
      });
    }

    if (currentId) {
      desktopNavLinks.forEach((link) => {
        if (link.getAttribute('href') === currentId) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }
  }

  window.addEventListener('scroll', () => {
    if (!scrollSpyRAF) {
      scrollSpyRAF = requestAnimationFrame(() => {
        updateScrollSpy();
        scrollSpyRAF = null;
      });
    }
  }, { passive: true });

  /* ------------------------------------------------------------------------
     4. Mobile Navigation Toggle Drawer & Controls
     ------------------------------------------------------------------------ */
  const menuBtn = document.getElementById('menuBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');
  const mobileDrawerCloseBtn = document.getElementById('mobileDrawerCloseBtn');

  function openDrawer() {
    if (menuBtn) menuBtn.classList.add('is-active');
    if (mobileNavDrawer) {
      mobileNavDrawer.classList.add('is-open');
      mobileNavDrawer.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (menuBtn) menuBtn.classList.remove('is-active');
    if (mobileNavDrawer) {
      mobileNavDrawer.classList.remove('is-open');
      mobileNavDrawer.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  if (menuBtn && mobileNavDrawer) {
    menuBtn.addEventListener('click', () => {
      if (mobileNavDrawer.classList.contains('is-open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    if (mobileDrawerCloseBtn) {
      mobileDrawerCloseBtn.addEventListener('click', closeDrawer);
    }

    mobileNavLinks.forEach((link) => {
      link.addEventListener('click', () => {
        closeDrawer();
        const targetHref = link.getAttribute('href');
        if (targetHref && targetHref.startsWith('#')) {
          scrollToTarget(targetHref);
        }
      });
    });

    mobileNavDrawer.addEventListener('click', (e) => {
      if (e.target === mobileNavDrawer) {
        closeDrawer();
      }
    });
  }

  /* ------------------------------------------------------------------------
     6. GSAP Entrance Animations & ScrollTrigger Reveals (Stable & Smooth)
     ------------------------------------------------------------------------ */
  if (typeof gsap !== 'undefined') {
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    // Hero Letter Split Entrance (clean entrance without endless letter vibration)
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
      const text = heroTitle.textContent.trim();
      heroTitle.innerHTML = '';
      text.split('').forEach((char) => {
        const span = document.createElement('span');
        span.className = 'char';
        span.innerHTML = char === ' ' ? '&nbsp;' : char;
        heroTitle.appendChild(span);
      });

      if (!prefersReducedMotion) {
        // Pop in letters with elastic bounce, then keep stable and crisp
        gsap.from('.hero-title .char', {
          y: 50,
          opacity: 0,
          scale: 0.4,
          stagger: 0.035,
          duration: 0.9,
          ease: 'back.out(1.8)',
          clearProps: 'all',
        });

        // Hero Tagline Word Split
        const heroTagline = document.querySelector('.hero-tagline');
        if (heroTagline) {
          const taglineText = heroTagline.textContent.trim();
          heroTagline.innerHTML = '';
          taglineText.split(' ').forEach((word) => {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = word;
            heroTagline.appendChild(span);
          });

          gsap.from('.hero-tagline .word', {
            y: 18,
            opacity: 0,
            scale: 0.95,
            stagger: 0.06,
            duration: 0.7,
            delay: 0.5,
            ease: 'power3.out',
            clearProps: 'all',
          });
        }

        // Hero CTAs & Stat Pills
        gsap.from('.hero-ctas .btn', {
          scale: 0.75,
          opacity: 0,
          y: 20,
          stagger: 0.1,
          duration: 0.75,
          delay: 0.8,
          ease: 'back.out(1.6)',
          clearProps: 'all',
        });

        gsap.from('.hero-stat-pill', {
          y: 30,
          opacity: 0,
          stagger: 0.08,
          duration: 0.7,
          delay: 1.0,
          ease: 'power3.out',
          clearProps: 'all',
        });
      }
    }

    // ScrollTrigger Reveals
    if (!prefersReducedMotion && typeof ScrollTrigger !== 'undefined') {
      // Section Headers
      document.querySelectorAll('.section-header').forEach((header) => {
        gsap.from(header.children, {
          scrollTrigger: {
            trigger: header,
            start: 'top 88%',
            once: true,
          },
          y: 28,
          opacity: 0,
          stagger: 0.1,
          duration: 0.65,
          ease: 'power3.out',
          clearProps: 'all',
        });
      });

      // Feature Cards Stagger
      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: '.features-grid',
          start: 'top 85%',
          once: true,
        },
        y: 35,
        opacity: 0,
        scale: 0.96,
        stagger: 0.08,
        duration: 0.65,
        ease: 'power3.out',
        clearProps: 'all',
      });

      // Activity Cards Stagger
      gsap.from('.activity-card', {
        scrollTrigger: {
          trigger: '.activities-grid',
          start: 'top 85%',
          once: true,
        },
        y: 40,
        opacity: 0,
        scale: 0.96,
        stagger: 0.07,
        duration: 0.6,
        ease: 'power3.out',
        clearProps: 'all',
      });

      // Pricing Cards Flip In & Trigger Counter
      gsap.from('.pricing-card', {
        scrollTrigger: {
          trigger: '.pricing-grid',
          start: 'top 85%',
          once: true,
          onEnter: animatePricingCounters,
        },
        y: 40,
        opacity: 0,
        stagger: 0.12,
        duration: 0.7,
        ease: 'power3.out',
        clearProps: 'all',
      });

      // Package Cards Stagger
      gsap.from('.package-card', {
        scrollTrigger: {
          trigger: '.packages-grid',
          start: 'top 85%',
          once: true,
        },
        y: 35,
        opacity: 0,
        stagger: 0.1,
        duration: 0.65,
        ease: 'power3.out',
        clearProps: 'all',
      });

      // Gallery Items Stagger
      gsap.from('.gallery-item', {
        scrollTrigger: {
          trigger: '.gallery-grid',
          start: 'top 88%',
          once: true,
        },
        y: 30,
        opacity: 0,
        scale: 0.94,
        stagger: 0.06,
        duration: 0.6,
        ease: 'power2.out',
        clearProps: 'all',
      });

      // Video Section Cards
      gsap.from('.video-card', {
        scrollTrigger: {
          trigger: '.video-grid',
          start: 'top 85%',
          once: true,
        },
        y: 35,
        opacity: 0,
        stagger: 0.12,
        duration: 0.7,
        ease: 'power3.out',
        clearProps: 'all',
      });
    } else {
      animatePricingCounters();
    }
  } else {
    animatePricingCounters();
  }

  // Refresh ScrollTrigger after fonts/assets load
  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  });

  /* ------------------------------------------------------------------------
     7. Pricing Numbers Count-Up Animation
     ------------------------------------------------------------------------ */
  function animatePricingCounters() {
    if (countersAnimated) return;
    countersAnimated = true;

    const counters = document.querySelectorAll('.count-up');
    counters.forEach((counter) => {
      const target = +counter.getAttribute('data-target');
      if (!target) return;

      let current = 0;
      const step = Math.ceil(target / 25);
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          counter.textContent = target.toLocaleString();
          clearInterval(timer);
        } else {
          counter.textContent = current.toLocaleString();
        }
      }, 25);
    });
  }

  /* ------------------------------------------------------------------------
     8. Live Mombasa Center Status (EAT Time Calculation UTC+3)
     ------------------------------------------------------------------------ */
  function updateLiveStatus() {
    const statusTextEl = document.getElementById('liveStatusText');
    const statusDescEl = document.getElementById('liveStatusDesc');
    const statusDot = document.getElementById('liveStatusDot');

    if (!statusTextEl || !statusDescEl) return;

    // Get current time in East Africa Time (UTC+3)
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const utcDay = now.getUTCDay();

    // EAT is UTC + 3 hours
    let eatHours = utcHours + 3;
    let eatDay = utcDay;
    if (eatHours >= 24) {
      eatHours -= 24;
      eatDay = (eatDay + 1) % 7;
    }

    const currentDecTime = eatHours + utcMinutes / 60;
    let isOpen = false;
    let currentSession = '';
    let nextMessage = '';

    if (eatDay === 1) {
      // Monday - Closed
      isOpen = false;
      statusTextEl.textContent = 'Closed Today (Mondays)';
      statusDescEl.textContent = 'We are closed Mondays for deep hygiene sanitization (except public/school holidays). Opens Tuesday at 2:00 PM!';
      if (statusDot) statusDot.style.backgroundColor = '#FF3366';
    } else if (eatDay >= 2 && eatDay <= 5) {
      // Tuesday to Friday (Weekdays)
      // Session 1: 14:00 - 16:30 | Session 2: 17:00 - 20:00
      if (currentDecTime >= 14.0 && currentDecTime < 16.5) {
        isOpen = true;
        currentSession = 'Session 1 in progress (2:00 PM – 4:30 PM)';
      } else if (currentDecTime >= 17.0 && currentDecTime < 20.0) {
        isOpen = true;
        currentSession = 'Session 2 in progress (5:00 PM – 8:00 PM)';
      } else if (currentDecTime < 14.0) {
        nextMessage = 'Opens today at 2:00 PM (Session 1: 2:00 PM – 4:30 PM)';
      } else if (currentDecTime >= 16.5 && currentDecTime < 17.0) {
        nextMessage = 'Between sessions. Next Session 2 starts at 5:00 PM!';
      } else {
        nextMessage = 'Closed for the night. Next session opens tomorrow at 2:00 PM!';
      }
    } else {
      // Saturday & Sunday (Weekends)
      // Session 1: 11:00 - 13:00 | Session 2: 14:00 - 16:00 | Session 3: 16:30 - 18:30 | Session 4: 19:00 - 21:00
      if (currentDecTime >= 11.0 && currentDecTime < 13.0) {
        isOpen = true;
        currentSession = 'Weekend Session 1 in progress (11:00 AM – 1:00 PM)';
      } else if (currentDecTime >= 14.0 && currentDecTime < 16.0) {
        isOpen = true;
        currentSession = 'Weekend Session 2 in progress (2:00 PM – 4:00 PM)';
      } else if (currentDecTime >= 16.5 && currentDecTime < 18.5) {
        isOpen = true;
        currentSession = 'Weekend Session 3 in progress (4:30 PM – 6:30 PM)';
      } else if (currentDecTime >= 19.0 && currentDecTime < 21.0) {
        isOpen = true;
        currentSession = 'Weekend Night Session 4 in progress (7:00 PM – 9:00 PM)';
      } else if (currentDecTime < 11.0) {
        nextMessage = 'Opens today at 11:00 AM (Session 1: 11:00 AM – 1:00 PM)';
      } else if (currentDecTime >= 13.0 && currentDecTime < 14.0) {
        nextMessage = 'Session 2 starts at 2:00 PM!';
      } else if (currentDecTime >= 16.0 && currentDecTime < 16.5) {
        nextMessage = 'Session 3 starts at 4:30 PM!';
      } else if (currentDecTime >= 18.5 && currentDecTime < 19.0) {
        nextMessage = 'Night Session 4 starts at 7:00 PM!';
      } else {
        nextMessage = eatDay === 0 ? 'Closed for the night. Reopens Tuesday at 2:00 PM!' : 'Closed for the night. Reopens Sunday at 11:00 AM!';
      }
    }

    if (eatDay !== 1) {
      if (isOpen) {
        statusTextEl.textContent = '🎉 Open Now in Mombasa Mall!';
        statusDescEl.textContent = `${currentSession} — Walk-ins & bookings welcome!`;
        if (statusDot) statusDot.style.backgroundColor = '#2DD375';
      } else {
        statusTextEl.textContent = '🕒 Closed Right Now';
        statusDescEl.textContent = nextMessage;
        if (statusDot) statusDot.style.backgroundColor = '#FFD400';
      }
    }
  }
  updateLiveStatus();
  setInterval(updateLiveStatus, 30000);

  /* ------------------------------------------------------------------------
     9. Activities Filter Tabs
     ------------------------------------------------------------------------ */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const activityCards = document.querySelectorAll('.activity-card');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      activityCards.forEach((card) => {
        const category = card.getAttribute('data-category') || '';
        if (filterValue === 'all' || category.includes(filterValue)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });

      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    });
  });

  /* ------------------------------------------------------------------------
     10. Interactive Booking Engine & Dynamic Live Calculator
     ------------------------------------------------------------------------ */
  const bookingDateInput = document.getElementById('bookingDate');
  const bookingSessionSelect = document.getElementById('bookingSession');
  const bookingTypeSelect = document.getElementById('bookingType');
  const childCountVal = document.getElementById('childCount');
  const adultCountVal = document.getElementById('adultCount');
  const estTotalEl = document.getElementById('estimatedTotal');

  // Set min date to today
  if (bookingDateInput) {
    const today = new Date().toISOString().split('T')[0];
    bookingDateInput.min = today;
    bookingDateInput.value = today;
  }

  // Session options definition
  const weekdaySessions = [
    { val: 'Session 1 (2:00pm - 4:30pm)', label: 'Session 1: 2:00 PM – 4:30 PM (Afternoon)' },
    { val: 'Session 2 (5:00pm - 8:00pm)', label: 'Session 2: 5:00 PM – 8:00 PM (Evening Glow)' },
  ];

  const weekendSessions = [
    { val: 'Session 1 (11:00am - 1:00pm)', label: 'Session 1: 11:00 AM – 1:00 PM (Morning Kickoff)' },
    { val: 'Session 2 (2:00pm - 4:00pm)', label: 'Session 2: 2:00 PM – 4:00 PM (Peak Fun)' },
    { val: 'Session 3 (4:30pm - 6:30pm)', label: 'Session 3: 4:30 PM – 6:30 PM (Twilight Jump)' },
    { val: 'Session 4 (7:00pm - 9:00pm)', label: 'Session 4: 7:00 PM – 9:00 PM (Night Lights)' },
  ];

  function populateSessionOptions() {
    if (!bookingDateInput || !bookingSessionSelect) return;
    const selectedDate = new Date(bookingDateInput.value + 'T00:00:00');
    const day = selectedDate.getDay(); // 0 = Sun, 6 = Sat, 1 = Mon

    bookingSessionSelect.innerHTML = '';

    if (day === 1) {
      // Monday
      const opt = document.createElement('option');
      opt.value = 'Holiday Session (Monday Booking)';
      opt.textContent = 'Mondays are closed unless Public/School Holiday';
      bookingSessionSelect.appendChild(opt);
    } else if (day >= 2 && day <= 5) {
      // Weekdays
      weekdaySessions.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.val;
        opt.textContent = s.label;
        bookingSessionSelect.appendChild(opt);
      });
    } else {
      // Weekends
      weekendSessions.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.val;
        opt.textContent = s.label;
        bookingSessionSelect.appendChild(opt);
      });
    }
    calculateLivePrice();
  }

  if (bookingDateInput) {
    bookingDateInput.addEventListener('change', populateSessionOptions);
    populateSessionOptions();
  }

  // Stepper handlers (+ / - buttons)
  document.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute('data-target');
      const isPlus = btn.classList.contains('plus');
      const valEl = document.getElementById(targetId);
      if (!valEl) return;

      let current = parseInt(valEl.textContent) || 0;
      if (isPlus) {
        current = Math.min(30, current + 1);
      } else {
        const min = targetId === 'childCount' ? 1 : 0;
        current = Math.max(min, current - 1);
      }
      valEl.textContent = current;
      calculateLivePrice();
    });
  });

  function calculateLivePrice() {
    if (!estTotalEl) return;
    const bookingType = bookingTypeSelect ? bookingTypeSelect.value : 'session';
    const numKids = parseInt(childCountVal ? childCountVal.textContent : 1) || 1;
    const numAdults = parseInt(adultCountVal ? adultCountVal.textContent : 0) || 0;

    let childPrice = 1000;
    let adultAddonPrice = 500;

    if (bookingDateInput && bookingDateInput.value) {
      const day = new Date(bookingDateInput.value + 'T00:00:00').getDay();
      if (day === 0 || day === 6) {
        // Weekend pricing
        childPrice = 1500;
        adultAddonPrice = 500;
      } else {
        // Weekday pricing
        childPrice = 1000;
        adultAddonPrice = 500;
      }
    }

    if (bookingType === 'birthday') {
      estTotalEl.textContent = 'Custom Party Quote';
      return;
    } else if (bookingType === 'school') {
      estTotalEl.textContent = 'Special Group Discount';
      return;
    } else if (bookingType === 'private') {
      estTotalEl.textContent = 'VIP Buyout Quote';
      return;
    }

    const total = (numKids * childPrice) + (numAdults * adultAddonPrice);
    estTotalEl.textContent = `KES ${total.toLocaleString()}`;
  }

  if (bookingTypeSelect) {
    bookingTypeSelect.addEventListener('change', calculateLivePrice);
  }

  // Package Card Quick Select Handler
  window.selectPackage = function(packageType) {
    if (bookingTypeSelect) {
      bookingTypeSelect.value = packageType;
      calculateLivePrice();
    }
    scrollToTarget('#booking');
  };

  /* ------------------------------------------------------------------------
     11. Booking Form Submit & Confetti Celebration
     ------------------------------------------------------------------------ */
  const bookingForm = document.getElementById('bookingForm');
  const confirmationModal = document.getElementById('confirmationModal');
  const modalSummary = document.getElementById('modalSummary');
  const modalWhatsappBtn = document.getElementById('modalWhatsappBtn');
  const modalGmailBtn = document.getElementById('modalGmailBtn');
  const modalEmailBtn = document.getElementById('modalEmailBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('parentName') ? document.getElementById('parentName').value.trim() : '';
      const phone = document.getElementById('parentPhone') ? document.getElementById('parentPhone').value.trim() : '';
      const email = document.getElementById('parentEmail') ? document.getElementById('parentEmail').value.trim() : '';
      const date = document.getElementById('bookingDate') ? document.getElementById('bookingDate').value : '';
      const session = document.getElementById('bookingSession') ? document.getElementById('bookingSession').value : '';
      const bType = document.getElementById('bookingType') ? document.getElementById('bookingType').value : 'session';
      const kids = childCountVal ? childCountVal.textContent : '1';
      const adults = adultCountVal ? adultCountVal.textContent : '0';
      const message = document.getElementById('specialRequests') ? document.getElementById('specialRequests').value.trim() : '';
      const totalCost = estTotalEl ? estTotalEl.textContent.trim() : 'KES 1,000';

      // Friendly Booking Type Label
      let typeLabel = 'Standard Session Pass';
      if (bType === 'birthday') typeLabel = 'Birthday Party Package';
      else if (bType === 'school') typeLabel = 'School / Kindergarten Group Trip';
      else if (bType === 'private') typeLabel = 'Exclusive Private Venue Hire';

      const submitButton = bookingForm.querySelector('button[type="submit"]');
      if (submitButton.disabled || !bookingForm.reportValidity()) return;
      submitButton.disabled = true;
      let error = bookingForm.querySelector('[role="alert"]');
      if (!error) { error = document.createElement('p'); error.setAttribute('role', 'alert'); bookingForm.append(error); }
      error.textContent = '';
      try {
        await window.saveMallSubmission('contactLeads', {
          id: 'playon-' + crypto.randomUUID(), name, phone, email,
          subject: 'Play-On booking: ' + typeLabel,
          message: `Visit: ${date}; Session: ${session}; Children: ${kids}; Adults: ${adults}; Estimate: ${totalCost}. ${message}`,
          bookingStartDate: date, session, status: 'new', submittedAt: new Date().toISOString()
        }, 'mombasa_live_contact_leads');
      } catch (err) { error.textContent = err.message + ' Your details are still here.'; return; }
      finally { submitButton.disabled = false; }

      // Confetti Blast
      if (typeof confetti !== 'undefined') {
        const count = 200;
        const defaults = {
          origin: { y: 0.65 },
          colors: ['#00A651', '#FFD400', '#4FB3BF', '#FF6B35', '#FF3366', '#7B2CBF'],
        };

        function fire(particleRatio, opts) {
          confetti(Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio),
          }));
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      }

      // Populate Modal Summary
      if (modalSummary) {
        modalSummary.replaceChildren();
        Object.entries({'Parent / Guardian': name, 'Phone / WhatsApp': phone, Email: email,
          'Booking Type': typeLabel, 'Visit Date': date + ' (' + session + ')',
          Guests: kids + ' Child(ren), ' + adults + ' Adult(s)', 'Estimated Total': totalCost,
          Notes: message || 'None'}).forEach(([label, value]) => {
            const row = document.createElement('p'); const strong = document.createElement('strong');
            strong.textContent = label + ': '; row.append(strong, document.createTextNode(value)); modalSummary.append(row);
          });
      }

      // 1. Format WhatsApp prefilled message
      const waMessage = 
`🎈 *NEW PLAY-ON MOMBASA BOOKING REQUEST*

👤 *Parent / Guardian:* ${name}
📞 *Phone / WhatsApp:* ${phone}
✉️ *Email:* ${email}
🎪 *Booking Type:* ${typeLabel}
📅 *Visit Date:* ${date}
🕒 *Session Time:* ${session}
👶 *Children:* ${kids} | 👨 *Adults:* ${adults}
💰 *Estimated Total:* ${totalCost}
${message ? `📝 *Special Notes / Requests:* ${message}\n` : ''}
Please confirm our reservation at Mombasa Mall 2nd Floor. Thank you!`;

      if (modalWhatsappBtn) {
        modalWhatsappBtn.href = `https://wa.me/254780611074?text=${encodeURIComponent(waMessage)}`;
      }

      // 2. Format Email Subject & Body for Gmail & Default Mail Clients
      const emailSubject = `Play-On Booking Reservation - ${name} (${date})`;
      const emailBody = 
`Dear Play-On Mombasa Team,

I would like to confirm my booking reservation for Play-On Kids Indoor Playground at Mombasa Mall (2nd Floor).

BOOKING DETAILS:
----------------------------------------
• Parent / Guardian Name: ${name}
• Phone / WhatsApp Number: ${phone}
• Email Address: ${email}
• Booking Type: ${typeLabel}
• Preferred Visit Date: ${date}
• Selected Session: ${session}
• Number of Children (1-15 yrs): ${kids}
• Accompanying Adults: ${adults}
• Estimated Total: ${totalCost}
${message ? `• Special Requests / Notes: ${message}\n` : ''}----------------------------------------

Please confirm availability and booking confirmation for our visit.

Thank you!
${name}
${phone}`;

      // Gmail Web Compose Link
      if (modalGmailBtn) {
        modalGmailBtn.href = `https://mail.google.com/mail/?view=cm&fs=1&to=playonkenya@gmail.com&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      }

      // Default Email Client (Mailto) Link
      if (modalEmailBtn) {
        modalEmailBtn.href = `mailto:playonkenya@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      }

      // Show confirmation modal
      if (confirmationModal) {
        confirmationModal.returnFocus = document.activeElement;
        confirmationModal.previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        confirmationModal.setAttribute('aria-hidden', 'false');
        confirmationModal.classList.add('is-active');
        modalCloseBtn?.focus();
      }
    });
  }

  function closeBookingConfirmation() {
    confirmationModal.classList.remove('is-active');
    confirmationModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = confirmationModal.previousOverflow || '';
    confirmationModal.returnFocus?.focus();
  }
  document.addEventListener('keydown', event => {
    if (!confirmationModal?.classList.contains('is-active')) return;
    if (event.key === 'Escape') closeBookingConfirmation();
    if (event.key === 'Tab') {
      const controls = [...confirmationModal.querySelectorAll('a[href],button')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  if (modalCloseBtn && confirmationModal) {
    modalCloseBtn.addEventListener('click', () => {
      closeBookingConfirmation();
    });
  }

  if (confirmationModal) {
    confirmationModal.addEventListener('click', (e) => {
      if (e.target === confirmationModal) {
        closeBookingConfirmation();
      }
    });
  }

  /* ------------------------------------------------------------------------
     12. Interactive Gallery Lightbox
     ------------------------------------------------------------------------ */
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

  window.openLightbox = function(src, caption) {
    if (lightboxModal && lightboxImg) {
      lightboxImg.src = src;
      if (lightboxCaption) lightboxCaption.textContent = caption || 'Play-On Mombasa Fun Moment';
      lightboxModal.classList.add('is-open');
    }
  };

  if (lightboxCloseBtn && lightboxModal) {
    lightboxCloseBtn.addEventListener('click', () => {
      lightboxModal.classList.remove('is-open');
    });

    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) {
        lightboxModal.classList.remove('is-open');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightboxModal.classList.contains('is-open')) {
        lightboxModal.classList.remove('is-open');
      }
    });
  }

  /* ------------------------------------------------------------------------
     13. Testimonials Carousel Slider with Touch Swipe Support
     ------------------------------------------------------------------------ */
  const testimonialsTrack = document.querySelector('.testimonials-track');
  const prevTestimonialBtn = document.getElementById('prevTestimonial');
  const nextTestimonialBtn = document.getElementById('nextTestimonial');

  if (testimonialsTrack) {
    let currentIndex = 0;
    const cards = document.querySelectorAll('.testimonial-card');
    const totalCards = cards.length;

    function updateSlider() {
      if (!cards.length) return;
      const cardWidth = cards[0].offsetWidth + (window.innerWidth < 768 ? 16 : 32);
      testimonialsTrack.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    }

    if (nextTestimonialBtn) {
      nextTestimonialBtn.addEventListener('click', () => {
        const visibleCards = window.innerWidth >= 768 ? 2 : 1;
        if (currentIndex < totalCards - visibleCards) {
          currentIndex++;
        } else {
          currentIndex = 0;
        }
        updateSlider();
      });
    }

    if (prevTestimonialBtn) {
      prevTestimonialBtn.addEventListener('click', () => {
        const visibleCards = window.innerWidth >= 768 ? 2 : 1;
        if (currentIndex > 0) {
          currentIndex--;
        } else {
          currentIndex = Math.max(0, totalCards - visibleCards);
        }
        updateSlider();
      });
    }

    // Mobile Touch Swipe
    let touchStartX = 0;
    let touchEndX = 0;

    testimonialsTrack.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    testimonialsTrack.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchEndX < touchStartX - 40) {
        if (nextTestimonialBtn) nextTestimonialBtn.click();
      } else if (touchEndX > touchStartX + 40) {
        if (prevTestimonialBtn) prevTestimonialBtn.click();
      }
    }, { passive: true });

    // Auto-advance slider every 6 seconds
    setInterval(() => {
      if (nextTestimonialBtn) nextTestimonialBtn.click();
    }, 6000);

    window.addEventListener('resize', updateSlider);
  }

});
