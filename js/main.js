gsap.registerPlugin(ScrollTrigger);

// ============ CURSOR ============
const cursor = document.querySelector(".cursor");
if (cursor) {
  // Create outer trailing ring dynamically
  let follower = document.querySelector(".cursor-follower");
  if (!follower) {
    follower = document.createElement("div");
    follower.className = "cursor-follower";
    document.body.appendChild(follower);
  }

  let mx = 0, my = 0, cx = 0, cy = 0, fx = 0, fy = 0;
  
  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });
  
  (function animateCursor() {
    // Lead dot follows mouse with quick LERP
    cx += (mx - cx) * 0.25;
    cy += (my - cy) * 0.25;
    cursor.style.left = cx + "px";
    cursor.style.top = cy + "px";
    
    // Follower ring follows with slower LERP for trailing delay
    fx += (mx - fx) * 0.08;
    fy += (my - fy) * 0.08;
    follower.style.left = fx + "px";
    follower.style.top = fy + "px";
    
    requestAnimationFrame(animateCursor);
  })();

  // Snapping and scaling on hover elements
  const hoverSelectors = "a, button, .tile, .fpill, .feature-card, .store-card, .info-card, .spec-card, .glow-card, input, select, textarea";
  
  function updateHoverListeners() {
    document.querySelectorAll(hoverSelectors).forEach((el) => {
      // Avoid adding multiple redundant listeners
      if (el.dataset.cursorBound) return;
      el.dataset.cursorBound = "true";
      
      el.addEventListener("mouseenter", () => {
        gsap.to(cursor, { width: 4, height: 4, backgroundColor: "#d99c10", duration: 0.2 });
        gsap.to(follower, { width: 48, height: 48, borderColor: "#d99c10", backgroundColor: "rgba(217,156,16,0.06)", duration: 0.3 });
      });
      
      el.addEventListener("mouseleave", () => {
        gsap.to(cursor, { width: 8, height: 8, backgroundColor: "#d99c10", duration: 0.2 });
        gsap.to(follower, { width: 28, height: 28, borderColor: "#fbc536", backgroundColor: "transparent", duration: 0.3 });
      });
    });
  }
  
  // Run initially and set a brief observer to bind dynamic elements too
  updateHoverListeners();
  setInterval(updateHoverListeners, 1500);
}

// ============ SVG LINE LENGTHS ============
document.querySelectorAll(".constellation-lines path").forEach((path) => {
  const length = path.getTotalLength();
  path.style.strokeDasharray = length;
  path.style.strokeDashoffset = length;
});

// ============ PAGE LOAD ============
const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
tl.to(".site-header", { opacity: 1, duration: 0.8 }, 0)
  .fromTo(".scroll-indicator", 
    { opacity: 0, y: -20 },
    { opacity: 0.85, y: 0, duration: 1, ease: "bounce.out" }, 
    0.3
  );

// ============ SCROLL REVEAL HERO DETAILS & CONSTELLATION ============
// Initialize initial hidden states for widgets to ensure clean trigger entry
gsap.set("#hero-details-section .status-widget", { opacity: 0, scale: 0.92 });
gsap.set("#hero-details-section .tag-badge", { opacity: 0, y: 15 });
gsap.set("#hero-details-section .hero-desc, #hero-details-section .cta-btn", { opacity: 0, y: 15 });

const detailsTl = gsap.timeline({
  scrollTrigger: {
    trigger: "#hero-details-section",
    start: "top 80%",
    toggleActions: "play none none reverse"
  }
});

detailsTl.to("#hero-details-section .title-inner", {
  y: 0,
  duration: 1.1,
  stagger: 0.08,
  ease: "power4.out"
})
.to("#hero-details-section .tag-badge", {
  opacity: 1,
  y: 0,
  duration: 0.6,
  stagger: 0.05,
  ease: "back.out(1.7)"
}, 0.2)
.to("#hero-details-section .hero-desc, #hero-details-section .cta-btn", {
  opacity: 1,
  y: 0,
  duration: 0.8,
  stagger: 0.1
}, 0.4)
.to("#hero-details-section .status-widget", {
  opacity: 1,
  scale: 1,
  duration: 0.8,
  ease: "back.out(1.2)"
}, 0.5)
.fromTo("#hero-details-section .info-card", 
  { opacity: 0, y: 30, scale: 0.95 },
  { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.12, ease: "power3.out" },
  0.4
)
.to(".workspace", { opacity: 1, duration: 0.8 }, 0.8);


