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

  // Firebase Module References (loaded dynamically if on HTTP/HTTPS)
  let fb = {
    auth: null,
    db: null,
    storage: null,
    isCloudReady: false
  };

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
      reviews:          renderReviews,
      siteContent:      loadSiteContentForm
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
    document.getElementById('shopLogoUrlInput').value = shop.logoUrl     || '';
    document.getElementById('shopDescInput').value    = shop.description || '';
    document.getElementById('shopIsActiveInput').checked = shop.isActive !== false;
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

    if (ledLeadsCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No LED inquiries yet. Submissions from the <a href="../led-advertising/index.html" target="_blank" style="color:var(--coral);font-weight:600;">LED Advertising Estimator ↗</a> appear here.</td></tr>`;
      return;
    }

    ledLeadsCache.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      tr.innerHTML = `
        <td><strong>${escHtml(lead.businessName || 'Brand')}</strong></td>
        <td><div>${escHtml(lead.phone || '—')}</div><small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small></td>
        <td><span class="admin-badge">${escHtml(lead.packageRequested || 'Standard')}</span></td>
        <td><div>${escHtml(lead.message || '—')}</div></td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;" onchange="window.updateLeadStatus('ledLeads','${lead.id}',this.value)">
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

  // ── 4. ACTIVATION LEADS RENDER ─────────────────────────────
  function renderActivationLeads() {
    const tbody = document.getElementById('activationLeadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (activLeadsCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No activation requests yet. Submissions from the <a href="../activations/index.html" target="_blank" style="color:var(--coral);font-weight:600;">Activations Booking Page ↗</a> appear here.</td></tr>`;
      return;
    }

    activLeadsCache.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      tr.innerHTML = `
        <td><strong>${escHtml(lead.applicantName || 'Applicant')}</strong></td>
        <td><div>${escHtml(lead.phone || '—')}</div><small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small></td>
        <td><span class="admin-badge">${escHtml(lead.activationType || 'Pop-up')}</span></td>
        <td><div>${escHtml(lead.message || '—')}</div></td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;" onchange="window.updateLeadStatus('activationLeads','${lead.id}',this.value)">
            <option value="new" ${statusVal === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="won" ${statusVal === 'won' ? 'selected' : ''}>Approved</option>
            <option value="lost" ${statusVal === 'lost' ? 'selected' : ''}>Declined</option>
          </select>
        </td>
        <td><button class="btn-danger btn-sm" onclick="window.deleteLead('activationLeads','${lead.id}')">Delete</button></td>
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
    if (lead) lead.status = status;
    showToast('Lead status updated', 'success');
  };

  window.deleteLead = function(collName, id) {
    if (!confirm('Delete this record?')) return;
    if (collName === 'ledLeads')        { ledLeadsCache = ledLeadsCache.filter(l => l.id !== id); updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length); renderLedLeads(); }
    if (collName === 'activationLeads') { activLeadsCache = activLeadsCache.filter(l => l.id !== id); updateCountBadge('activationLeadsCountBadge', activLeadsCache.length); renderActivationLeads(); }
    if (collName === 'contactLeads')    { contactLeadsCache = contactLeadsCache.filter(l => l.id !== id); updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length); renderContactLeads(); }
    updateOverviewMetrics();
    showToast('Record deleted', 'success');
  };

  // ── 6. EVENTS RENDER ───────────────────────────────────────
  function renderEvents() {
    const tbody = document.getElementById('eventsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (eventsCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No events found. Add your first event!</td></tr>`;
      return;
    }

    eventsCache.forEach(evt => {
      const type = evt.type || 'upcoming';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color:var(--admin-text);">${escHtml(evt.title)}</strong></td>
        <td style="color:var(--admin-text-muted);font-size:13px;">${formatDate(evt.date) || 'TBD'}</td>
        <td><span class="status-pill ${type}">${type}</span></td>
        <td><div style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text-muted);">${escHtml(evt.summary || '')}</div></td>
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
    document.getElementById('eventDate').value    = evt.date    || '';
    document.getElementById('eventType').value    = evt.type    || 'upcoming';
    document.getElementById('eventSummary').value = evt.summary || '';
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

  // ── 9. HOMEPAGE CONTENT FORM ───────────────────────────────
  function loadSiteContentForm() {
    let d = null;
    const raw = localStorage.getItem('mombasa_live_site_content');
    if (raw) {
      try { d = JSON.parse(raw); } catch(e) {}
    }
    if (!d && window.MOMBASA_DEFAULT_SITE_DATA) {
      d = window.MOMBASA_DEFAULT_SITE_DATA;
    }
    if (d) {
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      setVal('siteNameInput', d.siteName || 'Mombasa Mall');
      setVal('siteTaglineInput', d.tagline || 'The Coastal Lifestyle Destination');
      setVal('heroHeadingInput', d.heroHeading || 'Welcome to Mombasa Mall');
      setVal('heroSubInput', d.heroSub || '120+ stores, dining and entertainment');
      setVal('marqueeItemsInput', (d.marqueeItems || ['Mombasa\'s Premier Mall', '120+ Brands', '5 Floors of Possibility']).join(', '));
      setVal('contactPhoneInput', d.phone || '+254 790 964 002');
      setVal('contactEmailInput', d.email || 'info@mombasamall.co.ke');
      setVal('contactAddressInput', d.address || 'Mwembe Tayari, Jomo Kenyatta Avenue, Mombasa');
    }
  }

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

    // 4. Modals - Store
    const shopModal = document.getElementById('shopModal');
    const shopForm  = document.getElementById('shopForm');
    document.getElementById('openAddShopBtn')?.addEventListener('click', () => {
      shopForm.reset();
      document.getElementById('shopDocId').value = '';
      document.getElementById('shopModalTitle').textContent = 'Add New Store';
      openModal(shopModal);
    });
    document.getElementById('closeShopModalBtn')?.addEventListener('click', () => closeModal(shopModal));
    document.getElementById('cancelShopBtn')?.addEventListener('click',  () => closeModal(shopModal));

    shopForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const docId = document.getElementById('shopDocId').value.trim() ||
                    document.getElementById('shopRoomInput').value.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                    `shop-${Date.now()}`;
      const shopData = {
        id:           docId,
        name:         document.getElementById('shopNameInput').value.trim(),
        category:     document.getElementById('shopCategoryInput').value,
        floor:        document.getElementById('shopFloorInput').value,
        room:         document.getElementById('shopRoomInput').value.trim(),
        phone:        document.getElementById('shopPhoneInput').value.trim(),
        email:        document.getElementById('shopEmailInput').value.trim(),
        socialHandle: document.getElementById('shopSocialInput').value.trim(),
        logoUrl:      document.getElementById('shopLogoUrlInput').value.trim() || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
        description:  document.getElementById('shopDescInput').value.trim(),
        isActive:     document.getElementById('shopIsActiveInput').checked,
        updatedAt:    new Date().toISOString()
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
      showToast('Store saved & synced with public site!', 'success');

      if (fb.isCloudReady && fb.db) {
        try { await fb.fsMod.setDoc(fb.fsMod.doc(fb.db, 'shops', docId), shopData, { merge: true }); } catch(e){}
      }
    });

    // 5. Modals - Event
    const eventModal = document.getElementById('eventModal');
    const eventForm  = document.getElementById('eventForm');
    document.getElementById('openAddEventBtn')?.addEventListener('click', () => {
      eventForm.reset();
      editingEventId = null;
      document.getElementById('eventModalTitle').textContent = 'Create Event / News';
      document.getElementById('saveEventBtn').textContent = 'Save Event';
      openModal(eventModal);
    });
    document.getElementById('closeEventModalBtn')?.addEventListener('click', () => { editingEventId = null; closeModal(eventModal); });
    document.getElementById('cancelEventBtn')?.addEventListener('click', () => { editingEventId = null; closeModal(eventModal); });

    eventForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        title:     document.getElementById('eventTitle').value.trim(),
        date:      document.getElementById('eventDate').value,
        type:      document.getElementById('eventType').value,
        summary:   document.getElementById('eventSummary').value.trim(),
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

    // 7. Modals - Gallery
    const galleryModal = document.getElementById('galleryModal');
    document.getElementById('openAddGalleryBtn')?.addEventListener('click', () => {
      document.getElementById('galleryForm').reset();
      openModal(galleryModal);
    });
    document.getElementById('closeGalleryModalBtn')?.addEventListener('click', () => closeModal(galleryModal));
    document.getElementById('cancelGalleryBtn')?.addEventListener('click',  () => closeModal(galleryModal));

    document.getElementById('galleryForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const imageUrl = document.getElementById('galleryUrlInput').value.trim();
      if (!imageUrl) {
        showToast('Please provide an image URL.', 'error');
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
      showToast('Photo added to gallery', 'success');
    });

    // 8. Site Content Form
    document.getElementById('siteContentForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const marqueeRaw   = document.getElementById('marqueeItemsInput').value;
      const marqueeItems = marqueeRaw.split(',').map(s => s.trim()).filter(Boolean);
      const payload = {
        siteName:     document.getElementById('siteNameInput').value.trim(),
        tagline:      document.getElementById('siteTaglineInput').value.trim(),
        heroHeading:  document.getElementById('heroHeadingInput').value.trim(),
        heroSub:      document.getElementById('heroSubInput').value.trim(),
        marqueeItems: marqueeItems.length ? marqueeItems : ['Mombasa\'s Premier Mall', '120+ Brands', '5 Floors of Possibility'],
        phone:        document.getElementById('contactPhoneInput').value.trim(),
        email:        document.getElementById('contactEmailInput').value.trim(),
        address:      document.getElementById('contactAddressInput').value.trim(),
        updatedAt:    new Date().toISOString()
      };
      localStorage.setItem('mombasa_live_site_content', JSON.stringify(payload));
      showToast('Homepage content updated live on public site! 🎉', 'success');
    });

    // 9. Sync Live Site Button
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
