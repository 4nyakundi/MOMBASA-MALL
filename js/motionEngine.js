/**
 * Mombasa Mall x Realevate — master motionEngine.js
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. REGISTER THE GSAP PLUGINS
  if (typeof gsap !== "undefined") {
    const plugins = [];
    if (typeof ScrollTrigger !== "undefined") plugins.push(ScrollTrigger);
    if (typeof ScrollSmoother !== "undefined") plugins.push(ScrollSmoother);
    if (typeof SplitText !== "undefined") plugins.push(SplitText);
    
    gsap.registerPlugin(...plugins);
  }

  // 2. SMOOTH SCROLL ENGINE
  let smootherInstance;
  if (typeof gsap !== "undefined" && typeof ScrollSmoother !== "undefined") {
    smootherInstance = ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.6,
      effects: true
    });
    console.log("Realevate ScrollSmoother initialized.");
  }

  // 3. REALEVATE-GRADE HERO STAGGER SPLITTEXT
  if (typeof gsap !== "undefined") {
    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle) {
      if (typeof SplitText !== "undefined") {
        const heroTitleSplit = new SplitText(".hero-title", { type: "words,chars" });
        gsap.from(heroTitleSplit.chars, {
          opacity: 0,
          y: 80,
          rotateX: -60,
          stagger: 0.02,
          duration: 1.2,
          ease: "power4.out"
        });
      } else {
        // Fallback split reveal
        const chars = heroTitle.textContent.trim().split("").map(c => 
          c === " " ? '<span style="display:inline-block;">&nbsp;</span>' : `<span class="char-reveal" style="display:inline-block; transform: translate3d(0, 30px, 0); opacity: 0;">${c}</span>`
        ).join("");
        heroTitle.innerHTML = chars;
        gsap.to(heroTitle.querySelectorAll(".char-reveal"), {
          opacity: 1,
          y: 0,
          stagger: 0.02,
          duration: 0.8,
          ease: "power3.out"
        });
      }
    }

    // 4. VIDEO SCROLL COMPRESSION & DEPTH PARALLAX
    const videoFrame = document.querySelector(".video-frame");
    if (videoFrame && typeof ScrollTrigger !== "undefined") {
      gsap.to(videoFrame, {
        scrollTrigger: {
          trigger: videoFrame,
          start: "top 70%",
          end: "bottom top",
          scrub: 1
        },
        scale: 0.96,
        borderRadius: "40px",
        yPercent: 8
      });
    }
  }

  // 5. BENTO CARD SPECULAR MOUSE FOLLOWER
  document.querySelectorAll('.bento-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
});