// ============ STAT NUMBER COUNTER ============
document.querySelectorAll(".stat-num").forEach((el) => {
  const target = parseInt(el.dataset.num);
  const suffix = el.querySelector(".accent");
  const suffixText = suffix ? suffix.outerHTML : "";
  ScrollTrigger.create({
    trigger: el,
    start: "top 85%",
    once: true,
    onEnter: () => {
      let obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 2,
        ease: "power2.out",
        onUpdate: () => {
          let display = Math.floor(obj.val);
          if (target >= 1000)
            display = "+" + (display / 1000).toFixed(1).replace(".0", "") + "k";
          else if (
            target >= 100 &&
            target <= 999 &&
            suffix &&
            suffix.textContent === "k"
          )
            display = "+" + display;
          el.innerHTML = display + suffixText;
        }
      });
    }
  });
});

// ============ SECTION TITLE REVEALS ============
function splitWords(selector) {
  document.querySelectorAll(selector).forEach((el) => {
    const words = el.innerText.split(" ");
    el.innerHTML = words
      .map(
        (w) =>
          `<span class="sword" style="display:inline-block;overflow:hidden;padding-bottom:0.12em;vertical-align:top;"><span class="sword-inner" style="display:inline-block;transform:translateY(110%);will-change:transform;">${w}</span></span>`
      )
      .join(" ");
  });
}
splitWords(".features-title");
splitWords(".quote-text");
splitWords(".final-cta-h2");

// Note: splitWords destroys spans like .accent. Re-color accent words for final-cta.
document.querySelectorAll(".final-cta-h2 .sword-inner").forEach((el) => {
  if (el.textContent.includes("good") || el.textContent.includes("ones")) {
    el.style.color = "var(--yellow)";
  }
});

gsap.to(".features-title .sword-inner", {
  y: 0,
  duration: 1,
  stagger: 0.04,
  ease: "power4.out",
  scrollTrigger: {
    trigger: ".features-title",
    start: "top 80%",
    toggleActions: "play none none reverse"
  }
});

gsap.to(".quote-text .sword-inner", {
  y: 0,
  duration: 0.9,
  stagger: 0.03,
  ease: "power4.out",
  scrollTrigger: {
    trigger: ".quote-text",
    start: "top 75%",
    toggleActions: "play none none reverse"
  }
});

gsap.to(".final-cta-h2 .sword-inner", {
  y: 0,
  duration: 1,
  stagger: 0.05,
  ease: "power4.out",
  scrollTrigger: {
    trigger: ".final-cta-h2",
    start: "top 80%",
    toggleActions: "play none none reverse"
  }
});

// ============ FEATURE CARDS REVEAL ============
gsap.from(".feature-card", {
  y: 80,
  opacity: 0,
  duration: 1,
  stagger: 0.15,
  ease: "power3.out",
  scrollTrigger: {
    trigger: ".feature-cards",
    start: "top 75%",
    toggleActions: "play none none reverse"
  }
});

// ============ QUOTE MARK ============
gsap.from(".quote-mark", {
  scale: 0,
  rotation: -45,
  duration: 1.2,
  ease: "elastic.out(1, 0.6)",
  scrollTrigger: {
    trigger: ".quote-mark",
    start: "top 80%",
    toggleActions: "play none none reverse"
  }
});

// ============ 3D PERSPECTIVE CARD HOVER ============
const tiltSelectors = ".feature-card, .info-card, .store-card, .spec-card, .glow-card";
function init3DTilt() {
  document.querySelectorAll(tiltSelectors).forEach((card) => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "true";
    
    // Ensure parent has perspective
    if (card.parentElement) {
      card.parentElement.style.perspective = "1500px";
    }
    
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(card, {
        rotationY: x * 10,
        rotationX: -y * 10,
        y: -10,
        duration: 0.4,
        ease: "power2.out"
      });
    });
    
    card.addEventListener("mouseleave", () => {
      gsap.to(card, {
        rotationY: 0,
        rotationX: 0,
        y: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.6)"
      });
    });
  });
}
init3DTilt();
setInterval(init3DTilt, 1500);

// ============ FINAL CTA PULSE ON ENTRY ============
gsap.from(".final-cta-card", {
  scale: 0.92,
  opacity: 0,
  duration: 1.2,
  ease: "power3.out",
  scrollTrigger: {
    trigger: ".final-cta-card",
    start: "top 80%",
    toggleActions: "play none none reverse"
  }
});

// ============ SCROLLED HEADER ============
window.addEventListener("scroll", () => {
  const header = document.querySelector(".site-header");
  if (header) {
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  }
});

// ============ MAGNETIC BUTTONS ============
document.querySelectorAll(".cta-btn, .header-btn").forEach((btn) => {
  btn.addEventListener("mousemove", (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(btn, {
      x: x * 0.35,
      y: y * 0.35,
      duration: 0.35,
      ease: "power2.out"
    });
  });
  btn.addEventListener("mouseleave", () => {
    gsap.to(btn, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.3)"
    });
  });
});

