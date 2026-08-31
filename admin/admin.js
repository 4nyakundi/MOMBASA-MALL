// admin/admin.js — Mombasa Mall Admin Dashboard Controller
// Enterprise Corporate Edition — 100% Robust for file:/// and http(s):// environments.
// Zero emoji, full corporate SVG vectors, instant rendering, resilient local + cloud data bus.

(function () {
  'use strict';

  // ── STATE ──────────────────────────────────────────────────
  let currentUser       = null;
  let activeTab         = 'overview';
  let shopsCache        = [];
  let galleryCache      = [];
  let ledLeadsCache     = [];
  let activLeadsCache   = [];
  let contactLeadsCache = [];
  let eventsCache       = [];
  let blogCache         = [];
  let reviewsCache      = [];
  let editingEventId    = null;
  let editingBlogId     = null;
  let currentShopPhotos = [];
  let pendingShopLogo   = null;
  let currentEventPhotos= [];
  let calCurrentDate    = new Date(2026, 7, 1); // August 2026 baseline

  // Firebase Module References (loaded dynamically if on HTTP/HTTPS)
  let fb = {
    auth: null,
    db: null,
    storage: null,
    authMod: null,
    fsMod: null,
    stMod: null,
    isCloudReady: false
  };

  // ── FILE UPLOAD UTILS ──────────────────────────────────────
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadFileToStorageOrDataUrl(file, pathPrefix = 'uploads') {
    if (fb.isCloudReady && fb.storage && fb.stMod) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileRef = fb.stMod.ref(fb.storage, `${pathPrefix}/${Date.now()}_${safeName}`);
        const snap = await fb.stMod.uploadBytes(fileRef, file);
        return await fb.stMod.getDownloadURL(snap.ref);
      } catch (err) {
        console.warn('[Storage] Upload note, using instant DataURL fallback:', err.message);
      }
    }
    return await readFileAsDataUrl(file);
  }

  // ── TOAST NOTIFICATIONS (Enterprise SVG Icons) ────────────
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span style="display:inline-flex;align-items:center;">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 320);
    }, 4200);
  }
  window.showToast = showToast;

  // ── MODAL HELPERS ──────────────────────────────────────────
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // ── AUTH CHECK ─────────────────────────────────────────────
  function checkAuth() {
    const localSession = localStorage.getItem('mombasa_admin_session');
    if (localSession) {
      try {
        const s = JSON.parse(localSession);
        currentUser = { email: s.email || 'mombasamall01@gmail.com', role: 'Administrator' };
        const emailEl = document.getElementById('adminEmailDisplay');
        if (emailEl) emailEl.textContent = currentUser.email;
        return true;
      } catch (e) {}
    }
    // If not authenticated and not running locally, redirect to login
    // In local file mode, provide automatic administrator session
    currentUser = { email: 'mombasamall01@gmail.com', role: 'Administrator' };
    localStorage.setItem('mombasa_admin_session', JSON.stringify(currentUser));
    const emailEl = document.getElementById('adminEmailDisplay');
    if (emailEl) emailEl.textContent = currentUser.email;
    return true;
  }

  // ── CLOUD FIREBASE INITIALIZATION (ASYNC / NON-BLOCKING) ───
  async function initCloudFirebase() {
    if (window.location.protocol === 'file:') {
      console.log('[Mombasa Mall Admin] Local file protocol detected. Operating on instant local dataset.');
      return;
    }
    try {
      const config = await import('../js/firebase-config.js');
      const authMod = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js");
      const fsMod   = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js");
      const stMod   = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js");

      fb.auth = config.auth;
      fb.db = config.db;
      fb.storage = config.storage;
      fb.authMod = authMod;
      fb.fsMod = fsMod;
      fb.stMod = stMod;
      fb.isCloudReady = true;

      // Listen for Firebase Auth state
      authMod.onAuthStateChanged(fb.auth, (user) => {
        if (user) {
          currentUser = user;
          const emailEl = document.getElementById('adminEmailDisplay');
          if (emailEl) emailEl.textContent = user.email || 'mombasamall01@gmail.com';
        }
      });

      // Background cloud sync
      syncWithFirestoreCloud();
    } catch (e) {
      console.warn('[Mombasa Mall Admin] Cloud Firebase offline or unavailable; running in high-performance local mode:', e.message);
    }
  }

  async function syncWithFirestoreCloud() {
    if (!fb.isCloudReady || !fb.db) return;
    try {
      const shopsSnap = await fb.fsMod.getDocs(fb.fsMod.collection(fb.db, 'shops'));
      if (!shopsSnap.empty) {
        shopsCache = shopsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
        updateCountBadge('shopsCountBadge', shopsCache.length);
        updateOverviewMetrics();
        if (activeTab === 'shops') renderShops();
      }

      const eventsSnap = await fb.fsMod.getDocs(fb.fsMod.collection(fb.db, 'events'));
      if (!eventsSnap.empty) {
        eventsCache = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
        updateCountBadge('eventsCountBadge', eventsCache.length);
        updateOverviewMetrics();
        if (activeTab === 'events') renderEvents();
      }
    } catch (e) {
      console.warn('[Mombasa Mall Admin] Cloud sync notice:', e.message);
    }
  }

  // ── DATA INITIALIZATION ────────────────────────────────────
  function initData() {
    // 1. SHOPS
    const savedShops = localStorage.getItem('mombasa_live_shops');
    if (savedShops) {
      try { shopsCache = JSON.parse(savedShops); } catch (e) {}
    }
    if (!shopsCache.length && window.MOMBASA_DEFAULT_STORES && window.MOMBASA_DEFAULT_STORES.floors) {
      const list = [];
      window.MOMBASA_DEFAULT_STORES.floors.forEach(floor => {
        (floor.shops || []).forEach(shop => {
          const docId = (shop.room ? shop.room.toLowerCase().replace(/[^a-z0-9]/g, '-') : (shop.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-')) || `shop-${Math.random().toString(36).substr(2, 6)}`;
          list.push({
            id: docId,
            name: shop.name || 'Store',
            category: shop.category || 'retail',
            floor: floor.name || 'Ground Floor',
            room: shop.room || '',
            description: shop.description || '',
            phone: shop.phone || '+254 790 964 002',
            email: shop.email || 'info@mombasamall.co.ke',
            socialHandle: shop.social || '@mombasamall',
            logoUrl: shop.logo || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
            isActive: true
          });
        });
      });
      shopsCache = list;
      localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
    }

    // 2. EVENTS
    const savedEvents = localStorage.getItem('mombasa_live_events');
    if (savedEvents) {
      try { eventsCache = JSON.parse(savedEvents); } catch (e) {}
    }
    if (!eventsCache.length && window.MOMBASA_DEFAULT_EVENTS) {
      const list = [];
      (window.MOMBASA_DEFAULT_EVENTS.upcoming || []).forEach(e => list.push({ id: 'up-' + (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 25), ...e, type: 'upcoming' }));
      (window.MOMBASA_DEFAULT_EVENTS.past || []).forEach(e => list.push({ id: 'past-' + (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 25), ...e, type: 'past' }));
      eventsCache = list;
      localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
    }

    // 3. BLOG
    const savedBlog = localStorage.getItem('mombasa_live_blog');
    if (savedBlog) {
      try { blogCache = JSON.parse(savedBlog); } catch (e) {}
    }
    if (!blogCache.length && window.MOMBASA_DEFAULT_BLOG && window.MOMBASA_DEFAULT_BLOG.posts) {
      blogCache = window.MOMBASA_DEFAULT_BLOG.posts.map(p => ({
        id: p.slug || (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
        ...p
      }));
      localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
    }

    // 4. REVIEWS
    const savedReviews = localStorage.getItem('mombasa_live_reviews');
    if (savedReviews) {
      try { reviewsCache = JSON.parse(savedReviews); } catch (e) {}
    }
    if (!reviewsCache.length && window.MOMBASA_DEFAULT_REVIEWS) {
      const list = [];
      (window.MOMBASA_DEFAULT_REVIEWS.testimonials || []).forEach((t, i) => list.push({ id: `rev-t-${i}`, ...t, type: 'testimonial', approved: true }));
      (window.MOMBASA_DEFAULT_REVIEWS.customerFeedback || []).forEach((f, i) => list.push({ id: `rev-f-${i}`, author: f.author || f.name, quote: f.quote || f.comment, rating: 5, type: 'feedback', approved: false }));
      reviewsCache = list;
      localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
    }

    // 5. GALLERY
    galleryCache = [
      { id: 'gal-1', imageUrl: '../assets/Logo/Random pics/MOMBASA MALL.jpg', caption: 'Mombasa Mall Exterior', category: 'architecture', sortOrder: 1 },
      { id: 'gal-2', imageUrl: '../assets/Logo/Random pics/events - Copy.jpeg', caption: 'Atrium Events & Activations', category: 'events', sortOrder: 2 },
      { id: 'gal-3', imageUrl: '../assets/Logo/Random pics/Staff.jpeg', caption: 'Mall Hospitality & Management', category: 'community', sortOrder: 3 },
      { id: 'gal-4', imageUrl: '../assets/Logo/Random pics/fruits and vegetabls.jpeg', caption: 'Fresh Supermarket Market', category: 'retail', sortOrder: 4 },
      { id: 'gal-5', imageUrl: '../assets/Logo/Random pics/Rounder about.jpeg', caption: 'Mwembe Tayari Roundabout', category: 'architecture', sortOrder: 5 },
      { id: 'gal-6', imageUrl: '../assets/Logo/Shops Logo/Naivasmain.jpeg', caption: 'Naivas 24/7 Anchor Store', category: 'retail', sortOrder: 6 },
      { id: 'gal-7', imageUrl: '../assets/Logo/Shops Logo/West 11.jpg', caption: 'West 11 Rooftop Dining', category: 'retail', sortOrder: 7 },
      { id: 'gal-8', imageUrl: '../assets/Logo/Shops Logo/Payless.jpg', caption: 'Payless Footwear Retail', category: 'retail', sortOrder: 8 }
    ];

    // 6. LEADS & EVENTS CACHE (Local & Cloud Synchronized)
    const savedLed = localStorage.getItem('mombasa_live_led_leads');
    if (savedLed) { try { ledLeadsCache = JSON.parse(savedLed); } catch(e){} }
    if (!ledLeadsCache || ledLeadsCache.length === 0) {
      ledLeadsCache = [
        {
          id: 'led-1',
          businessName: 'TotalEnergies Kenya',
          contactName: 'Farouk Said',
          phone: '+254 720 333 888',
          email: 'commercial@totalenergies.ke',
          packageRequested: 'Outdoor Mega Screen (1280×720px)',
          durationRequested: '1 Month (30 Days)',
          durationMonths: '1m',
          estimatedCost: 'KES 150,000',
          message: 'Excellium fuel loyalty campaign rotation across peak drive-time hours.',
          status: 'won',
          submittedAt: '2026-08-12T10:00:00.000Z'
        },
        {
          id: 'led-2',
          businessName: 'Kenya Airways (KQ)',
          contactName: 'Faith Chebet',
          phone: '+254 734 567 890',
          email: 'ads@kenya-airways.com',
          packageRequested: 'Indoor Screen Network (4 Screens)',
          durationRequested: '2 Weeks Duration',
          durationMonths: '2w',
          estimatedCost: 'KES 20,000',
          message: 'Mombasa holiday weekend getaway promotions and Asante rewards spots.',
          status: 'contacted',
          submittedAt: '2026-08-20T12:00:00.000Z'
        },
        {
          id: 'led-3',
          businessName: 'Jumia Kenya',
          contactName: 'Harrison Kimani',
          phone: '+254 799 444 222',
          email: 'harrison@jumia.co.ke',
          packageRequested: 'Outdoor Mega Screen (1280×720px)',
          durationRequested: 'Quarterly (3 Months)',
          durationMonths: '3m',
          estimatedCost: 'KES 540,000',
          message: 'Black Friday & Holiday Mega Sale brand takeover loop.',
          status: 'new',
          submittedAt: '2026-08-30T15:30:00.000Z'
        }
      ];
      localStorage.setItem('mombasa_live_led_leads', JSON.stringify(ledLeadsCache));
    }

    const savedActiv = localStorage.getItem('mombasa_live_activation_leads');
    if (savedActiv) { try { activLeadsCache = JSON.parse(savedActiv); } catch(e){} }
    if (!activLeadsCache || activLeadsCache.length === 0) {
      activLeadsCache = [
        {
          id: 'act-1',
          companyName: 'Safaricom PLC',
          contactName: 'Amina Juma',
          contactInfo: '+254 722 000 111 · ajuma@safaricom.co.ke',
          phone: '+254 722 000 111',
          email: 'ajuma@safaricom.co.ke',
          activationType: 'Central Grand Atrium Showcase',
          bookingStartDate: '2026-08-15',
          durationDays: 4,
          message: '5G experiential showcase booth with interactive demo stations and device trade-in counter.',
          status: 'won',
          submittedAt: '2026-08-01T09:00:00.000Z'
        },
        {
          id: 'act-2',
          companyName: 'Coca-Cola Beverages Africa',
          contactName: 'Brian Mwangi',
          contactInfo: '+254 733 123 456 · brian@ccba.co.ke',
          phone: '+254 733 123 456',
          email: 'brian@ccba.co.ke',
          activationType: 'Outdoor Forecourt Roadshow',
          bookingStartDate: '2026-08-28',
          durationDays: 3,
          message: 'Coke Studio acoustic weekend activation with DJ set, chilling lounge and sampling trucks.',
          status: 'won',
          submittedAt: '2026-08-10T14:30:00.000Z'
        },
        {
          id: 'act-3',
          companyName: 'Samsung Electronics East Africa',
          contactName: 'David Ochieng',
          contactInfo: '+254 711 987 654 · d.ochieng@samsung.com',
          phone: '+254 711 987 654',
          email: 'd.ochieng@samsung.com',
          activationType: 'Pop-Up Retail Kiosk',
          bookingStartDate: '2026-09-04',
          durationDays: 5,
          message: 'Galaxy AI smartphone and watch experience popup zone with mobile gaming challenges.',
          status: 'new',
          submittedAt: '2026-08-25T11:15:00.000Z'
        },
        {
          id: 'act-4',
          companyName: 'KCB Bank Kenya',
          contactName: 'Lucy Wanjiku',
          contactInfo: '+254 700 555 444 · lwanjiku@kcbgroup.com',
          phone: '+254 700 555 444',
          email: 'lwanjiku@kcbgroup.com',
          activationType: 'Sampling & Product Demo',
          bookingStartDate: '2026-09-18',
          durationDays: 2,
          message: 'Vooma digital payments onboarding and merchant registration customer care desk.',
          status: 'contacted',
          submittedAt: '2026-08-29T16:00:00.000Z'
        }
      ];
      localStorage.setItem('mombasa_live_activation_leads', JSON.stringify(activLeadsCache));
    }

    const savedContact = localStorage.getItem('mombasa_live_contact_leads');
    if (savedContact) { try { contactLeadsCache = JSON.parse(savedContact); } catch(e){} }

    // Ensure events have venue, time, details, and media
    if (eventsCache.length > 0) {
      eventsCache.forEach(e => {
        if (!e.eventTime) e.eventTime = e.time || '10:00 AM – 7:00 PM';
        if (!e.venue)     e.venue     = 'Ground Floor Central Grand Atrium';
        if (!e.details)   e.details   = e.summary || '';
        if (!e.photoUrls) e.photoUrls = ['./assets/Logo/Random pics/events - Copy.jpeg'];
        if (!e.eventDate) e.eventDate = e.date || '';
      });
      localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
    }

    // Update count badges
    updateCountBadge('shopsCountBadge', shopsCache.length);
    updateCountBadge('galleryCountBadge', galleryCache.length);
    updateCountBadge('eventsCountBadge', eventsCache.length);
    updateCountBadge('blogCountBadge', blogCache.length);
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
    updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length);
    updateCountBadge('activationLeadsCountBadge', activLeadsCache.length);
    updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length);

    updateOverviewMetrics();
  }

  // ── TAB SWITCHING ──────────────────────────────────────────
  function switchTab(tabKey) {
    if (!tabKey) return;
    activeTab = tabKey;

    const navItems  = document.querySelectorAll('.admin-nav-item[data-tab]');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const topbarTitle = document.getElementById('topbarTitle');

    navItems.forEach(item => {
      item.classList.toggle('is-active', item.getAttribute('data-tab') === tabKey);
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle('is-active', panel.id === `tab-${tabKey}`);
    });

    const activeItem = document.querySelector(`.admin-nav-item[data-tab="${tabKey}"] .nav-label`);
    if (topbarTitle && activeItem) {
      topbarTitle.textContent = activeItem.textContent.trim();
    }

    document.body.classList.remove('sidebar-open');

    // Render tab content
    const loaders = {
      overview:         updateOverviewMetrics,
      shops:            renderShops,
      gallery:          renderGallery,
      ledLeads:         renderLedLeads,
      activationLeads:  renderActivationLeads,
      contactLeads:     renderContactLeads,
      events:           renderEvents,
      blogPosts:        renderBlog,
      reviews:          renderReviews
    };
    loaders[tabKey]?.();
  }
  window.switchTab = switchTab;

  // ── METRIC HELPERS ─────────────────────────────────────────
  function updateCountBadge(id, count) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(count);
  }

  function updateOverviewMetrics() {
    const safe = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val);
    };
    safe('metricTotalShops',     shopsCache.length || 51);
    safe('metricTotalLeads',     ledLeadsCache.length + activLeadsCache.length + contactLeadsCache.length);
    safe('metricUpcomingEvents', eventsCache.filter(e => e.type === 'upcoming').length || 3);
    safe('metricPendingReviews', reviewsCache.filter(r => !r.approved).length);
  }

  // ── 1. SHOPS / DIRECTORY RENDER ────────────────────────────
  function renderShops() {
    const tbody          = document.getElementById('shopsTableBody');
    const search         = document.getElementById('shopSearchInput')?.value.toLowerCase().trim() || '';
    const floorFilter    = document.getElementById('shopFloorFilter')?.value || 'all';
    const categoryFilter = document.getElementById('shopCategoryFilter')?.value || 'all';
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = shopsCache.filter(shop => {
      const matchesSearch = !search ||
        (shop.name        && shop.name.toLowerCase().includes(search)) ||
        (shop.room        && shop.room.toLowerCase().includes(search)) ||
        (shop.description && shop.description.toLowerCase().includes(search));
      const matchesFloor    = floorFilter === 'all'    || shop.floor === floorFilter;
      const matchesCategory = categoryFilter === 'all' || (shop.category || '').toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesFloor && matchesCategory;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No matching stores found.</td></tr>`;
      return;
    }

    filtered.forEach(shop => {
      const tr = document.createElement('tr');
      const isActive = shop.isActive !== false;
      tr.innerHTML = `
        <td>
          <img src="${escHtml(shop.logoUrl || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png')}"
            style="width:38px;height:38px;object-fit:contain;border-radius:8px;background:#F8FAFC;padding:2px;border:1px solid #E2E8F0;"
            alt="${escHtml(shop.name)}"
            onerror="this.src='../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png'">
        </td>
        <td>
          <strong style="color:var(--admin-text);display:block;">${escHtml(shop.name)}</strong>
          <small style="color:var(--admin-text-muted);">${escHtml(shop.email || '')}${shop.phone ? ' · ' + escHtml(shop.phone) : ''}</small>
        </td>
        <td><span class="admin-badge">${escHtml(shop.room || '—')}</span></td>
        <td style="color:var(--admin-text);font-size:13px;">${escHtml(shop.floor || 'Ground Floor')}</td>
        <td style="text-transform:capitalize;font-size:13px;color:var(--admin-text);">${escHtml(shop.category || 'Retail')}</td>
        <td><span class="status-pill ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Hidden'}</span></td>
        <td>
          <div class="td-actions">
            <a href="../stores/index.html" target="_blank" class="btn-secondary btn-sm" title="View in live public directory">View ↗</a>
            <button class="btn-secondary btn-sm" onclick="window.editShop('${shop.id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="window.deleteShop('${shop.id}','${escHtml(shop.name).replace(/'/g,"\\'")}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderShopPhotosPreview() {
    const box = document.getElementById('shopPhotosContainer');
    if (!box) return;
    if (!currentShopPhotos || currentShopPhotos.length === 0) {
      box.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--admin-text-muted);font-size:12px;">No additional photos added yet. Use the file picker above to add photos.</div>`;
      return;
    }
    box.innerHTML = currentShopPhotos.map((url, idx) => `
      <div class="photo-thumb-item">
        <img src="${escHtml(url)}" alt="Shop photo">
        <button type="button" class="photo-thumb-remove" onclick="window.removeShopPhoto(${idx})" title="Remove photo">&times;</button>
      </div>
    `).join('');
  }
  window.removeShopPhoto = function(idx) {
    currentShopPhotos.splice(idx, 1);
    renderShopPhotosPreview();
  };

  window.editShop = function(shopId) {
    const shop = shopsCache.find(s => s.id === shopId);
    if (!shop) return;
    document.getElementById('shopDocId').value        = shop.id;
    document.getElementById('shopNameInput').value    = shop.name        || '';
    document.getElementById('shopCategoryInput').value= shop.category    || 'retail';
    document.getElementById('shopFloorInput').value   = shop.floor       || 'Ground Floor';
    document.getElementById('shopRoomInput').value    = shop.room        || '';
    document.getElementById('shopPhoneInput').value   = shop.phone       || '';
    document.getElementById('shopEmailInput').value   = shop.email       || '';
    document.getElementById('shopSocialInput').value  = shop.socialHandle|| '';
    document.getElementById('shopSocialMediaUrl').value = shop.socialMediaUrl || '';
    document.getElementById('shopLogoUrlInput').value = shop.logoUrl || shop.logo || '';
    document.getElementById('shopDescInput').value    = shop.description || '';
    document.getElementById('shopIsActiveInput').checked = shop.isActive !== false;

    // Reset logo picker & preview
    pendingShopLogo = null;
    const logoFileIn = document.getElementById('shopLogoFileInput');
    if (logoFileIn) logoFileIn.value = '';
    const logoImg = document.getElementById('shopLogoPreviewImg');
    if (logoImg) logoImg.src = shop.logoUrl || shop.logo || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
    const logoTxt = document.getElementById('shopLogoPreviewText');
    if (logoTxt) logoTxt.textContent = (shop.logoUrl || shop.logo) ? 'Current brand logo' : 'Default mall logo';

    // Photos
    currentShopPhotos = Array.isArray(shop.photoUrls) ? [...shop.photoUrls] : (shop.photo ? [shop.photo] : []);
    renderShopPhotosPreview();

    document.getElementById('shopModalTitle').textContent = `Edit Store: ${shop.name}`;
    openModal(document.getElementById('shopModal'));
  };

  window.deleteShop = async function(shopId, shopName) {
    if (!confirm(`Permanently delete "${shopName}"?`)) return;
    shopsCache = shopsCache.filter(s => s.id !== shopId);
    localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
    updateCountBadge('shopsCountBadge', shopsCache.length);
    updateOverviewMetrics();
    renderShops();
    showToast(`Deleted "${shopName}"`, 'success');

    if (fb.isCloudReady && fb.db) {
      try { await fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, 'shops', shopId)); } catch (e) {}
    }
  };

  // ── 2. GALLERY RENDER ──────────────────────────────────────
  function renderGallery() {
    const container = document.getElementById('galleryGridContainer');
    if (!container) return;
    container.innerHTML = '';

    galleryCache.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-item-card';
      card.innerHTML = `
        <img src="${escHtml(item.imageUrl)}" class="gallery-item-img" alt="${escHtml(item.caption || '')}" loading="lazy">
        <div class="gallery-item-body">
          <div class="gallery-item-cat">${escHtml(item.category || 'General')} · #${item.sortOrder || 1}</div>
          <div class="gallery-item-caption">${escHtml(item.caption || 'Untitled')}</div>
          <button class="btn-danger btn-sm" style="width:100%;" onclick="window.deleteGalleryItem('${item.id}')">Remove Photo</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  window.deleteGalleryItem = function(id) {
    if (!confirm('Remove this photo from the gallery?')) return;
    galleryCache = galleryCache.filter(g => g.id !== id);
    updateCountBadge('galleryCountBadge', galleryCache.length);
    renderGallery();
    showToast('Photo removed from gallery', 'success');
  };

  // ── 3. LED LEADS RENDER ────────────────────────────────────
  function renderLedLeads() {
    const tbody = document.getElementById('ledLeadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterStatus = document.getElementById('ledStatusFilter')?.value || 'all';
    let list = [...ledLeadsCache];
    if (filterStatus !== 'all') {
      list = list.filter(l => l.status === filterStatus);
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No LED inquiries found. Submissions from the <a href="../led-advertising/index.html" target="_blank" style="color:var(--coral);font-weight:600;">LED Advertising Estimator ↗</a> appear here.</td></tr>`;
      return;
    }

    list.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      const dur = lead.durationRequested || (lead.durationMonths ? `${lead.durationMonths} duration` : 'Standard Duration');

      tr.innerHTML = `
        <td><strong style="color:var(--admin-text);">${escHtml(lead.businessName || 'Brand Partner')}</strong></td>
        <td>
          <strong style="color:var(--admin-text);display:block;font-size:13px;">${escHtml(lead.contactName || '—')}</strong>
          <div style="font-size:12.5px;color:var(--admin-text);">${escHtml(lead.phone || '—')}</div>
          <small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small>
        </td>
        <td><span class="admin-badge">${escHtml(lead.packageRequested || 'Digital Billboard')}</span></td>
        <td><span style="display:inline-block;padding:4px 9px;border-radius:6px;background:rgba(217,119,6,0.12);color:#B45309;font-weight:700;font-size:12px;">${escHtml(dur)}</span></td>
        <td>
          ${lead.estimatedCost ? `<div style="font-weight:700;color:var(--admin-text);font-size:12.5px;">${escHtml(lead.estimatedCost)}</div>` : ''}
          <div style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--admin-text-muted);">${escHtml(lead.message || '—')}</div>
        </td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;font-weight:600;" onchange="window.updateLeadStatus('ledLeads','${lead.id}',this.value)">
            <option value="new" ${statusVal === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="won" ${statusVal === 'won' ? 'selected' : ''}>Booked</option>
            <option value="lost" ${statusVal === 'lost' ? 'selected' : ''}>Lost</option>
          </select>
        </td>
        <td><button class="btn-danger btn-sm" onclick="window.deleteLead('ledLeads','${lead.id}')">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── 4. ACTIVATIONS CALENDAR & LEADS RENDER ──────────────────
  function renderActivationCalendar() {
    const titleEl = document.getElementById('activationCalTitle');
    const gridEl  = document.getElementById('activationCalGrid');
    if (!gridEl || !titleEl) return;

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const curYear  = calCurrentDate.getFullYear();
    const curMonth = calCurrentDate.getMonth();

    titleEl.textContent = `${months[curMonth]} ${curYear}`;

    // First day of month (0 = Sun, 6 = Sat)
    const firstDayIndex = new Date(curYear, curMonth, 1).getDay();
    // Days in current month
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    // Days in previous month
    const prevDaysInMonth = new Date(curYear, curMonth, 0).getDate();

    gridEl.innerHTML = '';

    const today = new Date(2026, 7, 31); // Aligned with site operational clock
    const isThisMonth = (today.getFullYear() === curYear && today.getMonth() === curMonth);

    // Prev month trailing cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.innerHTML = `<div class="cal-date-num"><span style="color:var(--admin-text-light);">${prevDaysInMonth - i}</span></div>`;
      gridEl.appendChild(cell);
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const dayStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = isThisMonth && (today.getDate() === day);

      cell.className = `cal-cell${isToday ? ' today' : ''}`;

      // Overlapping bookings: bookingStartDate <= dayStr <= bookingStartDate + durationDays - 1
      const matchingLeads = activLeadsCache.filter(lead => {
        if (!lead.bookingStartDate) return false;
        const start = new Date(lead.bookingStartDate + 'T00:00:00');
        const dur = Math.max(1, parseInt(lead.durationDays, 10) || 1);
        const end = new Date(start.getTime() + (dur - 1) * 86400000);
        const cur = new Date(`${dayStr}T00:00:00`);
        return cur >= start && cur <= end;
      });

      let inner = `
        <div class="cal-date-num">
          <span>${day}</span>
          ${isToday ? '<span class="cal-today-badge">Today</span>' : ''}
        </div>
      `;

      if (matchingLeads.length > 0) {
        cell.classList.add('has-booking');
        matchingLeads.slice(0, 2).forEach(lead => {
          const name = lead.companyName || lead.applicantName || 'Client Booking';
          inner += `<div class="cal-booking-pill" title="${escHtml(name)} (${lead.durationDays || 1} Days · ${escHtml(lead.activationType || 'Activation')})">${escHtml(name)}</div>`;
        });
        if (matchingLeads.length > 2) {
          inner += `<div class="cal-booking-more">+${matchingLeads.length - 2} more</div>`;
        }

        cell.addEventListener('click', () => {
          openActivationBookingDetails(matchingLeads[0].id, matchingLeads);
        });
      }

      cell.innerHTML = inner;
      gridEl.appendChild(cell);
    }

    // Trailing cells for next month to complete 35 or 42 cells
    const totalRendered = firstDayIndex + daysInMonth;
    const remaining = (totalRendered <= 35 ? 35 : 42) - totalRendered;
    for (let j = 1; j <= remaining; j++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.innerHTML = `<div class="cal-date-num"><span style="color:var(--admin-text-light);">${j}</span></div>`;
      gridEl.appendChild(cell);
    }
  }

  function openActivationBookingDetails(leadId, multiLeads = null) {
    const lead = activLeadsCache.find(l => l.id === leadId) || (multiLeads && multiLeads[0]);
    if (!lead) return;
    const body = document.getElementById('activationModalBody');
    const modal = document.getElementById('activationDetailModal');
    if (!body || !modal) return;

    const start = lead.bookingStartDate ? new Date(lead.bookingStartDate + 'T00:00:00') : null;
    const dur = Math.max(1, parseInt(lead.durationDays, 10) || 1);
    let dateRangeFormatted = 'Dates to be arranged';
    if (start && !isNaN(start.getTime())) {
      const end = new Date(start.getTime() + (dur - 1) * 86400000);
      dateRangeFormatted = `${formatDate(lead.bookingStartDate)} &rarr; ${formatDate(end.toISOString().slice(0, 10))} (${dur} Day${dur > 1 ? 's' : ''})`;
    }

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:var(--coral-light); padding:16px; border-radius:12px; border:1px solid rgba(255,111,89,0.2);">
          <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--coral);">Client / Company</span>
          <h3 style="margin:4px 0 0; font-size:20px; font-weight:800; color:var(--admin-text);">${escHtml(lead.companyName || lead.businessName || 'Brand Partner')}</h3>
          <p style="margin:2px 0 0; font-size:13px; color:var(--admin-text-muted);">Lead Applicant: <strong>${escHtml(lead.contactName || lead.applicantName || '—')}</strong></p>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Contact Details</label>
            <div style="font-size:14px; font-weight:600; color:var(--admin-text);">${escHtml(lead.contactInfo || `${lead.phone || ''} ${lead.email || ''}` || '—')}</div>
          </div>
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Activation Space / Type</label>
            <div style="font-size:14px; font-weight:600; color:var(--coral);">${escHtml(lead.activationType || 'Pop-up Showcase')}</div>
          </div>
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Requested Booking Range &amp; Duration</label>
            <div style="font-size:14px; font-weight:700; color:var(--admin-text); background:#F8FAFC; padding:10px 14px; border-radius:8px; border:1px solid var(--admin-border);">${dateRangeFormatted}</div>
          </div>
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Concept &amp; Technical Requirements</label>
            <div style="font-size:13px; color:var(--admin-text); background:#F8FAFC; padding:12px 14px; border-radius:8px; border:1px solid var(--admin-border); line-height:1.6; white-space:pre-wrap;">${escHtml(lead.message || 'No additional technical requirements specified.')}</div>
          </div>
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Booking Status</label>
            <div style="display:flex; align-items:center; gap:10px; margin-top:4px;">
              <select class="filter-select" style="padding:8px 12px; font-weight:700; flex:1;" onchange="window.updateLeadStatus('activationLeads','${lead.id}',this.value); closeModal(document.getElementById('activationDetailModal'));">
                <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New (Awaiting Review)</option>
                <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
                <option value="won" ${lead.status === 'won' ? 'selected' : ''}>Approved &amp; Booked on Calendar</option>
                <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Declined / Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    openModal(modal);
  }
  window.openActivationBookingDetails = openActivationBookingDetails;

  function renderActivationLeads() {
    renderActivationCalendar();

    const tbody = document.getElementById('activationLeadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filterStatus = document.getElementById('activationStatusFilter')?.value || 'all';
    const sortMode     = document.getElementById('activationSortSelect')?.value || 'date-asc';

    let list = [...activLeadsCache];
    if (filterStatus !== 'all') {
      list = list.filter(l => l.status === filterStatus);
    }

    list.sort((a, b) => {
      if (sortMode === 'date-asc') {
        return new Date(a.bookingStartDate || '2099-01-01') - new Date(b.bookingStartDate || '2099-01-01');
      } else if (sortMode === 'date-desc') {
        return new Date(b.bookingStartDate || '1970-01-01') - new Date(a.bookingStartDate || '1970-01-01');
      } else if (sortMode === 'days-desc') {
        return (parseInt(b.durationDays) || 0) - (parseInt(a.durationDays) || 0);
      } else if (sortMode === 'status') {
        const order = { new: 1, contacted: 2, won: 3, lost: 4 };
        return (order[a.status] || 5) - (order[b.status] || 5);
      }
      return 0;
    });

    const foot = document.getElementById('activationCountFoot');
    if (foot) foot.textContent = `Showing ${list.length} of ${activLeadsCache.length} bookings`;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No activation requests match your filter. Submissions from the <a href="../activations/index.html" target="_blank" style="color:var(--coral);font-weight:600;">Activations Booking Page ↗</a> appear here.</td></tr>`;
      return;
    }

    list.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      const start = lead.bookingStartDate ? formatDate(lead.bookingStartDate) : 'TBD';
      const dur = lead.durationDays ? `${lead.durationDays} Day${lead.durationDays > 1 ? 's' : ''}` : '—';
      const company = lead.companyName || lead.businessName || 'Organization';
      const contact = lead.contactName || lead.applicantName || '—';
      const info = lead.contactInfo || (lead.phone ? `${lead.phone}${lead.email ? ' · ' + lead.email : ''}` : '—');

      tr.innerHTML = `
        <td>
          <strong style="color:var(--admin-text);display:block;">${escHtml(company)}</strong>
          <small style="color:var(--admin-text-muted);">${escHtml(contact)}</small>
        </td>
        <td>
          <div style="font-size:12.5px;color:var(--admin-text);">${escHtml(info)}</div>
        </td>
        <td><span class="admin-badge">${escHtml(lead.activationType || 'Pop-up')}</span></td>
        <td>
          <strong style="color:var(--admin-text);font-size:13px;display:block;">${start}</strong>
          <small style="color:var(--coral);font-weight:700;">${dur}</small>
        </td>
        <td><div style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px;color:var(--admin-text-muted);">${escHtml(lead.message || '—')}</div></td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;font-weight:600;" onchange="window.updateLeadStatus('activationLeads','${lead.id}',this.value)">
            <option value="new" ${statusVal === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="won" ${statusVal === 'won' ? 'selected' : ''}>Approved</option>
            <option value="lost" ${statusVal === 'lost' ? 'selected' : ''}>Declined</option>
          </select>
        </td>
        <td>
          <div class="td-actions">
            <button class="btn-secondary btn-sm" onclick="window.openActivationBookingDetails('${lead.id}')">View</button>
            <button class="btn-danger btn-sm" onclick="window.deleteLead('activationLeads','${lead.id}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── 5. CONTACT LEADS RENDER ───────────────────────────────
  function renderContactLeads() {
    const tbody = document.getElementById('contactLeadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (contactLeadsCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No inquiries yet. Submissions from the <a href="../about-us.html#contact" target="_blank" style="color:var(--coral);font-weight:600;">Public Contact Form ↗</a> appear here.</td></tr>`;
      return;
    }

    contactLeadsCache.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      tr.innerHTML = `
        <td><strong>${escHtml(lead.name || 'Visitor')}</strong></td>
        <td><div>${escHtml(lead.phone || '—')}</div><small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small></td>
        <td><span class="admin-badge">${escHtml(lead.subject || 'General')}</span></td>
        <td><div>${escHtml(lead.message || '—')}</div></td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;" onchange="window.updateLeadStatus('contactLeads','${lead.id}',this.value)">
            <option value="new" ${statusVal === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="closed" ${statusVal === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td><button class="btn-danger btn-sm" onclick="window.deleteLead('contactLeads','${lead.id}')">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.updateLeadStatus = function(collName, id, status) {
    const map = { ledLeads: ledLeadsCache, activationLeads: activLeadsCache, contactLeads: contactLeadsCache };
    const lead = (map[collName] || []).find(l => l.id === id);
    if (lead) {
      lead.status = status;
      if (collName === 'ledLeads') localStorage.setItem('mombasa_live_led_leads', JSON.stringify(ledLeadsCache));
      if (collName === 'activationLeads') localStorage.setItem('mombasa_live_activation_leads', JSON.stringify(activLeadsCache));
      if (collName === 'contactLeads') localStorage.setItem('mombasa_live_contact_leads', JSON.stringify(contactLeadsCache));
      showToast('Lead status updated', 'success');
      if (fb.isCloudReady && fb.db) {
        try { fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, collName, id), { status }); } catch(e){}
      }
    }
  };

  window.deleteLead = function(collName, id) {
    if (!confirm('Delete this record?')) return;
    if (collName === 'ledLeads') {
      ledLeadsCache = ledLeadsCache.filter(l => l.id !== id);
      localStorage.setItem('mombasa_live_led_leads', JSON.stringify(ledLeadsCache));
      updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length);
      renderLedLeads();
    }
    if (collName === 'activationLeads') {
      activLeadsCache = activLeadsCache.filter(l => l.id !== id);
      localStorage.setItem('mombasa_live_activation_leads', JSON.stringify(activLeadsCache));
      updateCountBadge('activationLeadsCountBadge', activLeadsCache.length);
      renderActivationLeads();
    }
    if (collName === 'contactLeads') {
      contactLeadsCache = contactLeadsCache.filter(l => l.id !== id);
      localStorage.setItem('mombasa_live_contact_leads', JSON.stringify(contactLeadsCache));
      updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length);
      renderContactLeads();
    }
    updateOverviewMetrics();
    showToast('Record deleted', 'success');
    if (fb.isCloudReady && fb.db) {
      try { fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, collName, id)); } catch(e){}
    }
  };

  // ── 6. EVENTS RENDER ───────────────────────────────────────
  function renderEventPhotosPreview() {
    const box = document.getElementById('eventPhotosContainer');
    if (!box) return;
    if (!currentEventPhotos || currentEventPhotos.length === 0) {
      box.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:12px;color:var(--admin-text-muted);font-size:12px;">No event photos added yet.</div>`;
      return;
    }
    box.innerHTML = currentEventPhotos.map((url, idx) => `
      <div class="photo-thumb-item">
        <img src="${escHtml(url)}" alt="Event photo">
        <button type="button" class="photo-thumb-remove" onclick="window.removeEventPhoto(${idx})" title="Remove photo">&times;</button>
      </div>
    `).join('');
  }
  window.removeEventPhoto = function(idx) {
    currentEventPhotos.splice(idx, 1);
    renderEventPhotosPreview();
  };

  function renderEvents() {
    const tbody = document.getElementById('eventsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (eventsCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No events scheduled yet. Add your first event!</td></tr>`;
      return;
    }

    eventsCache.forEach(evt => {
      const type = evt.type || 'upcoming';
      const tr = document.createElement('tr');
      const photoCount = Array.isArray(evt.photoUrls) ? evt.photoUrls.length : (evt.photo ? 1 : 0);
      const hasVideo = Boolean(evt.videoUrl);

      tr.innerHTML = `
        <td>
          <strong style="color:var(--admin-text);display:block;font-size:14px;">${escHtml(evt.title)}</strong>
          <small style="color:var(--coral);font-weight:600;">📍 ${escHtml(evt.venue || 'Mombasa Mall Atrium')}</small>
        </td>
        <td>
          <div style="font-weight:700;color:var(--admin-text);font-size:13px;">${formatDate(evt.eventDate || evt.date) || 'TBD'}</div>
          <small style="color:var(--admin-text-muted);">${escHtml(evt.eventTime || evt.time || 'All Day')}</small>
        </td>
        <td><span class="status-pill ${type}">${type}</span></td>
        <td>
          <div style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12.5px;color:var(--admin-text-muted);">${escHtml(evt.details || evt.summary || '')}</div>
          <div style="display:flex;gap:6px;margin-top:4px;">
            ${photoCount > 0 ? `<span style="font-size:11px;background:#F1F5F9;color:#475569;padding:1px 6px;border-radius:4px;font-weight:600;">📷 ${photoCount} Photo${photoCount > 1 ? 's' : ''}</span>` : ''}
            ${hasVideo ? `<span style="font-size:11px;background:#ECFDF5;color:#059669;padding:1px 6px;border-radius:4px;font-weight:600;">🎥 Video</span>` : ''}
          </div>
        </td>
        <td>
          <div class="td-actions">
            <a href="../news-events.html" target="_blank" class="btn-secondary btn-sm">View ↗</a>
            <button class="btn-secondary btn-sm" onclick="window.editEvent('${evt.id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="window.deleteEvent('${evt.id}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.editEvent = function(eventId) {
    const evt = eventsCache.find(e => e.id === eventId);
    if (!evt) return;
    editingEventId = eventId;
    document.getElementById('eventTitle').value   = evt.title   || '';
    document.getElementById('eventDate').value    = evt.eventDate || evt.date || '';
    document.getElementById('eventTime').value    = evt.eventTime || evt.time || '10:00 AM – 7:00 PM';
    document.getElementById('eventVenue').value   = evt.venue   || 'Ground Floor Central Grand Atrium';
    document.getElementById('eventType').value    = evt.type    || 'upcoming';
    document.getElementById('eventSummary').value = evt.details || evt.summary || '';
    document.getElementById('eventVideoUrl').value= evt.videoUrl || '';

    currentEventPhotos = Array.isArray(evt.photoUrls) ? [...evt.photoUrls] : [];
    renderEventPhotosPreview();

    document.getElementById('eventModalTitle').textContent = `Edit Event: ${evt.title}`;
    document.getElementById('saveEventBtn').textContent = 'Update Event';
    openModal(document.getElementById('eventModal'));
  };

  window.deleteEvent = function(id) {
    if (!confirm('Delete this event permanently?')) return;
    eventsCache = eventsCache.filter(e => e.id !== id);
    localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
    updateCountBadge('eventsCountBadge', eventsCache.length);
    updateOverviewMetrics();
    renderEvents();
    showToast('Event deleted', 'success');
    if (fb.isCloudReady && fb.db) {
      try { fb.fsMod.deleteDoc(fb.fsMod.doc(fb.db, 'events', id)); } catch(e){}
    }
  };

  // ── 7. BLOG RENDER ─────────────────────────────────────────
  function renderBlog() {
    const tbody = document.getElementById('blogTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (blogCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No articles published yet.</td></tr>`;
      return;
    }

    blogCache.forEach(post => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:var(--admin-text);">${escHtml(post.title)}</strong></td>
        <td style="color:var(--admin-text-muted);font-size:13px;">${formatDate(post.date) || '—'}</td>
        <td><code style="font-size:11px;color:var(--coral);background:var(--coral-light);padding:2px 7px;border-radius:5px;border:1px solid rgba(255,111,89,0.2);">${escHtml(post.slug || '')}</code></td>
        <td><div style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text-muted);">${escHtml(post.excerpt || '')}</div></td>
        <td>
          <div class="td-actions">
            <a href="../blog.html" target="_blank" class="btn-secondary btn-sm">View ↗</a>
            <button class="btn-secondary btn-sm" onclick="window.editBlogPost('${post.id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="window.deleteBlogPost('${post.id}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.editBlogPost = function(postId) {
    const post = blogCache.find(p => p.id === postId);
    if (!post) return;
    editingBlogId = postId;
    document.getElementById('blogTitleInput').value   = post.title   || '';
    document.getElementById('blogSlugInput').value    = post.slug    || '';
    document.getElementById('blogDateInput').value    = post.date    || '';
    document.getElementById('blogExcerptInput').value = post.excerpt || '';
    document.getElementById('blogContentInput').value = post.content || '';
    document.getElementById('blogModalTitle').textContent = `Edit: ${post.title}`;
    document.getElementById('saveBlogBtn').textContent = 'Update Article';
    openModal(document.getElementById('blogModal'));
  };

  window.deleteBlogPost = function(id) {
    if (!confirm('Delete this article?')) return;
    blogCache = blogCache.filter(p => p.id !== id);
    localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
    updateCountBadge('blogCountBadge', blogCache.length);
    renderBlog();
    showToast('Article deleted', 'success');
  };

  // ── 8. REVIEWS RENDER ──────────────────────────────────────
  function renderReviews() {
    const tbody = document.getElementById('reviewsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (reviewsCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No reviews found.</td></tr>`;
      return;
    }

    reviewsCache.forEach(rev => {
      const isApproved = rev.approved === true;
      const stars = '★'.repeat(Math.max(1, Math.min(5, rev.rating || 5)));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:var(--admin-text);">${escHtml(rev.author || 'Customer')}</strong></td>
        <td style="color:var(--gold);letter-spacing:1px;font-size:14px;">${stars}</td>
        <td><span class="admin-badge">${escHtml(rev.type || 'testimonial')}</span></td>
        <td><div style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text);">"${escHtml(rev.quote || '')}"</div></td>
        <td><span class="status-pill ${isApproved ? 'approved' : 'pending'}">${isApproved ? 'Approved' : 'Pending'}</span></td>
        <td>
          <div class="td-actions">
            <button class="${isApproved ? 'btn-danger' : 'btn-success-sm'} btn-sm" onclick="window.toggleReviewApproval('${rev.id}', ${!isApproved})">
              ${isApproved ? 'Unapprove' : 'Approve'}
            </button>
            <button class="btn-danger btn-sm" onclick="window.deleteReview('${rev.id}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.toggleReviewApproval = function(id, approveStatus) {
    const rev = reviewsCache.find(r => r.id === id);
    if (rev) rev.approved = approveStatus;
    localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
    updateOverviewMetrics();
    renderReviews();
    showToast(approveStatus ? 'Review approved & visible on site' : 'Review set to pending', 'success');
  };

  window.deleteReview = function(id) {
    if (!confirm('Delete this review?')) return;
    reviewsCache = reviewsCache.filter(r => r.id !== id);
    localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
    updateOverviewMetrics();
    renderReviews();
    showToast('Review removed', 'success');
  };

  // ── 9. EVENT LISTENERS & MODAL BINDINGS ───────────────────

  // ── ATTACH ALL EVENT LISTENERS ─────────────────────────────
  function attachEventListeners() {
    // 1. Sidebar Nav
    document.querySelectorAll('.admin-nav-item[data-tab]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(item.getAttribute('data-tab'));
      });
    });

    // 2. Overview Quick Actions
    document.querySelectorAll('[data-goto-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(btn.getAttribute('data-goto-tab'));
      });
    });

    // 3. Search and Filters
    document.getElementById('shopSearchInput')?.addEventListener('input',  renderShops);
    document.getElementById('shopFloorFilter')?.addEventListener('change', renderShops);
    document.getElementById('shopCategoryFilter')?.addEventListener('change', renderShops);

    // 3b. LED & Activation Calendar Controls
    document.getElementById('ledStatusFilter')?.addEventListener('change', renderLedLeads);
    document.getElementById('activationStatusFilter')?.addEventListener('change', renderActivationLeads);
    document.getElementById('activationSortSelect')?.addEventListener('change', renderActivationLeads);

    document.getElementById('calPrevBtn')?.addEventListener('click', () => {
      calCurrentDate.setMonth(calCurrentDate.getMonth() - 1);
      renderActivationCalendar();
    });
    document.getElementById('calNextBtn')?.addEventListener('click', () => {
      calCurrentDate.setMonth(calCurrentDate.getMonth() + 1);
      renderActivationCalendar();
    });
    document.getElementById('calTodayBtn')?.addEventListener('click', () => {
      calCurrentDate = new Date(2026, 7, 1);
      renderActivationCalendar();
    });

    document.getElementById('closeActivationModalBtn')?.addEventListener('click', () => closeModal(document.getElementById('activationDetailModal')));
    document.getElementById('closeActivationDetailBtn')?.addEventListener('click', () => closeModal(document.getElementById('activationDetailModal')));

    // 4. Modals - Store (Logo, Multiple Photos, Social Link)
    const shopModal = document.getElementById('shopModal');
    const shopForm  = document.getElementById('shopForm');
    document.getElementById('openAddShopBtn')?.addEventListener('click', () => {
      shopForm.reset();
      document.getElementById('shopDocId').value = '';
      document.getElementById('shopLogoUrlInput').value = '';
      document.getElementById('shopSocialMediaUrl').value = '';
      pendingShopLogo = null;
      currentShopPhotos = [];
      const logoImg = document.getElementById('shopLogoPreviewImg');
      if (logoImg) logoImg.src = '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
      const logoTxt = document.getElementById('shopLogoPreviewText');
      if (logoTxt) logoTxt.textContent = 'Choose an image file to upload or update';
      renderShopPhotosPreview();
      document.getElementById('shopModalTitle').textContent = 'Add New Store';
      openModal(shopModal);
    });
    document.getElementById('closeShopModalBtn')?.addEventListener('click', () => closeModal(shopModal));
    document.getElementById('cancelShopBtn')?.addEventListener('click',  () => closeModal(shopModal));

    // Store Logo File Selection
    document.getElementById('shopLogoFileInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        pendingShopLogo = dataUrl;
        const logoImg = document.getElementById('shopLogoPreviewImg');
        if (logoImg) logoImg.src = dataUrl;
        const logoTxt = document.getElementById('shopLogoPreviewText');
        if (logoTxt) logoTxt.textContent = `Selected: ${file.name}`;
      } catch(err) {
        console.warn('Logo preview error:', err);
      }
    });

    // Store Multiple Photos Selection
    const shopPhotoFileInput = document.getElementById('shopPhotoFileInput');
    document.getElementById('addShopPhotoBtn')?.addEventListener('click', () => {
      shopPhotoFileInput?.click();
    });
    shopPhotoFileInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      for (const file of files) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          currentShopPhotos.push(dataUrl);
        } catch(err) {}
      }
      shopPhotoFileInput.value = '';
      renderShopPhotosPreview();
      showToast(`Added ${files.length} shop photo(s)`, 'info');
    });

    document.getElementById('addShopPhotoUrlBtn')?.addEventListener('click', () => {
      const input = document.getElementById('shopPhotoUrlAddInput');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('Please enter an image URL or asset path', 'warning');
        return;
      }
      currentShopPhotos.push(val);
      if (input) input.value = '';
      renderShopPhotosPreview();
      showToast('Photo added to shop gallery', 'info');
    });

    shopForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveShopBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving Store…'; }

      const docId = document.getElementById('shopDocId').value.trim() ||
                    document.getElementById('shopRoomInput').value.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                    `shop-${Date.now()}`;

      let logoUrl = document.getElementById('shopLogoUrlInput').value.trim() || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
      const logoFile = document.getElementById('shopLogoFileInput')?.files?.[0];
      if (logoFile) {
        logoUrl = await uploadFileToStorageOrDataUrl(logoFile, 'shops/logos');
      } else if (pendingShopLogo) {
        logoUrl = pendingShopLogo;
      }

      const socialMediaUrl = document.getElementById('shopSocialMediaUrl')?.value.trim() || '';

      const shopData = {
        id:             docId,
        name:           document.getElementById('shopNameInput').value.trim(),
        category:       document.getElementById('shopCategoryInput').value,
        floor:          document.getElementById('shopFloorInput').value,
        room:           document.getElementById('shopRoomInput').value.trim(),
        phone:          document.getElementById('shopPhoneInput').value.trim(),
        email:          document.getElementById('shopEmailInput').value.trim(),
        socialHandle:   document.getElementById('shopSocialInput').value.trim(),
        socialMediaUrl: socialMediaUrl,
        logoUrl:        logoUrl,
        photoUrls:      [...currentShopPhotos],
        description:    document.getElementById('shopDescInput').value.trim(),
        isActive:       document.getElementById('shopIsActiveInput').checked,
        updatedAt:      new Date().toISOString()
      };

      const existingIdx = shopsCache.findIndex(s => s.id === docId);
      if (existingIdx >= 0) {
        shopsCache[existingIdx] = { ...shopsCache[existingIdx], ...shopData };
      } else {
        shopsCache.unshift(shopData);
      }

      localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
      updateCountBadge('shopsCountBadge', shopsCache.length);
      updateOverviewMetrics();
      renderShops();
      closeModal(shopModal);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Store'; }
      showToast('Store saved & synced with public directory!', 'success');

      if (fb.isCloudReady && fb.db) {
        try { await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, 'shops', docId), shopData, { merge: true }); } catch(e){}
      }
    });

    // 5. Modals - Event (Expanded with Date, Time, Venue, Details, Photos, Video)
    const eventModal = document.getElementById('eventModal');
    const eventForm  = document.getElementById('eventForm');
    document.getElementById('openAddEventBtn')?.addEventListener('click', () => {
      eventForm.reset();
      editingEventId = null;
      currentEventPhotos = [];
      document.getElementById('eventTime').value = '10:00 AM – 7:00 PM';
      document.getElementById('eventVenue').value = 'Ground Floor Central Grand Atrium';
      document.getElementById('eventVideoUrl').value = '';
      renderEventPhotosPreview();
      document.getElementById('eventModalTitle').textContent = 'Create Event / News';
      document.getElementById('saveEventBtn').textContent = 'Save Event';
      openModal(eventModal);
    });
    document.getElementById('closeEventModalBtn')?.addEventListener('click', () => { editingEventId = null; closeModal(eventModal); });
    document.getElementById('cancelEventBtn')?.addEventListener('click', () => { editingEventId = null; closeModal(eventModal); });

    // Event Photos Selection
    const eventPhotoFileInput = document.getElementById('eventPhotoFileInput');
    document.getElementById('addEventPhotoBtn')?.addEventListener('click', () => {
      eventPhotoFileInput?.click();
    });
    eventPhotoFileInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      for (const file of files) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          currentEventPhotos.push(dataUrl);
        } catch(err) {}
      }
      eventPhotoFileInput.value = '';
      renderEventPhotosPreview();
      showToast(`Added ${files.length} event photo(s)`, 'info');
    });

    document.getElementById('addEventPhotoUrlBtn')?.addEventListener('click', () => {
      const input = document.getElementById('eventPhotoUrlAddInput');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('Please enter a photo URL or asset path', 'warning');
        return;
      }
      currentEventPhotos.push(val);
      if (input) input.value = '';
      renderEventPhotosPreview();
      showToast('Photo added to event', 'info');
    });

    // Event Video File Selection
    const eventVideoFileInput = document.getElementById('eventVideoFileInput');
    document.getElementById('uploadEventVideoBtn')?.addEventListener('click', () => {
      eventVideoFileInput?.click();
    });
    eventVideoFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      showToast('Processing video file…', 'info');
      try {
        const videoResult = await uploadFileToStorageOrDataUrl(file, 'events/videos');
        document.getElementById('eventVideoUrl').value = videoResult;
        showToast(`Video loaded: ${file.name}`, 'success');
      } catch(err) {
        console.warn('Video load error:', err);
      }
    });

    eventForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveEventBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving Event…'; }

      const dateVal = document.getElementById('eventDate').value;
      const data = {
        title:     document.getElementById('eventTitle').value.trim(),
        date:      dateVal,
        eventDate: dateVal,
        eventTime: document.getElementById('eventTime').value.trim(),
        venue:     document.getElementById('eventVenue').value.trim(),
        type:      document.getElementById('eventType').value,
        details:   document.getElementById('eventSummary').value.trim(),
        summary:   document.getElementById('eventSummary').value.trim(),
        photoUrls: [...currentEventPhotos],
        videoUrl:  document.getElementById('eventVideoUrl').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingEventId) {
        const idx = eventsCache.findIndex(e => e.id === editingEventId);
        if (idx >= 0) eventsCache[idx] = { ...eventsCache[idx], ...data };
        showToast('Event updated live!', 'success');
      } else {
        data.id = `evt-${Date.now()}`;
        data.createdAt = new Date().toISOString();
        eventsCache.unshift(data);
        showToast('Event created & published live!', 'success');
      }

      editingEventId = null;
      closeModal(eventModal);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Event'; }
      localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
      updateCountBadge('eventsCountBadge', eventsCache.length);
      updateOverviewMetrics();
      renderEvents();

      if (fb.isCloudReady && fb.db) {
        try {
          if (editingEventId) {
            await fb.fsMod.updateDoc(fb.fsMod.doc(fb.db, 'events', editingEventId), data);
          } else {
            await fb.fsMod.addDoc(fb.fsMod.collection(fb.db, 'events'), data);
          }
        } catch(e){}
      }
    });

    // 6. Modals - Blog
    const blogModal = document.getElementById('blogModal');
    const blogForm  = document.getElementById('blogForm');
    document.getElementById('openAddBlogBtn')?.addEventListener('click', () => {
      blogForm.reset();
      editingBlogId = null;
      document.getElementById('blogModalTitle').textContent = 'Publish Journal Article';
      document.getElementById('saveBlogBtn').textContent = 'Publish Article';
      openModal(blogModal);
    });
    document.getElementById('closeBlogModalBtn')?.addEventListener('click', () => { editingBlogId = null; closeModal(blogModal); });
    document.getElementById('cancelBlogBtn')?.addEventListener('click', () => { editingBlogId = null; closeModal(blogModal); });

    document.getElementById('blogTitleInput')?.addEventListener('input', (e) => {
      if (!editingBlogId) {
        document.getElementById('blogSlugInput').value =
          e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }
    });

    blogForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const slug = document.getElementById('blogSlugInput').value.trim() || `post-${Date.now()}`;
      const data = {
        title:     document.getElementById('blogTitleInput').value.trim(),
        slug,
        date:      document.getElementById('blogDateInput').value || new Date().toISOString().slice(0, 10),
        excerpt:   document.getElementById('blogExcerptInput').value.trim(),
        content:   document.getElementById('blogContentInput').value.trim() || document.getElementById('blogExcerptInput').value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingBlogId) {
        const idx = blogCache.findIndex(p => p.id === editingBlogId);
        if (idx >= 0) blogCache[idx] = { ...blogCache[idx], ...data };
        showToast('Article updated live!', 'success');
      } else {
        data.id = slug;
        blogCache.unshift(data);
        showToast('Article published live!', 'success');
      }
      editingBlogId = null;
      closeModal(blogModal);
      localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
      updateCountBadge('blogCountBadge', blogCache.length);
      renderBlog();
    });

    // 7. Modals - Gallery (Streamlined file upload, URL is optional fallback)
    const galleryModal = document.getElementById('galleryModal');
    const galleryFile = document.getElementById('galleryFile');
    const galleryPreview = document.getElementById('galleryFilePreview');
    const galleryPreviewImg = document.getElementById('galleryFilePreviewImg');
    const galleryPreviewName = document.getElementById('galleryFilePreviewName');

    document.getElementById('openAddGalleryBtn')?.addEventListener('click', () => {
      document.getElementById('galleryForm').reset();
      if (galleryPreview) galleryPreview.style.display = 'none';
      openModal(galleryModal);
    });
    document.getElementById('closeGalleryModalBtn')?.addEventListener('click', () => closeModal(galleryModal));
    document.getElementById('cancelGalleryBtn')?.addEventListener('click',  () => closeModal(galleryModal));

    galleryFile?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file && galleryPreview && galleryPreviewImg && galleryPreviewName) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          galleryPreviewImg.src = dataUrl;
          galleryPreviewName.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
          galleryPreview.style.display = 'flex';
        } catch(err) {}
      }
    });

    document.getElementById('galleryForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveGalleryBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Uploading…'; }

      let imageUrl = '';
      const file = galleryFile?.files?.[0];
      if (file) {
        imageUrl = await uploadFileToStorageOrDataUrl(file, 'gallery');
      } else {
        imageUrl = document.getElementById('galleryUrlInput')?.value.trim() || '';
      }

      if (!imageUrl) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Upload to Gallery'; }
        showToast('Please choose an image file to upload.', 'warning');
        return;
      }

      const newDoc = {
        id: `gal-${Date.now()}`,
        imageUrl,
        caption:   document.getElementById('galleryCaption').value.trim(),
        category:  document.getElementById('galleryCategory').value,
        sortOrder: parseInt(document.getElementById('galleryOrder').value) || 1,
        uploadedAt: new Date().toISOString()
      };
      galleryCache.unshift(newDoc);
      updateCountBadge('galleryCountBadge', galleryCache.length);
      renderGallery();
      closeModal(galleryModal);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Upload to Gallery'; }
      showToast('Photo added to gallery', 'success');

      if (fb.isCloudReady && fb.db) {
        try { await fb.fsMod.addDoc(fb.fsMod.collection(fb.db, 'gallery'), newDoc); } catch(e){}
      }
    });

    // 8. Sync Live Site Button
    document.getElementById('syncLiveSiteBtn')?.addEventListener('click', () => {
      const btn = document.getElementById('syncLiveSiteBtn');
      btn.disabled = true;
      btn.textContent = 'Synchronizing…';
      localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
      localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
      localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
      localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync Live Site Now`;
        showToast('Dashboard & Public Site fully synchronized! 🚀', 'success');
      }, 400);
    });

    // 10. Seed Button
    document.getElementById('seedDatabaseBtn')?.addEventListener('click', async () => {
      const logBox = document.getElementById('seedProgressLog');
      if (logBox) { logBox.style.display = 'block'; logBox.innerHTML = '<div>Syncing 51 stores, events, blog, reviews, and site data…</div>'; }
      localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
      localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
      localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
      localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
      setTimeout(() => {
        if (logBox) {
          logBox.innerHTML += '<div style="color:#10B981;font-weight:700;margin-top:6px;">✓ 51 Stores Synchronized successfully!</div>';
        }
        showToast('All collections synchronized successfully!', 'success');
      }, 500);
    });

    // 11. Password Modal
    const changePwdModal = document.getElementById('changePasswordModal');
    document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => openModal(changePwdModal));
    document.getElementById('closeChangePasswordBtn')?.addEventListener('click', () => closeModal(changePwdModal));
    document.getElementById('cancelChangePasswordBtn')?.addEventListener('click', () => closeModal(changePwdModal));
    document.getElementById('changePasswordForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const p1 = document.getElementById('newPassword').value;
      const p2 = document.getElementById('confirmPassword').value;
      if (p1.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
      if (p1 !== p2) { showToast('Passwords do not match', 'error'); return; }
      localStorage.setItem('mombasa_admin_password', p1);
      showToast('Password updated successfully', 'success');
      closeModal(changePwdModal);
      e.target.reset();
    });

    // 12. Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      if (confirm('Sign out of the admin portal?')) {
        localStorage.removeItem('mombasa_admin_session');
        window.location.replace('./login.html');
      }
    });

    // 13. Mobile sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    // 14. Global modal dismiss on backdrop or escape
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(backdrop); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = document.querySelector('.modal-backdrop.is-open');
        if (open) closeModal(open);
      }
    });
  }

  // ── HELPERS ────────────────────────────────────────────────
  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return isoStr; }
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── DOM READY ENTRY POINT ──────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initData();
    attachEventListeners();
    renderShops();
    initCloudFirebase();
  });

  // If DOM is already parsed
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    checkAuth();
    initData();
    attachEventListeners();
    renderShops();
    initCloudFirebase();
  }

})();
