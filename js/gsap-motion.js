/**
 * Mombasa Mall — GSAP Motion & Interaction Specification Script
 * Developed by Principal UI/UX Architect & Creative Technologist
 * EQUIP: GSAP, ScrollTrigger, Flip (Optional)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Register GSAP plugins
  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
  } else {
    console.warn("GSAP or ScrollTrigger is not loaded.");
    return;
  }

  // 1. SMOOTH PAGE/ROUTE TRANSITIONS
  initPageTransitions();

  // 2. KINETIC TYPOGRAPHY REVEAL
  initKineticTypography();

  // 3. MAGNETIC HOVER EFFECTS
  initMagneticHover();

  // 4. 3D ISOMETRIC FLOOR SWITCHER ANIMATION
  initIsometricStackTransitions();
});

/**
 * Creates a dynamic overlay transition curtain and hooks up link click events
 * for seamless page-in / page-out transition animations.
 */
function initPageTransitions() {
  // Create curtain element dynamically
  const curtain = document.createElement("div");
  curtain.style.position = "fixed";
  curtain.style.inset = "0";
  curtain.style.background = "#0A1D37"; // Deep Ocean Navy
  curtain.style.zIndex = "999999";
  curtain.style.transform = "translateY(0%)";
  curtain.style.pointerEvents = "none";
  document.body.appendChild(curtain);

  // Animate page entrance
  gsap.to(curtain, {
    translateY: "-100%",
    duration: 0.85,
    ease: "power4.inOut",
    delay: 0.1,
    onComplete: () => {
      curtain.style.display = "none";
    }
  });

  // Hook all local links for page exits
  document.querySelectorAll("a").forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;
    
    // Ignore external links, hashes, modals, or Javascript voids
    if (
      href.startsWith("http") || 
      href.startsWith("#") || 
      href.startsWith("javascript") ||
      link.getAttribute("target") === "_blank"
    ) {
      return;
    }

    link.addEventListener("click", (e) => {
      e.preventDefault();
      curtain.style.display = "block";
      
      // Animate page exit curtain
      gsap.fromTo(curtain, 
        { translateY: "100%" },
        {
          translateY: "0%",
          duration: 0.75,
          ease: "power4.inOut",
          onComplete: () => {
            window.location.href = href;
          }
        }
      );
    });
  });
}

/**
 * Scans heroes and displays a kinetic reveal stagger on headings.
 */
function initKineticTypography() {
  const titles = document.querySelectorAll(".hero h1, .hero-details-section h1, .main-content h1:first-of-type");
  
  titles.forEach(title => {
    // Avoid double splitting if already done by main.js
    if (title.querySelector(".kinetic-char")) return;
    
    const originalText = title.textContent.trim();
    if (!originalText || originalText.includes("→")) return;

    // Split text into characters/spans
    let charHTML = "";
    originalText.split("").forEach(char => {
      if (char === " ") {
        charHTML += '<span style="display:inline-block;">&nbsp;</span>';
      } else {
        charHTML += `<span class="kinetic-char" style="display:inline-block; transform-origin:bottom center; will-change:transform,opacity;">${char}</span>`;
      }
    });
    title.innerHTML = charHTML;

    // Stagger reveal animation
    gsap.fromTo(title.querySelectorAll(".kinetic-char"),
      {
        opacity: 0,
        y: 40,
        rotationX: -60,
        scaleY: 0.5
      },
      {
        opacity: 1,
        y: 0,
        rotationX: 0,
        scaleY: 1,
        duration: 0.95,
        stagger: 0.02,
        ease: "power4.out",
        scrollTrigger: {
          trigger: title,
          start: "top 90%",
          toggleActions: "play none none none"
        }
      }
    );
  });
}

/**
 * Creates dynamic magnetic interactive pull on all CTAs and store cards.
 */
function initMagneticHover() {
  const magnets = document.querySelectorAll(".cta-btn, .header-btn, .store-card, .glass-glow-card, .footer-social-links a");
  
  magnets.forEach(el => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Pull element towards cursor slightly
      gsap.to(el, {
        x: x * 0.35,
        y: y * 0.35,
        rotation: x * 0.03, // subtle dynamic skew rotation
        duration: 0.35,
        ease: "power2.out"
      });
      
      // If there's an image inside, give it a tiny shift too for parallax
      const img = el.querySelector("img");
      if (img) {
        gsap.to(img, {
          x: x * 0.08,
          y: y * 0.08,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    });

    el.addEventListener("mouseleave", () => {
      // Bounce back to original state
      gsap.to(el, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.6,
        ease: "elastic.out(1, 0.4)"
      });
      
      const img = el.querySelector("img");
      if (img) {
        gsap.to(img, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: "power2.out"
        });
      }
    });
  });
}

/**
 * Script advanced 3D visual changes on the floor stack directory.
 */
function initIsometricStackTransitions() {
  const layers = document.querySelectorAll(".floor-layer");
  if (layers.length === 0) return;

  layers.forEach(layer => {
    layer.addEventListener("click", () => {
      const clickedIdx = parseInt(layer.style.getPropertyValue("--layer-index"));

      layers.forEach(other => {
        const otherIdx = parseInt(other.style.getPropertyValue("--layer-index"));
        const plate = other.querySelector(".floor-layer-plate");
        const label = other.querySelector(".floor-layer-label");
        
        if (otherIdx === clickedIdx) {
          // Bring selected layer forward in 3D space
          gsap.to(other, {
            z: 35,
            duration: 0.5,
            ease: "back.out(1.4)"
          });
          
          if (plate) {
            gsap.to(plate, {
              backgroundColor: "rgba(255, 111, 89, 0.25)",
              borderColor: "rgba(255, 111, 89, 0.95)",
              boxShadow: "-15px 15px 35px rgba(255, 111, 89, 0.35)",
              duration: 0.4
            });
          }
          if (label) {
            gsap.to(label, {
              backgroundColor: "#FF6F59",
              color: "#FFFFFF",
              scale: 1.08,
              duration: 0.4
            });
          }
        } else {
          // Recede other layers or push them away from clicked layer
          const distance = otherIdx - clickedIdx;
          const zOffset = distance > 0 ? 15 : -15; // expand stack around selected
          
          gsap.to(other, {
            z: zOffset,
            duration: 0.5,
            ease: "power2.out"
          });
          
          if (plate) {
            gsap.to(plate, {
              backgroundColor: "rgba(10, 29, 55, 0.08)",
              borderColor: "rgba(255, 255, 255, 0.15)",
              boxShadow: "-6px 6px 12px rgba(10, 29, 55, 0.12)",
              duration: 0.4
            });
          }
          if (label) {
            gsap.to(label, {
              backgroundColor: "rgba(244, 241, 234, 0.95)",
              color: "#0A1D37",
              scale: 1.0,
              duration: 0.4
            });
          }
        }
      });
    });
  });

  // Trigger click on the initially active layer for baseline stagger spacing
  const initialActive = document.querySelector(".floor-layer.active");
  if (initialActive) {
    initialActive.dispatchEvent(new Event("click"));
  }
}