// ============ INTERACTIVE FLOORS TABS (HOMEPAGE) ============
async function initInteractiveStores() {
  const tabContainer = document.getElementById("stores-tabs-container");
  const displayContainer = document.getElementById("stores-display-content");
  if (!tabContainer || !displayContainer) return;

  try {
    const res = await fetch("/json/stores.json");
    const data = await res.json();
    if (!data || !data.floors) return;

    // Expose to window global so modal can access it
    window.storesDataGlobal = data;

    // Create tabs
    tabContainer.innerHTML = "";
    data.floors.forEach((floor, idx) => {
      const btn = document.createElement("button");
      btn.className = `tab-btn ${idx === 0 ? "active" : ""}`;
      btn.textContent = floor.name;
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        showFloorShops(floor.shops);
      });
      tabContainer.appendChild(btn);
    });

    // Helper to show shops with GSAP stagger animation
    function showFloorShops(shops) {
      gsap.to(displayContainer, {
        opacity: 0,
        y: 10,
        duration: 0.2,
        onComplete: () => {
          displayContainer.innerHTML = `
            <div class="stores-list-grid">
              ${shops.map((shop) => `
                <div class="store-card glow-card" onclick="openShopModal('${shop.name}')" style="cursor:none; display:flex; align-items:center; gap:14px; padding:16px 20px; border-radius:16px; background:rgba(255,255,255,0.45);">
                  <img src="${shop.logo || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png'}" alt="${shop.name}" class="store-card-logo" style="width:36px; height:36px; border-radius:8px; object-fit:contain; background:white; border:1px solid rgba(15,15,15,0.05); padding:2px;">
                  <div class="store-card-info" style="display:flex; flex-direction:column; gap:2px; text-align:left;">
                    <span style="font-size:10px; color:var(--yellow-deep); font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">${shop.room}</span>
                    <strong style="font-size:13px; font-weight:700; color:var(--ink);">${shop.name}</strong>
                  </div>
                </div>
              `).join("")}
            </div>
          `;

          // Setup cursor listener for newly created cards
          const cursor = document.querySelector(".cursor");
          if (cursor) {
            document.querySelectorAll(".store-card").forEach((el) => {
              el.addEventListener("mouseenter", () =>
                gsap.to(cursor, { width: 36, height: 36, duration: 0.3 })
              );
              el.addEventListener("mouseleave", () =>
                gsap.to(cursor, { width: 12, height: 12, duration: 0.3 })
              );
            });
          }

          // Fade in with stagger
          const cards = displayContainer.querySelectorAll(".store-card");
          gsap.fromTo(cards,
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.45, stagger: 0.04, ease: "power2.out" }
          );
          gsap.to(displayContainer, { opacity: 1, y: 0, duration: 0.2 });
        }
      });
    }

    // Show first floor by default
    showFloorShops(data.floors[0].shops);

  } catch (err) {
    console.warn("Interactive stores init failed:", err);
  }
}

// ============ SHOP DETAIL MODAL WINDOW GLOBALS ============
window.openShopModal = function(shopName) {
  if (!window.storesDataGlobal) return;
  let foundShop = null;
  window.storesDataGlobal.floors.forEach(f => {
    f.shops.forEach(s => {
      if (s.name === shopName) foundShop = s;
    });
  });
  
  if (foundShop) {
    document.getElementById('modal-shop-name').textContent = foundShop.name;
    document.getElementById('modal-shop-location').textContent = foundShop.room;
    document.getElementById('modal-shop-desc').textContent = foundShop.description || '';
    document.getElementById('modal-shop-phone').textContent = foundShop.phone || '+254 700 000 000';
    document.getElementById('modal-shop-email').textContent = foundShop.email || 'info@mombasamall.co.ke';
    document.getElementById('modal-shop-social').textContent = foundShop.social || '@mombasamall';
    document.getElementById('modal-shop-logo').src = foundShop.logo || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
    
    const modal = document.getElementById('shop-modal');
    if (modal) {
      modal.style.display = 'flex';
      gsap.fromTo(modal.querySelector('.shop-modal-content'),
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.5)" }
      );
    }
  }
};

window.closeShopModal = function() {
  const modal = document.getElementById('shop-modal');
  if (modal) {
    gsap.to(modal.querySelector('.shop-modal-content'), {
      scale: 0.9,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        modal.style.display = 'none';
      }
    });
  }
};

// ============ LIVE PARKING STATUS SIMULATOR ============
function initParkingSimulator() {
  const valEl = document.getElementById("live-parking-val");
  if (!valEl) return;
  let spaces = 142;
  setInterval(() => {
    const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
    spaces = Math.min(220, Math.max(15, spaces + change));
    valEl.textContent = spaces + " spaces free";
  }, 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  initInteractiveStores();
  initParkingSimulator();
});

// Refresh
window.addEventListener("load", () => {
  ScrollTrigger.refresh();
});

