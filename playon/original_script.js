
// Toggle navigation menu on mobile
const menuBtn = document.getElementById('menuBtn');
const nav = document.getElementById('navbar');

menuBtn.addEventListener('click', () => {
  nav.classList.toggle('active');
});

  function openLightbox(src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('show');
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('show');
  }


