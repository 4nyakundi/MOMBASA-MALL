// Initialize Swiper carousels (clients, testimonials)
document.addEventListener('DOMContentLoaded', function () {
  try {
    if (typeof Swiper === 'undefined') return;

    // Clients carousel
    const clientsEl = document.querySelector('.clients-swiper');
    if (clientsEl) {
      new Swiper(clientsEl, {
        loop: true,
        autoplay: { delay: 2500, disableOnInteraction: false },
        slidesPerView: 4,
        spaceBetween: 18,
        breakpoints: {
          320: { slidesPerView: 1 },
          600: { slidesPerView: 2 },
          900: { slidesPerView: 3 },
          1200: { slidesPerView: 4 }
        }
      });
    }

    // Testimonials carousel
    const testEl = document.querySelector('.testimonials-swiper');
    if (testEl) {
      new Swiper(testEl, {
        loop: true,
        autoplay: { delay: 4200, disableOnInteraction: false },
        slidesPerView: 1,
        spaceBetween: 20,
        pagination: { el: '.swiper-pagination', clickable: true }
      });
    }
  } catch (err) {
    console.warn('Swiper init failed', err);
  }
});
