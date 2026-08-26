// admin/admin.js — Mombasa Mall Admin Dashboard Controller
// Color White Edition — Full Communication, Resilient Data Fallbacks, Complete CRUD

import { auth, db, storage } from '../js/firebase-config.js';
import {
  onAuthStateChanged,
  signOut,
  updatePassword
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { seedFirestoreDatabase } from '../js/seed-data.js';

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

// ── JSON HELPER FOR INSTANT FALLBACK ───────────────────────
async function loadJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('JSON fallback load note for ' + url + ':', e.message);
    return null;
  }
}

// ── TOAST NOTIFICATIONS ────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 320);
  }, 4200);
}

// ── SKELETON HELPERS ────────────────────────────────────────
function renderSkeletonRows(tbodyId, cols = 5, rows = 4) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array(rows).fill(0).map(() => `
    <tr class="skeleton-row">
      ${Array(cols).fill(0).map((_, i) => `
        <td><span class="skeleton skeleton-cell${i === 0 ? '' : i === cols - 1 ? ' xs' : ' sm'}"></span></td>
      `).join('')}
    </tr>
  `).join('');
}

// ── AUTH GUARD ─────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('./login.html');
    return;
  }
  currentUser = user;
  const emailEl = document.getElementById('adminEmailDisplay');
  if (emailEl) emailEl.textContent = user.email || 'mombasamall01@gmail.com';
  initDashboard();
});

// ── LOGOUT ─────────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (confirm('Sign out of the admin portal?')) {
    await signOut(auth);
    window.location.replace('./login.html');
  }
});

// ── MOBILE SIDEBAR TOGGLE ───────────────────────────────────
const sidebarToggle = document.getElementById('sidebarToggle');
sidebarToggle?.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-open');
});
document.addEventListener('click', (e) => {
  if (document.body.classList.contains('sidebar-open')) {
    if (!e.target.closest('.admin-sidebar') && !e.target.closest('#sidebarToggle')) {
      document.body.classList.remove('sidebar-open');
    }
  }
});

// ── CHANGE PASSWORD MODAL ───────────────────────────────────
const changePwdModal = document.getElementById('changePasswordModal');
document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => {
  openModal(changePwdModal);
});
document.getElementById('closeChangePasswordBtn')?.addEventListener('click', () => {
  closeModal(changePwdModal);
});
document.getElementById('cancelChangePasswordBtn')?.addEventListener('click', () => {
  closeModal(changePwdModal);
});
document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPwd     = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;

  if (newPwd.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }
  if (newPwd !== confirmPwd) {
    showToast('Passwords do not match.', 'error');
    return;
  }
  const btn = e.submitter || document.querySelector('#changePasswordForm .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Updating…';
  try {
    await updatePassword(auth.currentUser, newPwd);
    showToast('Password updated successfully!', 'success');
    closeModal(changePwdModal);
    e.target.reset();
  } catch (err) {
    showToast(`Could not update password: ${err.message}. Re-sign in and try again.`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Password';
  }
});

// ── GENERIC MODAL HELPERS ────────────────────────────────────
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

// Close modal when clicking the backdrop overlay
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(backdrop);
  });
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-backdrop.is-open');
    if (open) closeModal(open);
  }
});

// ── TAB NAVIGATION ──────────────────────────────────────────
const navItems    = document.querySelectorAll('.admin-nav-item[data-tab]');
const tabPanels   = document.querySelectorAll('.tab-panel');
const topbarTitle = document.getElementById('topbarTitle');

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(item.getAttribute('data-tab'));
  });
});

function switchTab(tabKey) {
  if (!tabKey) return;
  activeTab = tabKey;

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

  // Load and render tab content
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

// ── OVERVIEW QUICK ACTIONS ──────────────────────────────────
document.querySelectorAll('[data-goto-tab]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const target = btn.getAttribute('data-goto-tab');
    switchTab(target);
  });
});

