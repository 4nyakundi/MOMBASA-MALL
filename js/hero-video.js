// Select one video before loading, so phones never download the desktop clip.
(function () {
  const video = document.getElementById('heroVideo');
  if (!video) return;
  const phone = window.matchMedia('(max-width: 767px)');
  const desktopPoster = video.poster;

  function selectVideo() {
    const source = phone.matches ? video.dataset.mobileSrc : video.dataset.desktopSrc;
    if (video.getAttribute('src') === source) return;
    video.poster = phone.matches ? video.dataset.mobilePoster : desktopPoster;
    video.muted = true;
    video.src = source;
    video.load();
    const playback = video.play();
    if (playback) playback.catch(function () { /* Keep the poster if autoplay is unavailable. */ });
  }

  selectVideo();
  if (phone.addEventListener) phone.addEventListener('change', selectVideo);
  else phone.addListener(selectVideo);
})();
