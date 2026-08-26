// js/data-renderer.js
// Universal data renderer pulling live from Firestore collections with graceful fallback to static JSON.

import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

  // Helper for JSON fallback
  async function fetchJson(path) {
    try {
      const r = await fetch(path);
      return await r.json();
    } catch (err) {
      console.warn('Failed to load local JSON fallback:', path, err);
      return null;
    }
  }

  // ----------------------------------------------------
  // 1. POPULATE STORES / DIRECTORY
  // ----------------------------------------------------
  let storesData = { floors: [] };
  try {
    const shopsSnap = await getDocs(collection(db, 'shops'));
    if (!shopsSnap.empty) {
      const shopsList = shopsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.isActive !== false);

      // Group shops by floor
      const floorNames = ["Ground Floor", "First Floor", "Second Floor", "Third Floor", "Basement Parking"];
      storesData.floors = floorNames.map(fName => ({
        name: fName,
        shops: shopsList.filter(s => (s.floor || '').toLowerCase() === fName.toLowerCase())
      })).filter(f => f.shops.length > 0);
    }
  } catch (firestoreErr) {
    console.warn('Firestore shops fetch failed; using stores.json fallback:', firestoreErr);
  }

  // If Firestore returned no floors, fallback to stores.json
  if (!storesData.floors || storesData.floors.length === 0) {
    storesData = await fetchJson('../json/stores.json') || await fetchJson('./json/stores.json') || { floors: [] };
  }

  if (storesData && storesData.floors) {
    window.storesDataGlobal = storesData;
    const list = document.getElementById('store-list');
    const searchInput = document.getElementById('directory-search');
    let currentCategory = 'all';
    let activeFloor = 'Ground Floor';
    
    const floorLayers = document.querySelectorAll('.floor-layer');
    const hasFloorSwitcher = floorLayers.length > 0;
    
    function renderDirectory(searchQuery = '', activeCategory = 'all') {
      if (!list) return;
      list.innerHTML = '';
      
      storesData.floors.forEach((floor) => {
        if (hasFloorSwitcher && floor.name !== activeFloor) return;
        
        const filteredShops = floor.shops.filter(s => {
          const matchesSearch = !searchQuery || 
                                (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
                                (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                (s.room && s.room.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchesCategory = activeCategory === 'all' || 
                                  (s.category && s.category.toLowerCase() === activeCategory.toLowerCase());
          return matchesSearch && matchesCategory;
        });
        
        if (filteredShops.length === 0) return;
        
        if (!hasFloorSwitcher) {
          const colHeading = document.createElement('div');
          colHeading.style.gridColumn = '1 / -1';
          colHeading.style.marginTop = '24px';
          colHeading.innerHTML = `<h3 style="font-size: 20px; font-weight: 800; font-family: var(--font-headings, sans-serif); color: var(--navy, #0A1D37); margin-bottom: 8px;">${floor.name}</h3>`;
          list.appendChild(colHeading);
        }
        
        filteredShops.forEach((s) => {
          const card = document.createElement('div');
          card.className = 'store-card glass-glow-card';
          card.style.display = 'flex';
          card.style.alignItems = 'center';
          card.style.gap = '14px';
          card.style.padding = '16px 20px';
          card.style.borderRadius = '16px';
          card.style.cursor = 'pointer';
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');

          const logoSrc = s.logoUrl || s.logo || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
          const desc = (s.description || '').slice(0, 65) + ((s.description || '').length > 65 ? '…' : '');
          card.innerHTML = `
            <img src="${logoSrc}" alt="${s.name}" class="store-card-logo"
              style="width:44px;height:44px;border-radius:8px;object-fit:contain;background:#fff;border:1px solid rgba(15,15,15,0.08);padding:3px;flex-shrink:0;"
              onerror="this.src='./assets/Logo/Mall Logo/MOMBASA MALL 1.0.png'">
            <div class="store-card-info" style="display:flex;flex-direction:column;gap:2px;text-align:left;flex:1;min-width:0;">
              <span style="font-size:10px;color:var(--coral,#FF6F59);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${s.room || 'Unit'} · ${s.floor || ''}</span>
              <strong style="font-size:14px;font-weight:700;color:var(--navy,#0A1D37);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.name}</strong>
              <span style="font-size:11px;color:var(--ink-soft,#4B5966);">${desc}</span>
            </div>
          `;

          const handleClick = () => {
            if (typeof openShopModal === 'function') {
              openShopModal(s.name, s);
            }
          };
          card.addEventListener('click', handleClick);
          card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); });

          list.appendChild(card);
        });
      });

      if (list.children.length === 0) {
        list.innerHTML = `

          <div style="grid-column: 1 / -1; text-align:center; padding:48px; color:var(--ink-soft, #4B5966);">
            <h3 style="font-size:18px; font-weight:700; color:var(--navy, #0A1D37);">No matching stores found</h3>
            <p style="font-size:14px; margin-top:8px;">Try searching for a different keyword or checking another category.</p>
          </div>
        `;
      } else if (typeof gsap !== 'undefined') {
        const cards = list.querySelectorAll('.store-card');
        gsap.fromTo(cards, 
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.35, stagger: 0.02, ease: "power2.out" }
        );
      }
    }
    
    if (hasFloorSwitcher) {
      floorLayers.forEach(layer => {
        layer.addEventListener('click', () => {
          floorLayers.forEach(l => l.classList.remove('active'));
          layer.classList.add('active');
          activeFloor = layer.getAttribute('data-floor');
          
          const badge = document.getElementById('active-floor-badge');
          if (badge) badge.textContent = `Current Floor: ${activeFloor}`;
          
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(layer.querySelector('.floor-layer-plate'), 
              { scale: 0.95 },
              { scale: 1, duration: 0.3, ease: "back.out(1.5)" }
            );
          }
          
          const q = searchInput ? searchInput.value : '';
          renderDirectory(q, currentCategory);
        });
      });
      
      const activeLayer = document.querySelector('.floor-layer.active');
      if (activeLayer) activeFloor = activeLayer.getAttribute('data-floor');
    }
    
    renderDirectory();
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderDirectory(e.target.value, currentCategory);
      });
    }
    
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category') || 'all';
        const q = searchInput ? searchInput.value : '';
        renderDirectory(q, currentCategory);
      });
    });
  }

  // ----------------------------------------------------
  // 2. POPULATE EVENTS & NEWS
  // ----------------------------------------------------
  let eventsData = { upcoming: [], past: [] };
  try {
    const eventsSnap = await getDocs(collection(db, 'events'));
    if (!eventsSnap.empty) {
      eventsSnap.docs.forEach(d => {
        const item = d.data();
        if (item.type === 'past') {
          eventsData.past.push(item);
        } else {
          eventsData.upcoming.push(item);
        }
      });
    }
  } catch (err) {
    console.warn('Firestore events fetch failed; using JSON fallback:', err);
  }

  if (eventsData.upcoming.length === 0 && eventsData.past.length === 0) {
    eventsData = await fetchJson('../json/events.json') || await fetchJson('./json/events.json') || { upcoming: [], past: [] };
  }

  const upEl = document.getElementById('events-upcoming');
  if (upEl && eventsData.upcoming && eventsData.upcoming.length > 0) {
    upEl.innerHTML = eventsData.upcoming.map(e => `
      <article class="event-card glass-glow-card" style="padding:24px 28px;border-radius:16px;display:flex;flex-direction:column;gap:10px;">
        <time class="event-date" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--coral,#FF6F59);">${formatEventDate(e.date)}</time>
        <h3 class="event-title" style="margin:0;font-size:18px;font-family:'Clash Display',sans-serif;font-weight:700;color:var(--navy,#0A1D37);">${e.title}</h3>
        <p class="event-summary" style="margin:0;font-size:14px;line-height:1.6;color:var(--ink-soft,#4B5966);">${e.summary || ''}</p>
        <span class="event-badge" style="display:inline-block;background:rgba(255,111,89,0.1);color:var(--coral,#FF6F59);border:1px solid rgba(255,111,89,0.25);padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;align-self:flex-start;">Upcoming</span>
      </article>
    `).join('');
  } else if (upEl) {
    upEl.innerHTML = `<p style="color:var(--ink-soft,#4B5966);font-size:14px;padding:20px 0;">No upcoming events scheduled. Check back soon!</p>`;
  }

  const pastEl = document.getElementById('events-past');
  if (pastEl && eventsData.past && eventsData.past.length > 0) {
    pastEl.innerHTML = eventsData.past.map(e => `
      <div class="past-event-row" style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid rgba(10,29,55,0.08);">
        <span style="font-size:11px;font-weight:700;color:var(--ink-soft,#4B5966);white-space:nowrap;min-width:80px;">${formatEventDate(e.date)}</span>
        <strong style="font-size:14px;color:var(--navy,#0A1D37);">${e.title}</strong>
      </div>
    `).join('');
  } else if (pastEl) {
    pastEl.innerHTML = `<p style="color:var(--ink-soft,#4B5966);font-size:14px;padding:20px 0;">No past events yet.</p>`;
  }

  function formatEventDate(dateStr) {
    if (!dateStr) return 'TBD';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  }


  // ----------------------------------------------------
  // 3. POPULATE BLOG / JOURNAL
  // ----------------------------------------------------
  let blogPosts = [];
  try {
    const blogSnap = await getDocs(collection(db, 'blogPosts'));
    if (!blogSnap.empty) {
      blogPosts = blogSnap.docs.map(d => d.data());
    }
  } catch (err) {
    console.warn('Firestore blog fetch failed; using JSON fallback:', err);
  }

  if (blogPosts.length === 0) {
    const bJson = await fetchJson('../json/blog.json') || await fetchJson('./json/blog.json');
    if (bJson && bJson.posts) blogPosts = bJson.posts;
  }

  const blogList = document.getElementById('blog-list');
  if (blogList && blogPosts.length > 0) {
    blogList.innerHTML = blogPosts.map(p => `
      <article class="post glow-card" style="padding:28px; background:rgba(255,255,255,0.4); display:flex; flex-direction:column; gap:12px; align-items:start; border-radius:16px;">
        <small style="color:var(--yellow-deep, #E5C07B); font-weight:700; text-transform:uppercase; letter-spacing:0.05em; font-size:11px;">${p.date || ''}</small>
        <h3 style="margin:0; font-size:20px; font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; color:var(--ink, #0A1D37);">${p.title}</h3>
        <p style="margin:0; font-size:14px; line-height:1.6; color:var(--ink-soft, #4B5966);">${p.excerpt}</p>
        <a href="./blog.html#read-${p.slug || ''}" onclick="alert('Viewing Blog Article: \\n\\n' + this.previousElementSibling.textContent)" class="cta-btn" style="margin-top:8px; cursor:pointer;">Read Article <span class="cta-arrow">→</span></a>
      </article>
    `).join('');
  }

  // ----------------------------------------------------
  // 4. POPULATE REVIEWS (APPROVED ONLY)
  // ----------------------------------------------------
  let reviewsData = { testimonials: [], customerFeedback: [] };
  try {
    const revQuery = query(collection(db, 'reviews'), where('approved', '==', true));
    const revSnap = await getDocs(revQuery);
    if (!revSnap.empty) {
      revSnap.docs.forEach(d => {
        const item = d.data();
        if (item.type === 'testimonial') {
          reviewsData.testimonials.push(item);
        } else {
          reviewsData.customerFeedback.push(item);
        }
      });
    }
  } catch (err) {
    console.warn('Firestore reviews fetch failed; using JSON fallback:', err);
  }

  if (reviewsData.testimonials.length === 0 && reviewsData.customerFeedback.length === 0) {
    reviewsData = await fetchJson('../json/reviews.json') || await fetchJson('./json/reviews.json') || { testimonials: [], customerFeedback: [] };
  }

  const testWrap = document.querySelector('.testimonials-swiper .swiper-wrapper');
  if (testWrap && reviewsData.testimonials) {
    testWrap.innerHTML = reviewsData.testimonials.map(t => `
      <div class="swiper-slide">
        <blockquote>"${t.quote}"</blockquote>
        <div class="quote-author">${t.author} — ${'★'.repeat(t.rating || 5)}</div>
      </div>
    `).join('');
  }
  const feedback = document.getElementById('customer-feedback');
  if (feedback && reviewsData.customerFeedback) {
    feedback.innerHTML = reviewsData.customerFeedback.map(f => `
      <div class="feedback glow-card" style="padding:20px 24px; background:rgba(255,255,255,0.45); display:flex; flex-direction:column; gap:6px; border-radius:12px;">
        <strong style="font-size:14px; color:var(--ink, #0A1D37);">${f.author || f.name}</strong>
        <p style="margin:0; font-size:13px; line-height:1.5; color:var(--ink-soft, #4B5966);">${f.quote || f.comment}</p>
      </div>
    `).join('');
  }

  // ----------------------------------------------------
  // 5. POPULATE CLIENTS CAROUSEL
  // ----------------------------------------------------
  const clients = await fetchJson('../json/clients.json') || await fetchJson('./json/clients.json');
  if (clients && clients.clients) {
    const clientsWrapper = document.querySelector('.clients-swiper .swiper-wrapper');
    if (clientsWrapper) {
      clientsWrapper.innerHTML = '';
      clients.clients.forEach((c) => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        const img = document.createElement('img');
        img.src = c.logo;
        img.alt = c.name;
        img.style.maxWidth = '160px';
        slide.appendChild(img);
        clientsWrapper.appendChild(slide);
      });
    }
  }

});