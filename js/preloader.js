/**
 * preloader.js — Mombasa Mall
 * Animated counter 00 → 99 with category image flash, then hero reveal.
 * Mirrors the Realevate Agency preloader pattern.
 */
(function () {
  'use strict';

  var preloader = document.getElementById('site-preloader');
  if (!preloader) return;

  var frames   = preloader.querySelectorAll('.site-preloader__frame');
  var tensEl   = preloader.querySelector('.site-preloader__digit--tens .site-preloader__digit-inner');
  var onesEl   = preloader.querySelector('.site-preloader__digit--ones .site-preloader__digit-inner');

  if (!tensEl || !onesEl) {
    finish();
    return;
  }

  // Measure digit height dynamically from first number span
  var sampleNum = preloader.querySelector('.site-preloader__number');
  var digitH = sampleNum ? sampleNum.getBoundingClientRect().height : 140;

  // Give the inner columns a quick transition
  tensEl.style.transition = 'transform 0.12s cubic-bezier(0.4, 0, 0.2, 1)';
  onesEl.style.transition = 'transform 0.12s cubic-bezier(0.4, 0, 0.2, 1)';

  var count        = 0;
  var frameCount   = frames.length;
  var currentFrame = -1;

  // How many counter ticks per image frame
  var ticksPerFrame = frameCount > 0 ? Math.floor(99 / frameCount) : 99;

  function setDigit(el, index) {
    el.style.transform = 'translateY(-' + (index * digitH) + 'px)';
  }

  function showFrame(index) {
    frames.forEach(function (f, i) {
      f.classList.toggle('is-active', i === index);
    });
  }

  function finish() {
    preloader.classList.add('is-done');
    document.body.classList.add('is-ready');
    // Remove from DOM after transition
    preloader.addEventListener('transitionend', function onEnd() {
      preloader.removeEventListener('transitionend', onEnd);
      preloader.remove();
    });
  }

  // Kick off immediately so first frame shows right away
  showFrame(0);
  currentFrame = 0;

  var interval = setInterval(function () {
    count++;

    var tens = Math.floor(count / 10);
    var ones = count % 10;
    setDigit(tensEl, tens);
    setDigit(onesEl, ones);

    // Switch image frame
    var frameIndex = Math.min(Math.floor(count / ticksPerFrame), frameCount - 1);
    if (frameIndex !== currentFrame) {
      currentFrame = frameIndex;
      showFrame(frameIndex);
    }

    if (count >= 99) {
      clearInterval(interval);
      // Small pause at 99 for drama, then reveal
      setTimeout(finish, 420);
    }
  }, 22); // ~22ms ≈ 45fps, reaches 99 in ~2.2s
})();
