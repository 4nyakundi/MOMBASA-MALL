// admin/admin.js — Mombasa Mall Admin Dashboard Controller
// Enterprise High-Performance & Resilient Real-Time Edition
// Features: Client Image Optimization, Instant Multi-Entity Search, Real-Time Sync Bus,
// CSV/JSON Export & Restore Suite, Non-Blocking Cloud/Local Storage Bus.

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
  let usersCache        = [];
  let editingUserId     = null;
  let editingEventId    = null;
  let editingBlogId     = null;
  let currentShopPhotos = [];
  let pendingShopLogo   = null;
  let currentEventPhotos= [];
  let calCurrentDate    = new Date();

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

  // Real-Time Cross-Tab & Multi-Window Sync Bus
  const syncBus = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('mombasa_mall_sync_bus') : null;

  function broadcastChange(action, entity) {
    queueCloudChange(action, entity);
    if (syncBus) {
      try {
        syncBus.postMessage({ action, entity, timestamp: Date.now() });
      } catch (e) {}
    }
  }

  const cloudCollections = () => ({
    shops: { key: 'mombasa_live_shops', rows: shopsCache, assign: rows => { shopsCache = rows; } },
    gallery: { key: 'mombasa_live_gallery', rows: galleryCache, assign: rows => { galleryCache = rows; } },
    events: { key: 'mombasa_live_events', rows: eventsCache, assign: rows => { eventsCache = rows; } },
    blogPosts: { key: 'mombasa_live_blog', rows: blogCache, assign: rows => { blogCache = rows; } },
    reviews: { key: 'mombasa_live_reviews', rows: reviewsCache, assign: rows => { reviewsCache = rows; } },
    ledLeads: { key: 'mombasa_live_led_leads', rows: ledLeadsCache, assign: rows => { ledLeadsCache = rows; } },
    activationLeads: { key: 'mombasa_live_activation_leads', rows: activLeadsCache, assign: rows => { activLeadsCache = rows; } },
    contactLeads: { key: 'mombasa_live_contact_leads', rows: contactLeadsCache, assign: rows => { contactLeadsCache = rows; } },
    users: { key: 'mombasa_live_users', rows: usersCache, assign: rows => { usersCache = rows; } }
  });
  let outbox = [];
  try { outbox = JSON.parse(localStorage.getItem('mombasa_admin_outbox') || '[]'); } catch (error) {}
  let flushing = null;
  function queueCloudChange(action, id) {
    const aliases = {shop: 'shops', gallery: 'gallery', event: 'events', blog: 'blogPosts', review: 'reviews', user: 'users'};
    const groups = cloudCollections();
    let collections = [];
    if (['sync_public_site', 'seed_database'].includes(action)) collections = ['shops', 'gallery', 'events', 'blogPosts', 'reviews'];
    else if (action === 'restore_database') collections = Object.keys(groups);
    else {
      const name = action.replace(/^(save_|delete_|toggle_|update_status_)/, '');
      const collection = aliases[name] || name;
      if (groups[collection]) collections = [collection];
    }
    for (const collection of collections) {
      const rows = id === 'all' ? groups[collection].rows : groups[collection].rows.filter(row => row.id === id);
      if (action.startsWith('delete_')) outbox.push({ collection, id, remove: true });
      else for (const row of rows) outbox.push({ collection, id: row.id, data: JSON.parse(JSON.stringify(row)) });
    }
    if (collections.length) {
      localStorage.setItem('mombasa_admin_outbox', JSON.stringify(outbox));
      flushCloudChanges().catch(error => showToast('Changes are saved on this device; cloud sync failed: ' + error.message + '. Use Sync Live Site to retry.', 'error'));
    }
  }
  async function flushCloudChanges() {
    if (flushing) return flushing;
    if (!fb.isCloudReady || !fb.auth?.currentUser) throw new Error('Sign in to Firebase to synchronize');
    flushing = (async () => {
      while (outbox.length) {
        const operation = outbox[0];
        const ref = fb.fsMod.doc(fb.db, operation.collection, operation.id);
        let timer;
        const write = operation.remove ? fb.fsMod.deleteDoc(ref) : fb.fsMod.setDoc(ref, operation.data);
        await Promise.race([write, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Database acknowledgement timed out; changes remain queued')), 20000);
        })]).finally(() => clearTimeout(timer));
        // Refresh after acknowledgement so skipped pending snapshots are not lost.
        outbox.shift();
        localStorage.setItem('mombasa_admin_outbox', JSON.stringify(outbox));
      }
    })();
    try { await flushing; } finally { flushing = null; }
    if (cloudUnsubscribers.length) syncWithFirestoreCloud();
  }
  const cloudUnsubscribers = [];

  // ── CLIENT-SIDE IMAGE COMPRESSION (PREVENTS STORAGE OVERFLOW) ──
  function compressImage(file, maxWidth = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      // If SVG or non-image, fallback directly
      if (!file.type.match(/image.*/) || file.type.includes('svg')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Return optimized JPEG Data URL
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readFileAsDataUrl(file) {
    return compressImage(file, 1400, 0.82);
  }

  async function uploadFileToStorageOrDataUrl(file, pathPrefix = 'uploads') {
    if (fb.isCloudReady && fb.storage && fb.stMod) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileRef = fb.stMod.ref(fb.storage, `${pathPrefix}/${Date.now()}_${safeName}`);
        const snap = await fb.stMod.uploadBytes(fileRef, file);
        return await fb.stMod.getDownloadURL(snap.ref);
      } catch (err) {
        console.warn('[Storage] Cloud upload note, using optimized DataURL fallback:', err.message);
      }
    }
    return await compressImage(file, 1400, 0.82);
  }

  // ── CSV & JSON EXPORT UTILITIES ────────────────────────────
  function exportToCSV(filename, rows) {
    if (!rows || !rows.length) {
      showToast('No records available to export.', 'warning');
      return;
    }
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : row[k];
          cell = Array.isArray(cell) ? cell.join('; ') : cell.toString().replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(separator);
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${rows.length} records to ${filename}.csv`, 'success');
  }

  function downloadJSONBackup() {
    const backup = {
      timestamp: new Date().toISOString(),
      source: 'Mombasa Mall Control Centre',
      version: '2.0.0',
      data: {
        shops: shopsCache,
        gallery: galleryCache,
        ledLeads: ledLeadsCache,
        activationLeads: activLeadsCache,
        contactLeads: contactLeadsCache,
        events: eventsCache,
        blog: blogCache,
        reviews: reviewsCache,
        users: usersCache
      }
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Mombasa_Mall_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Complete JSON database backup downloaded!', 'success');
  }

  function restoreFromJSON(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      const data = parsed.data || parsed;
      if (!data) throw new Error('Invalid backup structure');

      if (Array.isArray(data.shops)) {
        shopsCache = data.shops;
        localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
      }
      if (Array.isArray(data.gallery)) {
        galleryCache = data.gallery;
        localStorage.setItem('mombasa_live_gallery', JSON.stringify(galleryCache));
      }
      if (Array.isArray(data.ledLeads)) {
        ledLeadsCache = data.ledLeads;
        localStorage.setItem('mombasa_live_led_leads', JSON.stringify(ledLeadsCache));
      }
      if (Array.isArray(data.activationLeads)) {
        activLeadsCache = data.activationLeads;
        localStorage.setItem('mombasa_live_activation_leads', JSON.stringify(activLeadsCache));
      }
      if (Array.isArray(data.contactLeads)) {
        contactLeadsCache = data.contactLeads;
        localStorage.setItem('mombasa_live_contact_leads', JSON.stringify(contactLeadsCache));
      }
      if (Array.isArray(data.events)) {
        eventsCache = data.events;
        localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
      }
      if (Array.isArray(data.blog)) {
        blogCache = data.blog;
        localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
      }
      if (Array.isArray(data.reviews)) {
        reviewsCache = data.reviews;
        localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
      }
      if (Array.isArray(data.users)) {
        usersCache = data.users;
        localStorage.setItem('mombasa_live_users', JSON.stringify(usersCache));
      }

      updateAllBadges();
      updateOverviewMetrics();
      renderCurrentTab();
      broadcastChange('restore_database', 'all');
      showToast('Backup restored on this device; synchronizing with cloud.', 'info');
    } catch (err) {
      showToast(`Restore failed: ${err.message}`, 'error');
    }
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
    toast.innerHTML = `<span style="display:inline-flex;align-items:center;">${icons[type] || icons.info}</span>`;
    const messageText = document.createElement('span');
    messageText.textContent = message;
    toast.append(messageText);
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
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  window.closeModal = closeModal;

  // ── AUTH CHECK ─────────────────────────────────────────────
  function checkAuth() {
    const localSession = localStorage.getItem('mombasa_admin_session');
    if (localSession) {
      try {
        const s = JSON.parse(localSession);
        currentUser = { email: s.email || 'admin@mombasamall.co.ke', role: s.role || 'Administrator' };
        const emailEl = document.getElementById('adminEmailDisplay');
        if (emailEl) emailEl.textContent = currentUser.email;
        const roleEl = document.querySelector('.admin-user-role');
        if (roleEl) roleEl.textContent = currentUser.role;
        return true;
      } catch (e) {}
    }
    // If on web protocol and no local session or Firebase user, redirect to login
    if (window.location.protocol !== 'file:' && !fb.auth?.currentUser) {
      window.location.replace('./login.html');
      return false;
    }
    return true;
  }

  // ── CLOUD FIREBASE INITIALIZATION ──────────────────────────
  async function initCloudFirebase() {
    if (window.location.protocol === 'file:') {
      console.log('[Mombasa Mall Admin] Local protocol active. Utilizing high-speed local data bus.');
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
      authMod.onAuthStateChanged(fb.auth, async (user) => {
        if (!user && !localStorage.getItem('mombasa_admin_session')) {
          window.location.replace('./login.html');
          return;
        }
        if (user) {
          currentUser = user;
          const emailEl = document.getElementById('adminEmailDisplay');
          if (emailEl) emailEl.textContent = user.email || '';
        }
        fb.isCloudReady = true;
        try { await flushCloudChanges(); } catch (error) { showToast('Cloud sync needs attention: ' + error.message, 'error'); }
        syncWithFirestoreCloud();
      });

    } catch (e) {
      showToast('Database connection unavailable: ' + e.message + '. Changes will remain on this device until synchronization succeeds.', 'error');
    }
  }

  function syncWithFirestoreCloud() {
    if (!fb.isCloudReady || !fb.db) return;
    cloudUnsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
    for (const [collection, group] of Object.entries(cloudCollections())) {
      cloudUnsubscribers.push(fb.fsMod.onSnapshot(fb.fsMod.collection(fb.db, collection), snapshot => {
        if (outbox.some(operation => operation.collection === collection)) return;
        const rows = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        group.assign(rows);
        try { localStorage.setItem(group.key, JSON.stringify(rows)); } catch (error) { console.warn('Browser cache full', error); }
        updateAllBadges(); updateOverviewMetrics(); renderCurrentTab();
      }, error => showToast('Cannot read ' + collection + ' from database: ' + error.message, 'error')));
    }
  }

  // ── DATA INITIALIZATION ────────────────────────────────────
  function initData() {
    // 1. SHOPS
    const savedShops = localStorage.getItem('mombasa_live_shops');
    if (savedShops) {
      try { shopsCache = JSON.parse(savedShops); } catch (e) {}
    }
    if (!savedShops && window.MOMBASA_DEFAULT_STORES && window.MOMBASA_DEFAULT_STORES.floors) {
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
            socialMediaUrl: shop.socialMediaUrl || '',
            logoUrl: shop.logo || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
            photoUrls: shop.photos || [],
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
    if (!savedEvents && window.MOMBASA_DEFAULT_EVENTS) {
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
    if (!savedBlog && window.MOMBASA_DEFAULT_BLOG && window.MOMBASA_DEFAULT_BLOG.posts) {
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
    if (!savedReviews && window.MOMBASA_DEFAULT_REVIEWS) {
      const list = [];
      (window.MOMBASA_DEFAULT_REVIEWS.testimonials || []).forEach((t, i) => list.push({ id: `rev-t-${i}`, ...t, type: 'testimonial', approved: true }));
      (window.MOMBASA_DEFAULT_REVIEWS.customerFeedback || []).forEach((f, i) => list.push({ id: `rev-f-${i}`, author: f.author || f.name, quote: f.quote || f.comment, rating: 5, type: 'feedback', approved: false }));
      reviewsCache = list;
      localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
    }

    // 5. GALLERY
    const savedGallery = localStorage.getItem('mombasa_live_gallery');
    if (savedGallery) {
      try { galleryCache = JSON.parse(savedGallery); } catch (e) {}
    }
    if (!savedGallery && window.MOMBASA_DEFAULT_GALLERY) {
      galleryCache = window.MOMBASA_DEFAULT_GALLERY.map((g, i) => ({ id: `gal-def-${i}`, ...g }));
      localStorage.setItem('mombasa_live_gallery', JSON.stringify(galleryCache));
    }

    // 6. LEADS (LED, ACTIVATION, CONTACT)
    const sLed = localStorage.getItem('mombasa_live_led_leads');
    if (sLed) { try { ledLeadsCache = JSON.parse(sLed); } catch (e) {} }

    const sAct = localStorage.getItem('mombasa_live_activation_leads');
    if (sAct) { try { activLeadsCache = JSON.parse(sAct); } catch (e) {} }

    const sCnt = localStorage.getItem('mombasa_live_contact_leads');
    if (sCnt) { try { contactLeadsCache = JSON.parse(sCnt); } catch (e) {} }

    // 7. SYSTEM USERS & ROLES
    const sUsers = localStorage.getItem('mombasa_live_users');
    if (sUsers) {
      try { usersCache = JSON.parse(sUsers); } catch (e) {}
    }
    if (!sUsers && window.MOMBASA_DEFAULT_USERS) {
      usersCache = JSON.parse(JSON.stringify(window.MOMBASA_DEFAULT_USERS));
      localStorage.setItem('mombasa_live_users', JSON.stringify(usersCache));
    }

    updateAllBadges();
    updateOverviewMetrics();
  }

  function updateAllBadges() {
    updateCountBadge('shopsCountBadge', shopsCache.length);
    updateCountBadge('galleryCountBadge', galleryCache.length);
    updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length);
    updateCountBadge('activationLeadsCountBadge', activLeadsCache.length);
    updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length);
    updateCountBadge('eventsCountBadge', eventsCache.length);
    updateCountBadge('blogCountBadge', blogCache.length);
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
    updateCountBadge('usersCountBadge', usersCache.length);
  }

  // ── TAB SWITCHING ──────────────────────────────────────────
  function switchTab(tabKey) {
    activeTab = tabKey;
    document.querySelectorAll('.admin-nav-item').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tab === tabKey);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('is-active', p.id === `tab-${tabKey}`);
    });

    const titleEl = document.getElementById('topbarTitle');
    const titles = {
      overview:        'Dashboard',
      shops:           'Stores & Units Management',
      gallery:         'Photo Gallery Management',
      ledLeads:        'LED Billboard Leads',
      activationLeads: 'Activation Leads & Schedule',
      contactLeads:    'Contact & Leasing Inquiries',
      events:          'Events & News Management',
      blogPosts:       'Journal & Editorial Blog',
      reviews:         'Reviews Moderation',
      users:           'System Users & Roles'
    };
    if (titleEl) titleEl.textContent = titles[tabKey] || 'Admin Dashboard';

    // Close mobile drawer on navigation
    document.body.classList.remove('sidebar-open');

    renderCurrentTab();
  }
  window.switchTab = switchTab;

  function renderCurrentTab() {
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
      users:            renderUsers
    };
    loaders[activeTab]?.();
  }

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
        <td style="width:56px;">
          <img src="${escHtml(shop.logoUrl || shop.logo || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png')}"
               alt="${escHtml(shop.name)}"
               style="width:40px;height:40px;object-fit:contain;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0;padding:2px;"
               loading="lazy">
        </td>
        <td>
          <strong style="color:var(--admin-text);font-size:14px;display:block;">${escHtml(shop.name)}</strong>
          <small style="color:var(--admin-text-muted);">${escHtml(shop.phone || '—')}${shop.email ? ' · ' + escHtml(shop.email) : ''}</small>
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
    broadcastChange('delete_shop', shopId);
    showToast(`Deleted "${shopName}"`, 'success');


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

  window.deleteGalleryItem = async function(id) {
    if (!confirm('Remove this photo from gallery?')) return;
    galleryCache = galleryCache.filter(g => g.id !== id);
    localStorage.setItem('mombasa_live_gallery', JSON.stringify(galleryCache));
    updateCountBadge('galleryCountBadge', galleryCache.length);
    renderGallery();
    broadcastChange('delete_gallery', id);
    showToast('Photo removed from gallery', 'success');


  };

  // ── 3. LED LEADS RENDER ────────────────────────────────────
  function renderLedLeads() {
    const tbody = document.getElementById('ledLeadsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const search       = document.getElementById('ledSearchInput')?.value.toLowerCase().trim() || '';
    const filterStatus = document.getElementById('ledStatusFilter')?.value || 'all';

    let list = ledLeadsCache.filter(l => {
      const matchesSearch = !search ||
        (l.businessName && l.businessName.toLowerCase().includes(search)) ||
        (l.companyName  && l.companyName.toLowerCase().includes(search)) ||
        (l.contactName  && l.contactName.toLowerCase().includes(search)) ||
        (l.applicantName&& l.applicantName.toLowerCase().includes(search)) ||
        (l.phone        && l.phone.toLowerCase().includes(search)) ||
        (l.email        && l.email.toLowerCase().includes(search));
      const matchesStatus = filterStatus === 'all' || (l.status || 'new') === filterStatus;
      return matchesSearch && matchesStatus;
    });

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No LED inquiries match your search. Submissions from the <a href="/led-advertising/index.html" target="_blank" style="color:var(--coral);font-weight:600;">LED Advertising Estimator ↗</a> appear here.</td></tr>`;
      return;
    }

    list.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      const dur = lead.durationRequested || (lead.durationMonths ? `${lead.durationMonths} Month(s)` : 'Standard Duration');

      tr.innerHTML = `
        <td>
          <strong style="color:var(--admin-text);display:block;font-size:13.5px;">${escHtml(lead.businessName || lead.companyName || 'Brand Partner')}</strong>
          <small style="color:var(--admin-text-muted);">${escHtml(lead.contactName || lead.applicantName || '—')}</small>
        </td>
        <td>
          <div style="font-size:13px;font-weight:700;color:var(--admin-text);">${escHtml(lead.phone || '—')}</div>
          ${lead.email ? `<small style="color:var(--admin-text-muted);">${escHtml(lead.email)}</small>` : ''}
        </td>
        <td><span class="admin-badge">${escHtml(lead.packageRequested || lead.screenType || 'Digital Billboard')}</span></td>
        <td><span style="display:inline-block;padding:4px 9px;border-radius:6px;background:rgba(217,119,6,0.12);color:#B45309;font-weight:700;font-size:12px;">${escHtml(dur)}</span></td>
        <td>
          ${lead.estimatedCost ? `<div style="font-weight:800;color:var(--coral);font-size:12.5px;">${escHtml(lead.estimatedCost)}</div>` : ''}
          <div style="max-width:240px;font-size:12.5px;color:var(--admin-text-muted);line-height:1.4;word-break:break-word;" title="${escHtml(lead.message || '')}">${escHtml(lead.message || '—')}</div>
        </td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;font-weight:600;" onchange="window.updateLeadStatus('ledLeads','${lead.id}',this.value)">
            <option value="new" ${statusVal === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="won" ${statusVal === 'won' ? 'selected' : ''}>Booked</option>
            <option value="lost" ${statusVal === 'lost' ? 'selected' : ''}>Lost</option>
          </select>
        </td>
        <td>
          <div class="td-actions">
            <button class="btn-secondary btn-sm" onclick="window.openLedDetails('${lead.id}')">View</button>
            <button class="btn-danger btn-sm" onclick="window.deleteLead('ledLeads','${lead.id}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function openLedDetails(leadId) {
    const lead = ledLeadsCache.find(l => l.id === leadId);
    if (!lead) return;
    const body = document.getElementById('ledModalBody');
    const modal = document.getElementById('ledDetailModal');
    if (!body || !modal) return;

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:var(--coral-light); padding:16px; border-radius:12px; border:1px solid rgba(255,107,71,0.2);">
          <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--coral);">Brand / Company</span>
          <h3 style="margin:4px 0 0; font-size:20px; font-weight:800; color:var(--admin-text); word-break:break-word;">${escHtml(lead.businessName || lead.companyName || 'Brand Partner')}</h3>
          <p style="margin:2px 0 0; font-size:13px; color:var(--admin-text-muted);">Contact Name: <strong>${escHtml(lead.contactName || lead.applicantName || '—')}</strong></p>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Phone Number</label>
            <div style="font-size:14px; font-weight:700; color:var(--admin-text);">${escHtml(lead.phone || '—')}</div>
          </div>
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Email Address</label>
            <div style="font-size:14px; font-weight:600; color:var(--admin-text); word-break:break-all;">${escHtml(lead.email || '—')}</div>
          </div>
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Screen Package</label>
            <div style="font-size:14px; font-weight:700; color:var(--coral);">${escHtml(lead.packageRequested || lead.screenType || 'Digital Billboard')}</div>
          </div>
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Requested Hire Duration</label>
            <div style="font-size:14px; font-weight:700; color:var(--admin-text);">${escHtml(lead.durationRequested || (lead.durationMonths ? `${lead.durationMonths} Month(s)` : '1 Month'))}</div>
          </div>
          ${lead.estimatedCost ? `
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Estimated Campaign Budget</label>
            <div style="font-size:16px; font-weight:800; color:var(--coral); background:#F8FAFC; padding:10px 14px; border-radius:8px; border:1px solid var(--admin-border);">${escHtml(lead.estimatedCost)}</div>
          </div>` : ''}
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Campaign Description &amp; Technical Notes</label>
            <div style="font-size:13px; color:var(--admin-text); background:#F8FAFC; padding:12px 14px; border-radius:8px; border:1px solid var(--admin-border); line-height:1.6; word-break:break-word; white-space:pre-wrap;">${escHtml(lead.message || 'No additional campaign requirements specified.')}</div>
          </div>
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Inquiry Status</label>
            <select class="filter-select" style="padding:9px 12px; font-weight:700; width:100%;" onchange="window.updateLeadStatus('ledLeads','${lead.id}',this.value); closeModal(document.getElementById('ledDetailModal'));">
              <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New (Uncontacted)</option>
              <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
              <option value="won" ${lead.status === 'won' ? 'selected' : ''}>Won / Booked Campaign</option>
              <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost / Declined</option>
            </select>
          </div>
        </div>
      </div>
    `;
    openModal(modal);
  }
  window.openLedDetails = openLedDetails;

  // ── 4. ACTIVATIONS CALENDAR & LEADS RENDER ──────────────────
  function renderActivationCalendar() {
    const titleEl = document.getElementById('activationCalTitle');
    const gridEl  = document.getElementById('activationCalGrid');
    if (!gridEl || !titleEl) return;

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const curYear  = calCurrentDate.getFullYear();
    const curMonth = calCurrentDate.getMonth();

    titleEl.textContent = `${months[curMonth]} ${curYear}`;

    const firstDayIndex = new Date(curYear, curMonth, 1).getDay();
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    const prevDaysInMonth = new Date(curYear, curMonth, 0).getDate();

    gridEl.innerHTML = '';

    const today = new Date(2026, 7, 31);
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

    // Trailing cells for next month
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

    const search       = document.getElementById('activationSearchInput')?.value.toLowerCase().trim() || '';
    const filterStatus = document.getElementById('activationStatusFilter')?.value || 'all';
    const sortMode     = document.getElementById('activationSortSelect')?.value || 'date-asc';

    let list = activLeadsCache.filter(l => {
      const matchesSearch = !search ||
        (l.companyName  && l.companyName.toLowerCase().includes(search)) ||
        (l.businessName && l.businessName.toLowerCase().includes(search)) ||
        (l.contactName  && l.contactName.toLowerCase().includes(search)) ||
        (l.applicantName&& l.applicantName.toLowerCase().includes(search)) ||
        (l.phone        && l.phone.toLowerCase().includes(search)) ||
        (l.activationType && l.activationType.toLowerCase().includes(search));
      const matchesStatus = filterStatus === 'all' || (l.status || 'new') === filterStatus;
      return matchesSearch && matchesStatus;
    });

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

    const search       = document.getElementById('contactSearchInput')?.value.toLowerCase().trim() || '';
    const filterStatus = document.getElementById('contactStatusFilter')?.value || 'all';

    let list = contactLeadsCache.filter(l => {
      const matchesSearch = !search ||
        (l.name    && l.name.toLowerCase().includes(search)) ||
        (l.email   && l.email.toLowerCase().includes(search)) ||
        (l.phone   && l.phone.toLowerCase().includes(search)) ||
        (l.subject && l.subject.toLowerCase().includes(search)) ||
        (l.message && l.message.toLowerCase().includes(search));
      const matchesStatus = filterStatus === 'all' || (l.status || 'new') === filterStatus;
      return matchesSearch && matchesStatus;
    });

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No inquiries match your search. Submissions from the <a href="../about-us.html#contact" target="_blank" style="color:var(--coral);font-weight:600;">Public Contact Form ↗</a> appear here.</td></tr>`;
      return;
    }

    list.forEach(lead => {
      const tr = document.createElement('tr');
      const statusVal = lead.status || 'new';
      tr.innerHTML = `
        <td><strong style="color:var(--admin-text);font-size:13.5px;">${escHtml(lead.name || 'Visitor')}</strong></td>
        <td>
          <div style="font-size:13px;font-weight:700;color:var(--admin-text);">${escHtml(lead.phone || '—')}</div>
          ${lead.email ? `<small style="color:var(--admin-text-muted);">${escHtml(lead.email)}</small>` : ''}
        </td>
        <td><span class="admin-badge">${escHtml(lead.subject || 'General')}</span></td>
        <td>
          <div style="max-width:280px;font-size:13px;color:var(--admin-text);line-height:1.4;word-break:break-word;" title="${escHtml(lead.message || '')}">${escHtml(lead.message || '—')}</div>
        </td>
        <td>
          <select class="filter-select" style="padding:6px 10px;font-size:12px;font-weight:600;" onchange="window.updateLeadStatus('contactLeads','${lead.id}',this.value)">
            <option value="new" ${statusVal === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="closed" ${statusVal === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
        <td>
          <div class="td-actions">
            <button class="btn-secondary btn-sm" onclick="window.openContactDetails('${lead.id}')">View</button>
            <button class="btn-danger btn-sm" onclick="window.deleteLead('contactLeads','${lead.id}')">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function openContactDetails(leadId) {
    const lead = contactLeadsCache.find(l => l.id === leadId);
    if (!lead) return;
    const body = document.getElementById('contactModalBody');
    const modal = document.getElementById('contactDetailModal');
    if (!body || !modal) return;

    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="background:var(--coral-light); padding:16px; border-radius:12px; border:1px solid rgba(255,107,71,0.2);">
          <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--coral);">Inquiry From</span>
          <h3 style="margin:4px 0 0; font-size:20px; font-weight:800; color:var(--admin-text); word-break:break-word;">${escHtml(lead.name || 'Website Visitor')}</h3>
          <p style="margin:2px 0 0; font-size:13px; color:var(--admin-text-muted);">Subject: <strong>${escHtml(lead.subject || 'General Inquiry')}</strong></p>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Phone Number</label>
            <div style="font-size:14px; font-weight:700; color:var(--admin-text);">${escHtml(lead.phone || '—')}</div>
          </div>
          <div class="form-group">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Email Address</label>
            <div style="font-size:14px; font-weight:600; color:var(--admin-text); word-break:break-all;">${escHtml(lead.email || '—')}</div>
          </div>
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Full Message Content</label>
            <div style="font-size:13.5px; color:var(--admin-text); background:#F8FAFC; padding:14px; border-radius:8px; border:1px solid var(--admin-border); line-height:1.6; word-break:break-word; white-space:pre-wrap;">${escHtml(lead.message || 'No message content provided.')}</div>
          </div>
          <div class="form-group col-2">
            <label style="font-size:11px; text-transform:uppercase; color:var(--admin-text-muted);">Inquiry Status</label>
            <select class="filter-select" style="padding:9px 12px; font-weight:700; width:100%;" onchange="window.updateLeadStatus('contactLeads','${lead.id}',this.value); closeModal(document.getElementById('contactDetailModal'));">
              <option value="new" ${lead.status === 'new' ? 'selected' : ''}>New (Awaiting Response)</option>
              <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted / In Progress</option>
              <option value="closed" ${lead.status === 'closed' ? 'selected' : ''}>Resolved / Closed</option>
            </select>
          </div>
        </div>
      </div>
    `;
    openModal(modal);
  }
  window.openContactDetails = openContactDetails;

  window.updateLeadStatus = function(collName, id, status) {
    const map = { ledLeads: ledLeadsCache, activationLeads: activLeadsCache, contactLeads: contactLeadsCache };
    const lead = (map[collName] || []).find(l => l.id === id);
    if (lead) {
      lead.status = status;
      if (collName === 'ledLeads') localStorage.setItem('mombasa_live_led_leads', JSON.stringify(ledLeadsCache));
      if (collName === 'activationLeads') localStorage.setItem('mombasa_live_activation_leads', JSON.stringify(activLeadsCache));
      if (collName === 'contactLeads') localStorage.setItem('mombasa_live_contact_leads', JSON.stringify(contactLeadsCache));
      broadcastChange(`update_status_${collName}`, id);
      updateAllBadges(); updateOverviewMetrics(); renderCurrentTab();
      showToast('Status saved; synchronizing with cloud.', 'info');
  
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
    broadcastChange(`delete_${collName}`, id);
    showToast('Record deleted', 'success');

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

    const search     = document.getElementById('eventSearchInput')?.value.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('eventTypeFilter')?.value || 'all';

    let list = eventsCache.filter(e => {
      const matchesSearch = !search ||
        (e.title   && e.title.toLowerCase().includes(search)) ||
        (e.venue   && e.venue.toLowerCase().includes(search)) ||
        (e.details && e.details.toLowerCase().includes(search)) ||
        (e.summary && e.summary.toLowerCase().includes(search));
      const matchesType = typeFilter === 'all' || (e.type || 'upcoming') === typeFilter;
      return matchesSearch && matchesType;
    });

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No events scheduled yet. Add your first event!</td></tr>`;
      return;
    }

    list.forEach(evt => {
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
    broadcastChange('delete_event', id);
    showToast('Event deleted', 'success');

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
    broadcastChange('delete_blog', id);
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
    broadcastChange('toggle_review', id);
    showToast(`Review ${approveStatus ? 'Approved' : 'Unapproved'}`, 'info');
  };

  window.deleteReview = function(id) {
    if (!confirm('Delete this review?')) return;
    reviewsCache = reviewsCache.filter(r => r.id !== id);
    localStorage.setItem('mombasa_live_reviews', JSON.stringify(reviewsCache));
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
    updateOverviewMetrics();
    renderReviews();
    broadcastChange('delete_review', id);
    showToast('Review deleted', 'success');
  };

  // ── 9. USERS & ROLES RENDER ────────────────────────────────
  function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = document.getElementById('userSearchInput')?.value.toLowerCase().trim() || '';
    const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
    const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';

    let filtered = usersCache.filter(u => {
      const matchQuery = !query ||
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.role && u.role.toLowerCase().includes(query));

      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      const matchStatus = statusFilter === 'all' || u.status === statusFilter;

      return matchQuery && matchRole && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No system users found matching current filters.</td></tr>`;
      return;
    }

    const roleBadges = {
      superadmin: '<span class="status-pill status-approved" style="font-weight:700;">Super Admin</span>',
      admin:      '<span class="status-pill status-contacted" style="font-weight:700;">Administrator</span>',
      editor:     '<span class="status-pill status-new" style="font-weight:700;">Editor</span>',
      moderator:  '<span class="status-pill" style="background:#f1f5f9; color:#475569; font-weight:700;">Moderator</span>'
    };

    const rolePerms = {
      superadmin: 'Full unrestricted control • Roles & settings',
      admin:      'Stores, media, events, leads & reviews',
      editor:     'Blog articles, calendar events & directory',
      moderator:  'Customer inquiries, bookings & reviews'
    };

    filtered.forEach(usr => {
      const initials = (usr.name || 'User')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      const isActive = usr.status === 'active';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, var(--coral, #FF6F59), #246b9e); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px;">
            ${escHtml(initials)}
          </div>
        </td>
        <td>
          <strong style="color:var(--admin-text); display:block; font-size:14px;">${escHtml(usr.name || 'Unnamed')}</strong>
          <span style="font-size:12px; color:var(--admin-text-muted); display:block;">${escHtml(usr.email || '')}</span>
          ${usr.phone ? `<span style="font-size:11.5px; color:var(--admin-text-muted);">${escHtml(usr.phone)}</span>` : ''}
        </td>
        <td>
          ${roleBadges[usr.role] || `<span class="status-pill">${escHtml(usr.role)}</span>`}
        </td>
        <td>
          <span style="font-size:12px; color:var(--admin-text);">${rolePerms[usr.role] || 'Standard Access'}</span>
        </td>
        <td>
          <span class="status-pill ${isActive ? 'approved' : 'lost'}">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <span style="font-size:12px; color:var(--admin-text); display:block;">Created: ${formatDate(usr.createdAt)}</span>
          <span style="font-size:11.5px; color:var(--admin-text-muted);">Active: ${formatDate(usr.lastLogin || usr.createdAt)}</span>
        </td>
        <td>
          <div class="td-actions">
            <button class="btn-secondary btn-sm" onclick="window.editUser('${usr.id}')" title="Edit user details & permissions">Edit</button>
            <button class="btn-danger btn-sm" onclick="window.deleteUser('${usr.id}')" title="Remove user account" ${usr.role === 'superadmin' ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
  window.renderUsers = renderUsers;

  window.editUser = function(id) {
    const user = usersCache.find(u => u.id === id);
    if (!user) return;
    editingUserId = id;

    document.getElementById('userDocId').value = user.id;
    document.getElementById('userNameInput').value = user.name || '';
    document.getElementById('userEmailInput').value = user.email || '';
    document.getElementById('userPasswordInput').value = '';
    document.getElementById('userPhoneInput').value = user.phone || '';
    document.getElementById('userRoleInput').value = user.role || 'editor';
    document.getElementById('userStatusInput').value = user.status || 'active';

    updateRolePermissionsHelp(user.role || 'editor');

    document.getElementById('userModalTitle').textContent = `Edit User: ${user.name}`;
    document.getElementById('saveUserBtn').textContent = 'Update User';
    openModal(document.getElementById('userModal'));
  };

  window.deleteUser = function(id) {
    const target = usersCache.find(u => u.id === id);
    if (!target) return;
    if (target.role === 'superadmin') {
      showToast('The primary Super Administrator account cannot be deleted.', 'warning');
      return;
    }
    if (!confirm(`Are you sure you want to remove user "${target.name}" (${target.email})?`)) return;

    usersCache = usersCache.filter(u => u.id !== id);
    localStorage.setItem('mombasa_live_users', JSON.stringify(usersCache));
    updateCountBadge('usersCountBadge', usersCache.length);
    renderUsers();
    broadcastChange('delete_user', id);
    showToast(`User "${target.name}" removed`, 'success');
  };

  function updateRolePermissionsHelp(role) {
    const helpBox = document.getElementById('rolePermissionsSummary');
    if (!helpBox) return;
    const summaries = {
      superadmin: '<strong>Super Admin:</strong> Full unrestricted access to all modules, including user creation, database backups &amp; settings.',
      admin:      '<strong>Administrator:</strong> Can manage store directory, media gallery, events, leads, customer inquiries &amp; reviews.',
      editor:     '<strong>Editor / Content Manager:</strong> Can write &amp; publish blog articles, update calendar events &amp; modify store entries.',
      moderator:  '<strong>Moderator:</strong> Can view, manage &amp; update status for LED leads, activations, contact submissions &amp; testimonials.'
    };
    helpBox.innerHTML = summaries[role] || summaries.editor;
  }

  // ── ATTACH EVENT LISTENERS ─────────────────────────────────
  function attachEventListeners() {
    // 1. Navigation clicks
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    document.querySelectorAll('[data-goto-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.gotoTab));
    });

    // 2. Real-time Search & Filter Handlers with Instant Updates
    ['shopSearchInput', 'shopFloorFilter', 'shopCategoryFilter'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', renderShops);
      el?.addEventListener('change', renderShops);
    });

    ['ledSearchInput', 'ledStatusFilter'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', renderLedLeads);
      el?.addEventListener('change', renderLedLeads);
    });

    ['activationSearchInput', 'activationStatusFilter', 'activationSortSelect'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', renderActivationLeads);
      el?.addEventListener('change', renderActivationLeads);
    });

    ['contactSearchInput', 'contactStatusFilter'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', renderContactLeads);
      el?.addEventListener('change', renderContactLeads);
    });

    ['eventSearchInput', 'eventTypeFilter'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', renderEvents);
      el?.addEventListener('change', renderEvents);
    });

    ['userSearchInput', 'userRoleFilter', 'userStatusFilter'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener('input', renderUsers);
      el?.addEventListener('change', renderUsers);
    });

    // 3. CSV Export Triggers
    document.getElementById('exportUsersCsvBtn')?.addEventListener('click', () => {
      const rows = usersCache.map(u => ({
        Name: u.name,
        Email: u.email,
        Phone: u.phone || '—',
        Role: u.role,
        Status: u.status,
        CreatedAt: u.createdAt,
        LastLogin: u.lastLogin || '—'
      }));
      exportToCSV('Mombasa_Mall_System_Users', rows);
    });
    document.getElementById('exportShopsCsvBtn')?.addEventListener('click', () => {
      const rows = shopsCache.map(s => ({
        Name: s.name,
        Room: s.room,
        Floor: s.floor,
        Category: s.category,
        Phone: s.phone,
        Email: s.email,
        Social: s.socialHandle,
        Status: s.isActive !== false ? 'Active' : 'Inactive'
      }));
      exportToCSV('Mombasa_Mall_Stores', rows);
    });

    document.getElementById('exportLedCsvBtn')?.addEventListener('click', () => {
      const rows = ledLeadsCache.map(l => ({
        Brand: l.businessName || l.companyName,
        Contact: l.contactName || l.applicantName,
        Phone: l.phone,
        Email: l.email,
        ScreenPackage: l.packageRequested || l.screenType,
        Duration: l.durationRequested || (l.durationMonths ? `${l.durationMonths} Month(s)` : '1 Month'),
        EstimatedBudget: l.estimatedCost || '—',
        Status: l.status || 'new',
        Notes: l.message || ''
      }));
      exportToCSV('Mombasa_Mall_LED_Leads', rows);
    });

    document.getElementById('exportActivationsCsvBtn')?.addEventListener('click', () => {
      const rows = activLeadsCache.map(a => ({
        Company: a.companyName || a.businessName,
        Contact: a.contactName || a.applicantName,
        Phone: a.phone,
        Email: a.email,
        SpaceType: a.activationType,
        StartDate: a.bookingStartDate,
        DurationDays: a.durationDays,
        Status: a.status || 'new',
        Requirements: a.message || ''
      }));
      exportToCSV('Mombasa_Mall_Activation_Bookings', rows);
    });

    document.getElementById('exportContactCsvBtn')?.addEventListener('click', () => {
      const rows = contactLeadsCache.map(c => ({
        Name: c.name,
        Phone: c.phone,
        Email: c.email,
        Subject: c.subject,
        Message: c.message,
        Status: c.status || 'new'
      }));
      exportToCSV('Mombasa_Mall_Contact_Inquiries', rows);
    });

    document.getElementById('exportEventsCsvBtn')?.addEventListener('click', () => {
      const rows = eventsCache.map(e => ({
        Title: e.title,
        Venue: e.venue,
        Date: e.eventDate || e.date,
        Time: e.eventTime || e.time,
        Type: e.type,
        Summary: e.details || e.summary
      }));
      exportToCSV('Mombasa_Mall_Events', rows);
    });

    // 4. JSON Backup & Restore Suite
    document.getElementById('backupAllDataBtn')?.addEventListener('click', downloadJSONBackup);

    const restoreFileInput = document.getElementById('restoreBackupFile');
    document.getElementById('restoreBackupBtn')?.addEventListener('click', () => restoreFileInput?.click());
    restoreFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        restoreFromJSON(evt.target.result);
        restoreFileInput.value = '';
      };
      reader.readAsText(file);
    });

    // 5. Calendar Navigation
    document.getElementById('calPrevBtn')?.addEventListener('click', () => {
      calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() - 1, 1);
      renderActivationCalendar();
    });
    document.getElementById('calNextBtn')?.addEventListener('click', () => {
      calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth() + 1, 1);
      renderActivationCalendar();
    });
    document.getElementById('calTodayBtn')?.addEventListener('click', () => {
      calCurrentDate = new Date(2026, 7, 1);
      renderActivationCalendar();
    });

    // 6. Modals - Shop Form
    const shopModal = document.getElementById('shopModal');
    const shopForm  = document.getElementById('shopForm');
    document.getElementById('openAddShopBtn')?.addEventListener('click', () => {
      shopForm.reset();
      document.getElementById('shopDocId').value = '';
      pendingShopLogo = null;
      currentShopPhotos = [];
      const logoImg = document.getElementById('shopLogoPreviewImg');
      if (logoImg) logoImg.src = '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
      renderShopPhotosPreview();
      document.getElementById('shopModalTitle').textContent = 'Add New Store / Unit';
      document.getElementById('shopIsActiveInput').checked = true;
      openModal(shopModal);
    });
    document.getElementById('closeShopModalBtn')?.addEventListener('click', () => closeModal(shopModal));
    document.getElementById('cancelShopBtn')?.addEventListener('click', () => closeModal(shopModal));

    // Store Logo File Picker
    const shopLogoFileInput = document.getElementById('shopLogoFileInput');
    shopLogoFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          pendingShopLogo = await readFileAsDataUrl(file);
          const logoImg = document.getElementById('shopLogoPreviewImg');
          if (logoImg) logoImg.src = pendingShopLogo;
          const logoTxt = document.getElementById('shopLogoPreviewText');
          if (logoTxt) logoTxt.textContent = `Selected: ${file.name}`;
        } catch (err) {}
      }
    });

    // Store Multiple Photos Picker
    const shopPhotosFileInput = document.getElementById('shopPhotoFileInput');
    document.getElementById('addShopPhotoBtn')?.addEventListener('click', () => {
      shopPhotosFileInput?.click();
    });
    shopPhotosFileInput?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      for (const file of files) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          currentShopPhotos.push(dataUrl);
        } catch (err) {}
      }
      shopPhotosFileInput.value = '';
      renderShopPhotosPreview();
      showToast(`Added ${files.length} photo(s) to store showcase`, 'info');
    });

    // Store Photos by URL
    document.getElementById('addShopPhotoUrlBtn')?.addEventListener('click', () => {
      const input = document.getElementById('shopPhotoUrlAddInput');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('Please enter a photo URL or asset path', 'warning');
        return;
      }
      currentShopPhotos.push(val);
      if (input) input.value = '';
      renderShopPhotosPreview();
      showToast('Photo added to showcase', 'info');
    });

    shopForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveShopBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

      const docId = document.getElementById('shopDocId').value.trim();
      const logoUrl = pendingShopLogo || document.getElementById('shopLogoUrlInput').value.trim() || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';

      const data = {
        name:           document.getElementById('shopNameInput').value.trim(),
        category:       document.getElementById('shopCategoryInput').value,
        floor:          document.getElementById('shopFloorInput').value,
        room:           document.getElementById('shopRoomInput').value.trim(),
        phone:          document.getElementById('shopPhoneInput').value.trim(),
        email:          document.getElementById('shopEmailInput').value.trim(),
        socialHandle:   document.getElementById('shopSocialInput').value.trim(),
        socialMediaUrl: document.getElementById('shopSocialMediaUrl').value.trim(),
        logoUrl:        logoUrl,
        logo:           logoUrl,
        photoUrls:      [...currentShopPhotos],
        photo:          currentShopPhotos[0] || '',
        description:    document.getElementById('shopDescInput').value.trim(),
        isActive:       document.getElementById('shopIsActiveInput').checked,
        updatedAt:      new Date().toISOString()
      };

      if (docId) {
        data.id = docId;
        const idx = shopsCache.findIndex(s => s.id === docId);
        if (idx >= 0) shopsCache[idx] = { ...shopsCache[idx], ...data };
        showToast(`Saved "${data.name}"; synchronizing with cloud.`, 'success');
      } else {
        data.id = (data.room ? data.room.toLowerCase().replace(/[^a-z0-9]/g, '-') : data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')) || `shop-${Date.now()}`;
        data.createdAt = new Date().toISOString();
        shopsCache.push(data);
        showToast(`Saved store "${data.name}"; synchronizing with cloud.`, 'success');
      }

      pendingShopLogo = null;
      currentShopPhotos = [];
      closeModal(shopModal);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Store'; }
      localStorage.setItem('mombasa_live_shops', JSON.stringify(shopsCache));
      updateCountBadge('shopsCountBadge', shopsCache.length);
      updateOverviewMetrics();
      renderShops();
      broadcastChange('save_shop', data.id);

  
    });

    // 7. Modals - Event
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
        data.id = editingEventId;
        const idx = eventsCache.findIndex(e => e.id === editingEventId);
        if (idx >= 0) eventsCache[idx] = { ...eventsCache[idx], ...data };
        showToast('Event saved; synchronizing with cloud.', 'success');
      } else {
        data.id = `evt-${Date.now()}`;
        data.createdAt = new Date().toISOString();
        eventsCache.unshift(data);
        showToast('Event saved; synchronizing with cloud.', 'success');
      }

      editingEventId = null;
      closeModal(eventModal);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Event'; }
      localStorage.setItem('mombasa_live_events', JSON.stringify(eventsCache));
      updateCountBadge('eventsCountBadge', eventsCache.length);
      updateOverviewMetrics();
      renderEvents();
      broadcastChange('save_event', data.id);

  
    });

    // 8. Modals - Blog
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
        showToast('Article saved; synchronizing with cloud.', 'success');
      } else {
        data.id = slug;
        blogCache.unshift(data);
        showToast('Article saved; synchronizing with cloud.', 'success');
      }
      const savedBlogId = editingBlogId || data.id;
      editingBlogId = null;
      closeModal(blogModal);
      localStorage.setItem('mombasa_live_blog', JSON.stringify(blogCache));
      updateCountBadge('blogCountBadge', blogCache.length);
      renderBlog();
      broadcastChange('save_blog', savedBlogId);
    });

    // 9. Modals - Gallery
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
          galleryPreviewName.textContent = `${file.name} (Optimized)`;
          galleryPreview.style.display = 'flex';
        } catch(err) {}
      }
    });

    document.getElementById('galleryForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveGalleryBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Optimizing & Uploading…'; }

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
      localStorage.setItem('mombasa_live_gallery', JSON.stringify(galleryCache));
      showToast('Photo added to gallery', 'success');
      broadcastChange('save_gallery', newDoc.id);

  
    });

    // Synchronize acknowledged writes rather than just refreshing browser storage.
    document.getElementById('syncLiveSiteBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('syncLiveSiteBtn');
      const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Synchronizing…';
      try {
        await flushCloudChanges();
        syncWithFirestoreCloud();
        showToast('Pending changes synchronized with the database.', 'success');
      } catch (error) { showToast('Synchronization failed: ' + error.message, 'error'); }
      finally { btn.disabled = false; btn.innerHTML = label; }
    });
    document.getElementById('seedDatabaseBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('seedDatabaseBtn');
      if (!confirm('Upload the current content to the live database? Existing records with matching IDs will be replaced.')) return;
      btn.disabled = true;
      const log = document.getElementById('seedProgressLog');
      if (log) { log.style.display = 'block'; log.textContent = 'Uploading content…'; }
      try {
        if (!fb.auth?.currentUser) throw new Error('Sign in to Firebase first.');
        await flushCloudChanges();
        const { seedFirestoreDatabase } = await import('../js/seed-data.js');
        await seedFirestoreDatabase(message => { if (log) log.textContent = message; });
        syncWithFirestoreCloud();
        if (log) log.textContent = 'Content successfully uploaded to the database.';
      } catch (error) { if (log) log.textContent = 'Upload failed: ' + error.message; }
      finally { btn.disabled = false; }
    });

    // 12. Modals - User & Role Management
    const userModal = document.getElementById('userModal');
    const userForm  = document.getElementById('userForm');

    document.getElementById('openAddUserBtn')?.addEventListener('click', () => {
      userForm.reset();
      editingUserId = null;
      document.getElementById('userDocId').value = '';
      document.getElementById('userRoleInput').value = 'editor';
      document.getElementById('userStatusInput').value = 'active';
      document.getElementById('userPasswordInput').required = false;
      document.getElementById('userPasswordHelp').textContent = 'Manage sign-in accounts in Firebase Authentication. This form saves staff profile details only.';
      document.getElementById('userModalTitle').textContent = 'Add New System User';
      document.getElementById('saveUserBtn').textContent = 'Create User Account';
      updateRolePermissionsHelp('editor');
      openModal(userModal);
    });

    document.getElementById('closeUserModalBtn')?.addEventListener('click', () => {
      editingUserId = null;
      closeModal(userModal);
    });

    document.getElementById('cancelUserBtn')?.addEventListener('click', () => {
      editingUserId = null;
      closeModal(userModal);
    });

    document.getElementById('userRoleInput')?.addEventListener('change', (e) => {
      updateRolePermissionsHelp(e.target.value);
    });

    userForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('saveUserBtn');
      const docId = document.getElementById('userDocId').value.trim();
      const name = document.getElementById('userNameInput').value.trim();
      const email = document.getElementById('userEmailInput').value.trim().toLowerCase();

      const phone = document.getElementById('userPhoneInput').value.trim();
      const role = document.getElementById('userRoleInput').value;
      const status = document.getElementById('userStatusInput').value;

      // Duplicate email check
      const duplicate = usersCache.find(u => u.email.toLowerCase() === email && u.id !== docId);
      if (duplicate) {
        showToast('A user with this email address already exists.', 'error');
        return;
      }



      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

      const now = new Date().toISOString();
      const userData = {
        name,
        email,
        phone,
        role,
        status,
        updatedAt: now
      };

      if (docId) {
        userData.id = docId;
        const idx = usersCache.findIndex(u => u.id === docId);
        if (idx >= 0) {
          usersCache[idx] = { ...usersCache[idx], ...userData };

        }
        showToast(`Updated user "${name}" successfully!`, 'success');
      } else {
        userData.id = `usr-${Date.now()}`;
        userData.createdAt = now;
        userData.lastLogin = null;
        usersCache.unshift(userData);
        showToast(`Saved staff profile for "${name}". Configure sign-in access in Firebase Authentication.`, 'success');
      }

      closeModal(userModal);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save User'; }
      localStorage.setItem('mombasa_live_users', JSON.stringify(usersCache));
      updateCountBadge('usersCountBadge', usersCache.length);
      renderUsers();
      broadcastChange('save_user', userData.id);
    });

    // 13. Password Modal
    const changePwdModal = document.getElementById('changePasswordModal');
    document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => openModal(changePwdModal));
    document.getElementById('closeChangePasswordBtn')?.addEventListener('click', () => closeModal(changePwdModal));
    document.getElementById('cancelChangePasswordBtn')?.addEventListener('click', () => closeModal(changePwdModal));
    document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('newPassword').value;
      const p2 = document.getElementById('confirmPassword').value;
      if (p1.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
      if (p1 !== p2) { showToast('Passwords do not match', 'error'); return; }
      try {
        if (!fb.auth?.currentUser) throw new Error('Please sign in first.');
        await fb.authMod.updatePassword(fb.auth.currentUser, p1);
      } catch (error) { showToast('Password change failed: ' + error.message + '. Sign in again if required.', 'error'); return; }
      showToast('Password updated successfully', 'success');
      closeModal(changePwdModal);
      e.target.reset();
    });

    // 13. Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      if (confirm('Sign out of the admin portal?')) {
        if (fb.auth) await fb.authMod.signOut(fb.auth);
        localStorage.removeItem('mombasa_admin_session');
        window.location.replace('./login.html');
      }
    });

    // 14. Mobile sidebar toggle & close
    document.getElementById('sidebarToggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.classList.toggle('sidebar-open');
    });

    document.getElementById('sidebarCloseBtn')?.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });

    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('sidebar-open')) {
        const sidebar = document.getElementById('adminSidebar');
        const toggleBtn = document.getElementById('sidebarToggle');
        if (sidebar && !sidebar.contains(e.target) && toggleBtn && !toggleBtn.contains(e.target)) {
          document.body.classList.remove('sidebar-open');
        }
      }
    });

    // 15. Detail Modals (LED & Contact & Activation)
    const ledDetailModal = document.getElementById('ledDetailModal');
    document.getElementById('closeLedModalBtn')?.addEventListener('click', () => closeModal(ledDetailModal));
    document.getElementById('closeLedDetailBtn')?.addEventListener('click', () => closeModal(ledDetailModal));

    const contactDetailModal = document.getElementById('contactDetailModal');
    document.getElementById('closeContactModalBtn')?.addEventListener('click', () => closeModal(contactDetailModal));
    document.getElementById('closeContactDetailBtn')?.addEventListener('click', () => closeModal(contactDetailModal));

    const actModal = document.getElementById('activationDetailModal');
    document.getElementById('closeActivationModalBtn')?.addEventListener('click', () => closeModal(actModal));
    document.getElementById('closeActivationDetailBtn')?.addEventListener('click', () => closeModal(actModal));

    // 16. Global modal dismiss on backdrop or escape
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(backdrop); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = document.querySelector('.modal-backdrop.is-open');
        if (open) closeModal(open);
      }
    });

    // 17. Real-Time Cross-Tab / Public Site Listener
    if (syncBus) {
      syncBus.onmessage = (e) => {
        if (e.data && e.data.action) {
          initData();
          renderCurrentTab();
          updateOverviewMetrics();
        }
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('mombasa_live_')) {
        initData();
        renderCurrentTab();
        updateOverviewMetrics();
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

  // Initialize once even when the script is loaded after DOM readiness.
  function startDashboard() {
    checkAuth(); initData(); attachEventListeners(); renderShops(); initCloudFirebase();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startDashboard, { once: true });
  else startDashboard();
})();
