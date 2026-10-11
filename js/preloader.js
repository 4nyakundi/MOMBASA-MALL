// Short intro with a bounded exit, independent of GSAP and network requests.
(function () {
  'use strict';
  var preloader = document.getElementById('site-preloader');
  var counter = document.getElementById('preloaderCount');
  var fill = document.getElementById('preloaderProgressFill');
  var status = document.getElementById('preloaderStatusText');
  var frames = preloader ? preloader.querySelectorAll('.site-preloader__frame') : [];
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finished = false;
  var frameRequest = 0;
  var safetyTimer;
  var startedAt = performance.now();
  var duration = 1400;

  function showProgress(value) {
    if (counter) counter.textContent = String(value).padStart(2, '0');
    if (fill) fill.style.width = value + '%';
  }
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(safetyTimer);
    cancelAnimationFrame(frameRequest);
    showProgress(100);
    if (status) status.textContent = 'WELCOME TO MOMBASA MALL';
    document.documentElement.classList.remove('site-preloader-pending');
    if (!document.body.classList.contains('is-ready')) {
      document.body.classList.add('is-ready');
      document.body.dispatchEvent(new CustomEvent('is-ready'));
    }
    if (preloader) {
      preloader.classList.add('is-done');
      setTimeout(function () { preloader.remove(); }, reducedMotion ? 0 : 350);
    }
  }
  if (!preloader || !counter || !document.documentElement.classList.contains('site-preloader-pending')) {
    finish(); return;
  }
  if (reducedMotion) { finish(); return; }
  safetyTimer = setTimeout(finish, 2200);
  showProgress(0);
  function tick(now) {
    if (finished) return;
    var progress = Math.min((now - startedAt) / duration, 1);
    showProgress(Math.floor(progress * 100));
    var active = Math.min(Math.floor(progress * frames.length), frames.length - 1);
    frames.forEach(function (frame, index) { frame.classList.toggle('is-active', index === active); });
    if (status) status.textContent = progress < .5 ? 'DISCOVER SHOPPING, DINING & MORE' : 'YOUR MOMBASA MALL EXPERIENCE';
    if (progress < 1) frameRequest = requestAnimationFrame(tick);
    else setTimeout(finish, 120);
  }
  frameRequest = requestAnimationFrame(tick);
})();
