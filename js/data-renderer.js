// Generic data renderer to populate stores, clients, events, blog and reviews
document.addEventListener('DOMContentLoaded', async () => {
  async function fetchJson(path) {
    try {
      const r = await fetch(path);
      return await r.json();
    } catch (err) {
      console.warn('Failed to load', path, err);
      return null;
    }
  }

  // Populate stores
  const storesData = await fetchJson('./json/stores.json') || await fetchJson('/json/stores.json');
  if (storesData && storesData.floors) {
    window.storesDataGlobal = storesData;
    const list = document.getElementById('store-list');
    const searchInput = document.getElementById('directory-search');
    let currentCategory = 'all';
    let activeFloor = 'Ground Floor';
    
    // Check if floor switcher exists
    const floorLayers = document.querySelectorAll('.floor-layer');
    const hasFloorSwitcher = floorLayers.length > 0;
    
    function renderDirectory(searchQuery = '', activeCategory = 'all') {
      if (!list) return;
      list.innerHTML = '';
      
      storesData.floors.forEach((floor) => {
        // If we have floor switcher, skip floors that are not active
        if (hasFloorSwitcher && floor.name !== activeFloor) return;
        
        // Filter shops on this floor
        const filteredShops = floor.shops.filter(s => {
          const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                                (s.room && s.room.toLowerCase().includes(searchQuery.toLowerCase()));
          const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
          return matchesSearch && matchesCategory;
        });
        
        // Skip floor if it has no shops matching the filters
        if (filteredShops.length === 0) return;
        
        // On stores directory page, we don't need the floor heading inside the grid if it's only one floor
        if (!hasFloorSwitcher) {
          const colHeading = document.createElement('div');
          colHeading.style.gridColumn = '1 / -1';
          colHeading.style.marginTop = '24px';
          colHeading.innerHTML = `<h3 style="font-size: 20px; font-weight: 800; font-family: var(--font-headings); color: var(--navy); margin-bottom: 8px;">${floor.name}</h3>`;
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
          card.style.cursor = 'none';
          
          card.innerHTML = `
            <img src="${s.logo || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png'}" alt="${s.name}" class="store-card-logo" style="width:40px; height:40px; border-radius:8px; object-fit:contain; background:white; border:1px solid rgba(15,15,15,0.05); padding:2px;">
            <div class="store-card-info" style="display:flex; flex-direction:column; gap:2px; text-align:left; flex:1;">
              <span style="font-size:10px; color:var(--coral); font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">${s.room}</span>
              <strong style="font-size:14px; font-weight:700; color:var(--navy);">${s.name}</strong>
            </div>
          `;
          
          card.addEventListener('click', () => {
            if (typeof openShopModal === 'function') {
              openShopModal(s.name);
            }
          });
          
          list.appendChild(card);
        });
      });
      
      // If list is empty, show a nice no results message
      if (list.children.length === 0) {
        list.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:48px; color:var(--ink-soft);">
            <h3 style="font-size:18px; font-weight:700; color:var(--ink);">No matching shops found</h3>
            <p style="font-size:14px; margin-top:8px;">Try searching for a different name or checking another category.</p>
          </div>
        `;
      } else {
        // Animate the cards entrance using GSAP!
        const cards = list.querySelectorAll('.store-card');
        gsap.fromTo(cards, 
          { opacity: 0, y: 15 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "power2.out" }
        );
      }
    }
    
    // Hook up floor switcher layer click events
    if (hasFloorSwitcher) {
      floorLayers.forEach(layer => {
        layer.addEventListener('click', () => {
          floorLayers.forEach(l => l.classList.remove('active'));
          layer.classList.add('active');
          activeFloor = layer.getAttribute('data-floor');
          
          const badge = document.getElementById('active-floor-badge');
          if (badge) badge.textContent = `Current Floor: ${activeFloor}`;
          
          // GSAP layer push animation feedback
          gsap.fromTo(layer.querySelector('.floor-layer-plate'), 
            { scale: 0.95 },
            { scale: 1, duration: 0.3, ease: "back.out(1.5)" }
          );
          
          const q = searchInput ? searchInput.value : '';
          renderDirectory(q, currentCategory);
        });
      });
      
      // Initialize active floor to whatever is marked active
      const activeLayer = document.querySelector('.floor-layer.active');
      if (activeLayer) activeFloor = activeLayer.getAttribute('data-floor');
    }
    
    // Initial render
    renderDirectory();
    
    // Hook up search listener
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderDirectory(e.target.value, currentCategory);
      });
    }
    
    // Hook up filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category');
        const q = searchInput ? searchInput.value : '';
        renderDirectory(q, currentCategory);
      });
    });
  }

  // Populate clients carousel
  const clients = await fetchJson('/json/clients.json');
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

  // Populate events
  const events = await fetchJson('/json/events.json');
  if (events && (events.upcoming || events.past)) {
    const up = document.getElementById('events-upcoming');
    if (up && events.upcoming) {
      up.innerHTML = events.upcoming
        .map(e => `<article class="event"><h3>${e.title}</h3><time>${e.date}</time><p>${e.summary || ''}</p></article>`)
        .join('');
    }
    const past = document.getElementById('events-past');
    if (past && events.past) {
      past.innerHTML = events.past
        .map(e => `<div class="past"><strong>${e.title}</strong> <span>${e.date}</span></div>`).join('');
    }
  }

  // Populate blog
  const blog = await fetchJson('/json/blog.json');
  if (blog && blog.posts) {
    const blogList = document.getElementById('blog-list');
    if (blogList) {
      blogList.innerHTML = blog.posts.map(p => `
        <article class="post glow-card" style="padding:28px; background:rgba(255,255,255,0.4); display:flex; flex-direction:column; gap:12px; align-items:start;">
          <small style="color:var(--yellow-deep); font-weight:700; text-transform:uppercase; letter-spacing:0.05em; font-size:11px;">${p.date}</small>
          <h3 style="margin:0; font-size:20px; font-family:'Plus Jakarta Sans',sans-serif; font-weight:700; color:var(--ink);">${p.title}</h3>
          <p style="margin:0; font-size:14px; line-height:1.6; color:var(--ink-soft);">${p.excerpt}</p>
          <a href="./blog.html#read-${p.slug}" onclick="alert('Viewing Blog Article: \\n\\n' + this.previousElementSibling.textContent)" class="cta-btn" style="margin-top:8px; cursor:none;">Read Article <span class="cta-arrow">→</span></a>
        </article>
      `).join('');
    }
  }

  // Populate reviews / testimonials
  const reviews = await fetchJson('/json/reviews.json');
  if (reviews) {
    const testWrap = document.querySelector('.testimonials-swiper .swiper-wrapper');
    if (testWrap && reviews.testimonials) {
      testWrap.innerHTML = reviews.testimonials.map(t => `<div class="swiper-slide"><blockquote>"${t.quote}"</blockquote><div class="quote-author">${t.author} — ${'★'.repeat(t.rating)}</div></div>`).join('');
    }
    const feedback = document.getElementById('customer-feedback');
    if (feedback && reviews.customerFeedback) {
      feedback.innerHTML = reviews.customerFeedback.map(f => `
        <div class="feedback glow-card" style="padding:20px 24px; background:rgba(255,255,255,0.45); display:flex; flex-direction:column; gap:6px;">
          <strong style="font-size:14px; color:var(--ink);">${f.name}</strong>
          <p style="margin:0; font-size:13px; line-height:1.5; color:var(--ink-soft);">${f.comment}</p>
        </div>
      `).join('');
    }
  }

  // Re-init Swiper if present
  if (typeof Swiper !== 'undefined' && document.querySelector('.clients-swiper')) {
    // let carousel-init handle creation; but re-trigger by dispatching DOMContentLoaded? already run
  }

});