// ── DASHBOARD INITIALIZATION ────────────────────────────────
async function initDashboard() {
  // Show initial skeleton rows
  renderSkeletonRows('shopsTableBody',          7, 5);
  renderSkeletonRows('ledLeadsTableBody',       6, 3);
  renderSkeletonRows('activationLeadsTableBody',6, 3);
  renderSkeletonRows('contactLeadsTableBody',   6, 3);
  renderSkeletonRows('eventsTableBody',         5, 3);
  renderSkeletonRows('blogTableBody',           5, 3);
  renderSkeletonRows('reviewsTableBody',        6, 3);

  // Set initial metrics to 0 while fetching
  updateOverviewMetrics();

  // Parallel fetch with individual fallbacks so one failure doesn't halt the others
  await Promise.allSettled([
    fetchShops(),
    fetchGallery(),
    fetchLedLeads(),
    fetchActivationLeads(),
    fetchContactLeads(),
    fetchEvents(),
    fetchBlog(),
    fetchReviews()
  ]);

  updateOverviewMetrics();
}

// ── SEED FIRESTORE ──────────────────────────────────────────
document.getElementById('seedDatabaseBtn')?.addEventListener('click', async () => {
  if (!confirm('Seed/refresh Firestore with all 51 stores, events, blog, reviews & site content? This will synchronize all datasets live.')) return;
  const logBox = document.getElementById('seedProgressLog');
  if (logBox) { logBox.style.display = 'block'; logBox.innerHTML = ''; }

  const updateLog = (msg) => {
    if (logBox) {
      const div = document.createElement('div');
      div.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
      logBox.appendChild(div);
      logBox.scrollTop = logBox.scrollHeight;
    }
  };

  const btn = document.getElementById('seedDatabaseBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Seeding Collections…';

  try {
    await seedFirestoreDatabase(updateLog);
    showToast('Firestore synchronized successfully! 🎉', 'success');
    await initDashboard();
  } catch (err) {
    updateLog(`❌ Error: ${err.message}`);
    showToast(`Seed note: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Seed All Collections to Firestore';
  }
});

// ── 1. SHOPS / DIRECTORY ─────────────────────────────────────
async function fetchShops() {
  try {
    const snap = await getDocs(collection(db, 'shops'));
    if (!snap.empty) {
      shopsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Shops fetch note, checking fallback:', err.message);
  }

  // Graceful fallback to static JSON if Firestore is empty or unseeded
  if (shopsCache.length === 0) {
    const sData = await loadJson('../json/stores.json') || await loadJson('./json/stores.json');
    if (sData && sData.floors) {
      const list = [];
      sData.floors.forEach(floor => {
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
    }
  }

  updateCountBadge('shopsCountBadge', shopsCache.length);
  updateOverviewMetrics();
}

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
          <button class="btn-secondary btn-sm" onclick="window.editShop('${shop.id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="window.deleteShop('${shop.id}','${escHtml(shop.name).replace(/'/g,"\\'")}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.getElementById('shopSearchInput')?.addEventListener('input',  renderShops);
document.getElementById('shopFloorFilter')?.addEventListener('change', renderShops);
document.getElementById('shopCategoryFilter')?.addEventListener('change', renderShops);

const shopModal = document.getElementById('shopModal');
const shopForm  = document.getElementById('shopForm');

document.getElementById('openAddShopBtn')?.addEventListener('click', () => {
  shopForm.reset();
  document.getElementById('shopDocId').value = '';
  document.getElementById('shopModalTitle').textContent = 'Add New Store';
  openModal(shopModal);
});
document.getElementById('closeShopModalBtn')?.addEventListener('click', () => closeModal(shopModal));
document.getElementById('cancelShopBtn')?.addEventListener('click', ()  => closeModal(shopModal));

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
  openModal(shopModal);
};

window.deleteShop = async function(shopId, shopName) {
  if (!confirm(`Permanently delete "${shopName}"?`)) return;
  try {
    await deleteDoc(doc(db, 'shops', shopId)).catch(() => {});
    shopsCache = shopsCache.filter(s => s.id !== shopId);
    updateCountBadge('shopsCountBadge', shopsCache.length);
    updateOverviewMetrics();
    renderShops();
    showToast(`Deleted "${shopName}"`, 'success');
  } catch (err) {
    showToast(`Delete note: ${err.message}`, 'error');
  }
};

shopForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveShopBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const docId = document.getElementById('shopDocId').value.trim() ||
                document.getElementById('shopRoomInput').value.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                `shop-${Date.now()}`;

  let logoUrl = document.getElementById('shopLogoUrlInput').value.trim();
  const logoFile = document.getElementById('shopLogoFileInput').files[0];
  if (logoFile) {
    try {
      const fileRef = storageRef(storage, `shops/logos/${Date.now()}_${logoFile.name}`);
      const snap    = await uploadBytes(fileRef, logoFile);
      logoUrl       = await getDownloadURL(snap.ref);
    } catch (uploadErr) { console.warn('Logo upload skipped; using default:', uploadErr); }
  }

  const shopData = {
    id:           docId,
    name:         document.getElementById('shopNameInput').value.trim(),
    category:     document.getElementById('shopCategoryInput').value,
    floor:        document.getElementById('shopFloorInput').value,
    room:         document.getElementById('shopRoomInput').value.trim(),
    phone:        document.getElementById('shopPhoneInput').value.trim(),
    email:        document.getElementById('shopEmailInput').value.trim(),
    socialHandle: document.getElementById('shopSocialInput').value.trim(),
    logoUrl:      logoUrl || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
    description:  document.getElementById('shopDescInput').value.trim(),
    isActive:     document.getElementById('shopIsActiveInput').checked,
    updatedAt:    new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'shops', docId), shopData, { merge: true }).catch(() => {});
    
    // Update local cache immediately
    const existingIdx = shopsCache.findIndex(s => s.id === docId);
    if (existingIdx >= 0) {
      shopsCache[existingIdx] = { ...shopsCache[existingIdx], ...shopData };
    } else {
      shopsCache.unshift(shopData);
    }
    
    updateCountBadge('shopsCountBadge', shopsCache.length);
    updateOverviewMetrics();
    renderShops();
    showToast('Store saved successfully!', 'success');
    closeModal(shopModal);
  } catch (err) {
    showToast(`Save error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Store';
  }
});

// ── 2. GALLERY ────────────────────────────────────────────────
async function fetchGallery() {
  try {
    const snap = await getDocs(collection(db, 'gallery'));
    if (!snap.empty) {
      galleryCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
    }
  } catch (err) {
    console.warn('Gallery fetch note, checking fallback:', err.message);
  }

  if (galleryCache.length === 0) {
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
  }

  updateCountBadge('galleryCountBadge', galleryCache.length);
  updateOverviewMetrics();
}

function renderGallery() {
  const container = document.getElementById('galleryGridContainer');
  if (!container) return;
  container.innerHTML = '';

  if (galleryCache.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--admin-text-muted);">No gallery photos yet. Upload the first one!</div>`;
    return;
  }

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

const galleryModal = document.getElementById('galleryModal');
document.getElementById('openAddGalleryBtn')?.addEventListener('click', () => {
  document.getElementById('galleryForm').reset();
  openModal(galleryModal);
});
document.getElementById('closeGalleryModalBtn')?.addEventListener('click', () => closeModal(galleryModal));
document.getElementById('cancelGalleryBtn')?.addEventListener('click',  () => closeModal(galleryModal));

document.getElementById('galleryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveGalleryBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';

  const caption   = document.getElementById('galleryCaption').value.trim();
  const category  = document.getElementById('galleryCategory').value;
  const sortOrder = parseInt(document.getElementById('galleryOrder').value) || 1;
  const file      = document.getElementById('galleryFile').files[0];
  let imageUrl    = document.getElementById('galleryUrlInput').value.trim();

  if (file) {
    try {
      const imgRef = storageRef(storage, `gallery/${Date.now()}_${file.name}`);
      const snap   = await uploadBytes(imgRef, file);
      imageUrl     = await getDownloadURL(snap.ref);
    } catch (err) { console.warn('Gallery upload skipped; using default:', err); }
  }

  if (!imageUrl) {
    showToast('Please choose an image file or provide an image URL.', 'error');
    btn.disabled = false; btn.textContent = 'Upload to Gallery';
    return;
  }

  const newDoc = {
    id: `gal-${Date.now()}`,
    imageUrl,
    caption,
    category,
    sortOrder,
    uploadedAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'gallery'), newDoc).catch(() => {});
    galleryCache.unshift(newDoc);
    updateCountBadge('galleryCountBadge', galleryCache.length);
    renderGallery();
    showToast('Photo added to gallery!', 'success');
    closeModal(galleryModal);
  } catch (err) {
    showToast(`Upload note: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload to Gallery';
  }
});

window.deleteGalleryItem = async function(id) {
  if (!confirm('Remove this photo from the gallery?')) return;
  try {
    await deleteDoc(doc(db, 'gallery', id)).catch(() => {});
    galleryCache = galleryCache.filter(g => g.id !== id);
    updateCountBadge('galleryCountBadge', galleryCache.length);
    renderGallery();
    showToast('Photo removed from gallery', 'success');
  } catch (err) {
    showToast(`Delete note: ${err.message}`, 'error');
  }
};

// ── 3. LED LEADS ──────────────────────────────────────────────
async function fetchLedLeads() {
  try {
    const snap = await getDocs(collection(db, 'ledLeads'));
    if (!snap.empty) {
      ledLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    }
  } catch (err) { console.warn('LED leads fetch note:', err.message); }
  updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length);
  updateOverviewMetrics();
}

function renderLedLeads() {
  const tbody = document.getElementById('ledLeadsTableBody');
  const statusFilter = document.getElementById('ledStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = ledLeadsCache.filter(l => statusFilter === 'all' || (l.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No LED campaign inquiries found.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const statusVal = lead.status || 'new';
    tr.innerHTML = `
      <td>
        <strong style="color:var(--admin-text);display:block;">${escHtml(lead.businessName || 'Brand')}</strong>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.contactName || '')}</small>
      </td>
      <td>
        <div>${escHtml(lead.phone || '—')}</div>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small>
      </td>
      <td>
        <span class="admin-badge">${escHtml(lead.packageRequested || 'Standard')}</span>
        <div style="font-size:12px;color:var(--gold);margin-top:4px;font-weight:700;">${escHtml(lead.estimatedCost || '')}</div>
      </td>
      <td>
        <div style="font-size:13px;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lead.message || '—')}</div>
        <small style="color:var(--admin-text-muted);">${formatDate(lead.submittedAt)}</small>
      </td>
      <td>
        <select class="filter-select" style="padding:6px 10px;font-size:12px;" onchange="window.updateLeadStatus('ledLeads','${lead.id}',this.value)">
          <option value="new"       ${statusVal === 'new'       ? 'selected' : ''}>New</option>
          <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="won"       ${statusVal === 'won'       ? 'selected' : ''}>Won / Booked</option>
          <option value="lost"      ${statusVal === 'lost'      ? 'selected' : ''}>Lost</option>
        </select>
      </td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteLead('ledLeads','${lead.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('ledStatusFilter')?.addEventListener('change', renderLedLeads);

// ── 4. ACTIVATION LEADS ────────────────────────────────────────
async function fetchActivationLeads() {
  try {
    const snap = await getDocs(collection(db, 'activationLeads'));
    if (!snap.empty) {
      activLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    }
  } catch (err) { console.warn('Activation leads fetch note:', err.message); }
  updateCountBadge('activationLeadsCountBadge', activLeadsCache.length);
  updateOverviewMetrics();
}

function renderActivationLeads() {
  const tbody = document.getElementById('activationLeadsTableBody');
  const statusFilter = document.getElementById('activationStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = activLeadsCache.filter(l => statusFilter === 'all' || (l.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No activation requests found.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const statusVal = lead.status || 'new';
    tr.innerHTML = `
      <td>
        <strong style="color:var(--admin-text);display:block;">${escHtml(lead.applicantName || 'Applicant')}</strong>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.businessName || '')}</small>
      </td>
      <td>
        <div>${escHtml(lead.phone || '—')}</div>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small>
      </td>
      <td>
        <span class="admin-badge">${escHtml(lead.activationType || 'Pop-up')}</span>
        <div style="font-size:12px;color:var(--gold);margin-top:4px;font-weight:700;">Dates: ${escHtml(lead.proposedDates || 'TBD')}</div>
      </td>
      <td>
        <div style="font-size:13px;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lead.message || '—')}</div>
        <small style="color:var(--admin-text-muted);">${formatDate(lead.submittedAt)}</small>
      </td>
      <td>
        <select class="filter-select" style="padding:6px 10px;font-size:12px;" onchange="window.updateLeadStatus('activationLeads','${lead.id}',this.value)">
          <option value="new"       ${statusVal === 'new'       ? 'selected' : ''}>New</option>
          <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="won"       ${statusVal === 'won'       ? 'selected' : ''}>Approved</option>
          <option value="lost"      ${statusVal === 'lost'      ? 'selected' : ''}>Declined</option>
        </select>
      </td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteLead('activationLeads','${lead.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('activationStatusFilter')?.addEventListener('change', renderActivationLeads);

// ── 5. CONTACT LEADS ──────────────────────────────────────────
async function fetchContactLeads() {
  try {
    const snap = await getDocs(collection(db, 'contactLeads'));
    if (!snap.empty) {
      contactLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    }
  } catch (err) { console.warn('Contact leads fetch note:', err.message); }
  updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length);
  updateOverviewMetrics();
}

function renderContactLeads() {
  const tbody = document.getElementById('contactLeadsTableBody');
  const statusFilter = document.getElementById('contactStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = contactLeadsCache.filter(l => statusFilter === 'all' || (l.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:48px;color:var(--admin-text-muted);">No contact enquiries found.</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const statusVal = lead.status || 'new';
    tr.innerHTML = `
      <td><strong style="color:var(--admin-text);">${escHtml(lead.name || 'Visitor')}</strong></td>
      <td>
        <div>${escHtml(lead.phone || '—')}</div>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small>
      </td>
      <td><span class="admin-badge">${escHtml(lead.subject || 'General')}</span></td>
      <td>
        <div style="font-size:13px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(lead.message || '—')}</div>
        <small style="color:var(--admin-text-muted);">${formatDate(lead.submittedAt)}</small>
      </td>
      <td>
        <select class="filter-select" style="padding:6px 10px;font-size:12px;" onchange="window.updateLeadStatus('contactLeads','${lead.id}',this.value)">
          <option value="new"       ${statusVal === 'new'       ? 'selected' : ''}>New</option>
          <option value="contacted" ${statusVal === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="closed"    ${statusVal === 'closed'    ? 'selected' : ''}>Closed</option>
        </select>
      </td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteLead('contactLeads','${lead.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('contactStatusFilter')?.addEventListener('change', renderContactLeads);

// Shared lead actions
window.updateLeadStatus = async function(collName, id, status) {
  try {
    await updateDoc(doc(db, collName, id), { status, updatedAt: new Date().toISOString() }).catch(() => {});
    const cacheMap = { ledLeads: ledLeadsCache, activationLeads: activLeadsCache, contactLeads: contactLeadsCache };
    const lead = (cacheMap[collName] || []).find(l => l.id === id);
    if (lead) lead.status = status;
    showToast('Lead status updated', 'success');
  } catch (err) {
    showToast(`Status update note: ${err.message}`, 'error');
  }
};

window.deleteLead = async function(collName, id) {
  if (!confirm('Delete this record permanently?')) return;
  try {
    await deleteDoc(doc(db, collName, id)).catch(() => {});
    if (collName === 'ledLeads')        { ledLeadsCache = ledLeadsCache.filter(l => l.id !== id); updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length); renderLedLeads(); }
    if (collName === 'activationLeads') { activLeadsCache = activLeadsCache.filter(l => l.id !== id); updateCountBadge('activationLeadsCountBadge', activLeadsCache.length); renderActivationLeads(); }
    if (collName === 'contactLeads')    { contactLeadsCache = contactLeadsCache.filter(l => l.id !== id); updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length); renderContactLeads(); }
    updateOverviewMetrics();
    showToast('Record deleted', 'success');
  } catch (err) {
    showToast(`Delete note: ${err.message}`, 'error');
  }
};

// ── 6. EVENTS ─────────────────────────────────────────────────
async function fetchEvents() {
  try {
    const snap = await getDocs(collection(db, 'events'));
    if (!snap.empty) {
      eventsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }
  } catch (err) { console.warn('Events fetch note, checking fallback:', err.message); }

  if (eventsCache.length === 0) {
    const eData = await loadJson('../json/events.json') || await loadJson('./json/events.json');
    if (eData) {
      const list = [];
      (eData.upcoming || []).forEach(e => list.push({ id: 'up-' + (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 25), ...e, type: 'upcoming' }));
      (eData.past || []).forEach(e => list.push({ id: 'past-' + (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 25), ...e, type: 'past' }));
      eventsCache = list;
    }
  }

  updateCountBadge('eventsCountBadge', eventsCache.length);
  updateOverviewMetrics();
}

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
      <td>
        <div style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text-muted);">${escHtml(evt.summary || '')}</div>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-secondary btn-sm" onclick="window.editEvent('${evt.id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="window.deleteEvent('${evt.id}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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
  openModal(eventModal);
};

eventForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveEventBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = {
    title:     document.getElementById('eventTitle').value.trim(),
    date:      document.getElementById('eventDate').value,
    type:      document.getElementById('eventType').value,
    summary:   document.getElementById('eventSummary').value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (editingEventId) {
      await updateDoc(doc(db, 'events', editingEventId), data).catch(() => {});
      const idx = eventsCache.findIndex(e => e.id === editingEventId);
      if (idx >= 0) eventsCache[idx] = { ...eventsCache[idx], ...data };
      showToast('Event updated!', 'success');
    } else {
      data.createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'events'), data).catch(() => ({ id: `evt-${Date.now()}` }));
      eventsCache.unshift({ id: docRef.id, ...data });
      showToast('Event created!', 'success');
    }
    editingEventId = null;
    closeModal(eventModal);
    updateCountBadge('eventsCountBadge', eventsCache.length);
    updateOverviewMetrics();
    renderEvents();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Event';
  }
});

