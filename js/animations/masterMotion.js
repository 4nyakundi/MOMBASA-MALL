/**
 * Mombasa Mall — Master Motion Controller
 * Developed by Principal Creative Technologist & Lead UI/UX Architect
 * Integrates: ScrollSmoother, ScrollTrigger, SplitText, Flip, Draggable, MotionPath, ScrambleText
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. REGISTER THE GSAP STACK WITH FALLBACKS
  registerGsapPlugins();

  // 2. SMOOTH SCROLL INITIALIZATION
  initSmoothScroll();

  // 3. HERO VIDEO TIMELINE & TEXT STAGGER
  initHeroTimeline();

  // 4. WAYFINDING PATHING ANIMATION
  initWayfindingPaths();

  // 5. DRAGGABLE STAGE & INERTIA PREVIEW
  initDraggableMap();

  // 6. SCRAMBLE TEXT TICKERS
  initScrambleCounters();
});

/**
 * Robust plugin registration. Since premium plugins (ScrollSmoother, SplitText, ScrambleText) 
 * might be restricted in standard CDNs, we provide fallbacks for all premium features.
 */
function registerGsapPlugins() {
  if (typeof gsap !== "undefined") {
    const plugins = [];
    if (typeof ScrollTrigger !== "undefined") plugins.push(ScrollTrigger);
    if (typeof Draggable !== "undefined") plugins.push(Draggable);
    if (typeof MotionPathPlugin !== "undefined") plugins.push(MotionPathPlugin);
    
    // Register whatever is loaded
    gsap.registerPlugin(...plugins);
  }
}

/**
 * Initializes ScrollSmoother globally on #smooth-wrapper and #smooth-content
 */
function initSmoothScroll() {
  if (typeof gsap !== "undefined" && typeof ScrollSmoother !== "undefined") {
    ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.6,
      effects: true,
      normalizeScroll: false
    });
    console.log("GSAP ScrollSmoother initialized.");
  } else {
    // Fallback to standard scroll indicator progress
    window.addEventListener("scroll", () => {
      const bar = document.querySelector(".scroll-progress-bar");
      if (bar) {
        const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        bar.style.width = pct + "%";
      }
    });
  }
}

/**
 * Scrubbing timeline on full-bleed home.mp4 & stagger text reveals
 */
function initHeroTimeline() {
  const heroVideo = document.getElementById("hero-video");
  const heroTitle = document.querySelector(".hero-title");
  
  if (typeof gsap !== "undefined") {
    // Parallax compression on scroll
    if (heroVideo) {
      gsap.to(heroVideo, {
        scale: 1.12,
        opacity: 0.15,
        yPercent: 12,
        scrollTrigger: {
          trigger: "#home",
          start: "top top",
          end: "bottom top",
          scrub: true
        }
      });
    }

    // Kinetic reveal
    if (heroTitle) {
      // SplitText fallback
      let chars;
      if (typeof SplitText !== "undefined") {
        const split = new SplitText(heroTitle, { type: "chars,words" });
        chars = split.chars;
      } else {
        // Splitting manually
        const text = heroTitle.textContent.trim();
        heroTitle.innerHTML = text.split("").map(c => 
          c === " " ? '<span style="display:inline-block;">&nbsp;</span>' : `<span class="char-reveal" style="display:inline-block;">${c}</span>`
        ).join("");
        chars = heroTitle.querySelectorAll(".char-reveal");
      }

      gsap.fromTo(chars,
        { opacity: 0, y: 35, skewX: -10 },
        {
          opacity: 1,
          y: 0,
          skewX: 0,
          duration: 0.8,
          stagger: 0.02,
          ease: "power3.out",
          scrollTrigger: {
            trigger: heroTitle,
            start: "top 85%"
          }
        }
      );
    }
  }
}

/**
 * Animates dynamic route lines inside the floor mapping directories
 */
function initWayfindingPaths() {
  const paths = document.querySelectorAll(".wayfinding-route-path");
  if (typeof gsap === "undefined" || paths.length === 0) return;

  paths.forEach(path => {
    // Calculate total path length
    const pathLength = path.getTotalLength ? path.getTotalLength() : 800;
    
    // Set dash arrays
    path.style.strokeDasharray = pathLength;
    path.style.strokeDashoffset = pathLength;

    gsap.fromTo(path,
      { strokeDashoffset: pathLength },
      {
        strokeDashoffset: 0,
        duration: 2.2,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: path,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      }
    );
  });
}

/**
 * Allows maps to be dragged with Inertia throwing physics
 */
function initDraggableMap() {
  const container = document.querySelector(".draggable-map-container");
  const stage = document.querySelector(".draggable-map-canvas");

  if (typeof gsap === "undefined" || typeof Draggable === "undefined" || !container || !stage) return;

  Draggable.create(stage, {
    type: "x,y",
    edgeResistance: 0.75,
    bounds: container,
    inertia: true, // throw effects
    cursor: "none",
    onDragStart: function() {
      gsap.to(".cursor-follower", { scale: 1.5, borderColor: "#D4AF37", duration: 0.2 });
    },
    onDragEnd: function() {
      gsap.to(".cursor-follower", { scale: 1.0, borderColor: "#FF6B4A", duration: 0.2 });
    }
  });
}

/**
 * Custom scramble letter ticker fallback for B2B booking value counters
 */
function initScrambleCounters() {
  const scrambleEls = document.querySelectorAll(".scramble-text-value");
  if (typeof gsap === "undefined" || scrambleEls.length === 0) return;

  scrambleEls.forEach(el => {
    const targetValue = el.getAttribute("data-value") || el.textContent;
    const isNum = !isNaN(parseFloat(targetValue.replace(/,/g, "")));

    ScrollTrigger.create({
      trigger: el,
      start: "top 90%",
      onEnter: () => {
        if (typeof ScrambleTextPlugin !== "undefined") {
          // Premium scramble reveal
          gsap.to(el, {
            scrambleText: { text: targetValue, chars: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", speed: 0.4 },
            duration: 1.5
          });
        } else if (isNum) {
          // Classic numeric rollup counter
          const parsed = parseFloat(targetValue.replace(/,/g, ""));
          let obj = { val: 0 };
          gsap.to(obj, {
            val: parsed,
            duration: 1.8,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = Math.floor(obj.val).toLocaleString();
            }
          });
        } else {
          // Custom character shuffle scramble effect
          const chars = "XYZ0123456789#@$%";
          let iterations = 0;
          const interval = setInterval(() => {
            el.textContent = targetValue.split("").map((c, idx) => {
              if (idx < iterations) return targetValue[idx];
              return chars[Math.floor(Math.random() * chars.length)];
            }).join("");
            
            if (iterations >= targetValue.length) {
              clearInterval(interval);
            }
            iterations += 0.5;
          }, 35);
        }
      }
    });
  });
}
