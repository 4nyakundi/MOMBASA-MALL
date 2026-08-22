/**
 * preloader.js — Mombasa Mall
 * Bulletproof cinematic counter & visual preloader engine.
 * Deep Space Blue (#003049) · Sunflower Gold (#fcbf49) · Vivid Tangerine (#f77f00)
 */

(function () {
  'use strict';

  var preloader = document.getElementById('site-preloader');
  if (!preloader) {
    document.documentElement.classList.remove('site-preloader-pending');
    if (document.body) document.body.classList.add('is-ready');
    return;
  }

  var frames       = preloader.querySelectorAll('.site-preloader__frame');
  var tensEl       = document.getElementById('preloaderTens');
  var onesEl       = document.getElementById('preloaderOnes');
  var progressFill = document.getElementById('preloaderProgressFill');
  var statusText   = document.getElementById('preloaderStatusText');

  var isFinished = false;
  function finish() {
    if (isFinished) return;
    isFinished = true;

    document.documentElement.classList.remove('site-preloader-pending');
    if (document.body) {
      document.body.classList.add('is-ready');
      // Dispatch custom event for selectionMenu.js
      document.body.dispatchEvent(new CustomEvent('is-ready'));
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(preloader, {
        y: '-100%',
        duration: 0.75,
        ease: 'power4.inOut',
        onComplete: function () {
          preloader.classList.add('is-done');
          try { preloader.remove(); } catch (e) {}
        }
      });
    } else {
      preloader.classList.add('is-done');
      setTimeout(function () {
        try { preloader.remove(); } catch (e) {}
      }, 400);
    }
  }

  // Safety fallback timeout: under NO circumstances can the preloader hang longer than 2.6s
  setTimeout(finish, 2600);

  if (!tensEl || !onesEl) {
    finish();
    return;
  }

  // Smooth CSS transitions on inner stacks (10 digits each = 10% step)
  tensEl.style.transition = 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)';
  onesEl.style.transition = 'transform 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)';

  var frameCount = frames.length;
  var currentFrame = -1;

  var statusMessages = [
    '01 / INITIALIZING 5 FLOORS · MWEMBE TAYARI',
    '02 / CURATING 120+ RETAIL & LUXURY BRANDS',
    '03 / LOADING 4K LED BILLBOARD NETWORK',
    '04 / PREPARING COASTAL ROOFTOP DINING',
    '05 / LAUNCHING MOMBASA LUXURY CANVAS'
  ];

  function setDigits(tens, ones) {
    if (tensEl) tensEl.style.transform = 'translateY(-' + (tens * 10) + '%)';
    if (onesEl) onesEl.style.transform = 'translateY(-' + (ones * 10) + '%)';
  }

  function showFrame(index) {
    frames.forEach(function (f, i) {
      f.classList.toggle('is-active', i === index);
    });
  }

  // Show first frame right away
  showFrame(0);
  currentFrame = 0;
  setDigits(0, 0);

  var startTime = performance.now();
  var duration = 2000; // total duration ~2.0s

  function tick(now) {
    if (isFinished) return;

    var elapsed = now - startTime;
    var progress = Math.min(elapsed / duration, 1);

    // Easing: fast rise through 0-75, smooth deceleration into 99
    var easeProgress = Math.pow(progress, 0.85);
    var count = Math.min(Math.floor(easeProgress * 99), 99);

    var tens = Math.floor(count / 10);
    var ones = count % 10;
    setDigits(tens, ones);

    // Update progress bar fill
    if (progressFill) {
      progressFill.style.width = (count * 1.01) + '%';
    }

    // Switch image frame
    var frameIndex = Math.min(Math.floor((count / 100) * frameCount), frameCount - 1);
    if (frameIndex !== currentFrame) {
      currentFrame = frameIndex;
      showFrame(frameIndex);
    }

    // Update status text
    if (statusText) {
      var msgIndex = Math.min(Math.floor((count / 100) * statusMessages.length), statusMessages.length - 1);
      statusText.textContent = statusMessages[msgIndex];
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      setDigits(9, 9);
      if (progressFill) progressFill.style.width = '100%';
      if (statusText) statusText.textContent = '05 / WELCOME TO MOMBASA MALL';

      // Dramatic hold at 99%, then wipe open
      setTimeout(finish, 320);
    }
  }

  requestAnimationFrame(tick);

})();