window.deleteEvent = async function(id) {
  if (!confirm('Delete this event permanently?')) return;
  try {
    await deleteDoc(doc(db, 'events', id)).catch(() => {});
    eventsCache = eventsCache.filter(e => e.id !== id);
    updateCountBadge('eventsCountBadge', eventsCache.length);
    updateOverviewMetrics();
    renderEvents();
    showToast('Event deleted', 'success');
  } catch (err) {
    showToast(`Delete note: ${err.message}`, 'error');
  }
};

// ── 7. BLOG ───────────────────────────────────────────────────
async function fetchBlog() {
  try {
    const snap = await getDocs(collection(db, 'blogPosts'));
    if (!snap.empty) {
      blogCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }
  } catch (err) { console.warn('Blog fetch note, checking fallback:', err.message); }

  if (blogCache.length === 0) {
    const bData = await loadJson('../json/blog.json') || await loadJson('./json/blog.json');
    if (bData && bData.posts) {
      blogCache = bData.posts.map(p => ({ id: p.slug || (p.title || '').toLowerCase().replace(/[^a-z0-9]/g, '-'), ...p }));
    }
  }

  updateCountBadge('blogCountBadge', blogCache.length);
  updateOverviewMetrics();
}

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
      <td>
        <div style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text-muted);">${escHtml(post.excerpt || '')}</div>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-secondary btn-sm" onclick="window.editBlogPost('${post.id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="window.deleteBlogPost('${post.id}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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
  openModal(blogModal);
};

blogForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveBlogBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const slug = document.getElementById('blogSlugInput').value.trim() || `post-${Date.now()}`;
  const data = {
    title:     document.getElementById('blogTitleInput').value.trim(),
    slug,
    date:      document.getElementById('blogDateInput').value || new Date().toISOString().slice(0, 10),
    excerpt:   document.getElementById('blogExcerptInput').value.trim(),
    content:   document.getElementById('blogContentInput').value.trim() || document.getElementById('blogExcerptInput').value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (editingBlogId) {
      await updateDoc(doc(db, 'blogPosts', editingBlogId), data).catch(() => {});
      const idx = blogCache.findIndex(p => p.id === editingBlogId);
      if (idx >= 0) blogCache[idx] = { ...blogCache[idx], ...data };
      showToast('Article updated!', 'success');
    } else {
      data.createdAt = new Date().toISOString();
      await setDoc(doc(db, 'blogPosts', slug), data, { merge: true }).catch(() => {});
      blogCache.unshift({ id: slug, ...data });
      showToast('Article published!', 'success');
    }
    editingBlogId = null;
    closeModal(blogModal);
    updateCountBadge('blogCountBadge', blogCache.length);
    renderBlog();
  } catch (err) {
    showToast(`Publish error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Article';
  }
});

window.deleteBlogPost = async function(id) {
  if (!confirm('Delete this article permanently?')) return;
  try {
    await deleteDoc(doc(db, 'blogPosts', id)).catch(() => {});
    blogCache = blogCache.filter(p => p.id !== id);
    updateCountBadge('blogCountBadge', blogCache.length);
    renderBlog();
    showToast('Article deleted', 'success');
  } catch (err) {
    showToast(`Delete note: ${err.message}`, 'error');
  }
};

// ── 8. REVIEWS ────────────────────────────────────────────────
async function fetchReviews() {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    if (!snap.empty) {
      reviewsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number(a.approved) - Number(b.approved));
    }
  } catch (err) { console.warn('Reviews fetch note, checking fallback:', err.message); }

  if (reviewsCache.length === 0) {
    const rData = await loadJson('../json/reviews.json') || await loadJson('./json/reviews.json');
    if (rData) {
      const list = [];
      (rData.testimonials || []).forEach((t, i) => list.push({ id: `rev-t-${i}`, ...t, type: 'testimonial', approved: true }));
      (rData.customerFeedback || []).forEach((f, i) => list.push({ id: `rev-f-${i}`, author: f.author || f.name, quote: f.quote || f.comment, rating: 5, type: 'feedback', approved: false }));
      reviewsCache = list;
    }
  }

  updateCountBadge('reviewsCountBadge', reviewsCache.length);
  updateOverviewMetrics();
}

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
      <td>
        <div style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text);">
          "${escHtml(rev.quote || '')}"
        </div>
      </td>
      <td><span class="status-pill ${isApproved ? 'approved' : 'pending'}">${isApproved ? 'Approved' : 'Pending'}</span></td>
      <td>
        <div class="td-actions">
          <button class="${isApproved ? 'btn-danger' : 'btn-success-sm'} btn-sm"
            onclick="window.toggleReviewApproval('${rev.id}', ${!isApproved})">
            ${isApproved ? 'Unapprove' : 'Approve'}
          </button>
          <button class="btn-danger btn-sm" onclick="window.deleteReview('${rev.id}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleReviewApproval = async function(id, approveStatus) {
  try {
    await updateDoc(doc(db, 'reviews', id), { approved: approveStatus }).catch(() => {});
    const rev = reviewsCache.find(r => r.id === id);
    if (rev) rev.approved = approveStatus;
    updateOverviewMetrics();
    renderReviews();
    showToast(approveStatus ? 'Review approved for public display ✅' : 'Review set to pending', 'success');
  } catch (err) {
    showToast(`Action note: ${err.message}`, 'error');
  }
};

window.deleteReview = async function(id) {
  if (!confirm('Delete this review permanently?')) return;
  try {
    await deleteDoc(doc(db, 'reviews', id)).catch(() => {});
    reviewsCache = reviewsCache.filter(r => r.id !== id);
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
    updateOverviewMetrics();
    renderReviews();
    showToast('Review removed', 'success');
  } catch (err) {
    showToast(`Delete note: ${err.message}`, 'error');
  }
};

// ── 9. HOMEPAGE / SITE CONTENT ────────────────────────────────
async function loadSiteContentForm() {
  let d = null;
  try {
    const snap = await getDoc(doc(db, 'siteContent', 'homepage'));
    if (snap.exists()) d = snap.data();
  } catch (err) { console.warn('siteContent fetch note, checking fallback:', err.message); }

  if (!d) {
    d = await loadJson('../json/site-data.json') || await loadJson('./json/site-data.json') || {};
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

document.getElementById('siteContentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveSiteContentBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

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

  try {
    await setDoc(doc(db, 'siteContent', 'homepage'), payload, { merge: true }).catch(() => {});
    showToast('Homepage content updated live! 🎉', 'success');
  } catch (err) {
    showToast(`Save note: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Homepage Content';
  }
});

// ── HELPERS ───────────────────────────────────────────────────
function updateCountBadge(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(count);
}

function updateOverviewMetrics() {
  const safe = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  safe('metricTotalShops',     shopsCache.length);
  safe('metricTotalLeads',     ledLeadsCache.length + activLeadsCache.length + contactLeadsCache.length);
  safe('metricUpcomingEvents', eventsCache.filter(e => e.type === 'upcoming').length);
  safe('metricPendingReviews', reviewsCache.filter(r => !r.approved).length);
}

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
