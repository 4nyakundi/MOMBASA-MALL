// admin/admin.js — Mombasa Mall Admin Dashboard Controller
// Deep Polish Edition — all CRUD complete, modals closeable, edit for events/blog, skeletons

import { auth, db, storage } from '../js/firebase-config.js';
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { seedFirestoreDatabase } from '../js/seed-data.js';

// ── STATE ──────────────────────────────────────────────────
let currentUser     = null;
let activeTab       = 'overview';
let shopsCache      = [];
let galleryCache    = [];
let ledLeadsCache   = [];
let activLeadsCache = [];
let contactLeadsCache = [];
let eventsCache     = [];
let blogCache       = [];
let reviewsCache    = [];
let editingEventId  = null;
let editingBlogId   = null;

// ── TOAST ──────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.35s, transform 0.35s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 360);
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
  if (emailEl) emailEl.textContent = user.email || 'Admin';
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
// Close sidebar when clicking the overlay
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
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

// Close any modal when clicking its backdrop (not the card)
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal(backdrop);
  });
});

// Escape key closes topmost open modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = document.querySelector('.modal-backdrop.is-open');
    if (open) closeModal(open);
  }
});

// ── TAB NAVIGATION ──────────────────────────────────────────
const navItems   = document.querySelectorAll('.admin-nav-item[data-tab]');
const tabPanels  = document.querySelectorAll('.tab-panel');
const topbarTitle = document.getElementById('topbarTitle');

navItems.forEach(item => {
  item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
});

function switchTab(tabKey) {
  activeTab = tabKey;
  navItems.forEach(item => {
    item.classList.toggle('is-active', item.getAttribute('data-tab') === tabKey);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle('is-active', panel.id === `tab-${tabKey}`);
  });

  // Update topbar title cleanly
  const activeItem = document.querySelector(`.admin-nav-item[data-tab="${tabKey}"] .nav-label`);
  if (topbarTitle && activeItem) {
    topbarTitle.textContent = activeItem.textContent.trim();
  }

  // Close mobile sidebar
  document.body.classList.remove('sidebar-open');

  // Load tab data
  const loaders = {
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

// ── DASHBOARD INIT ──────────────────────────────────────────
async function initDashboard() {
  // Show skeletons immediately
  renderSkeletonRows('shopsTableBody',     7, 5);
  renderSkeletonRows('ledLeadsTableBody',  6, 4);
  renderSkeletonRows('activationLeadsTableBody', 6, 4);
  renderSkeletonRows('contactLeadsTableBody', 6, 4);
  renderSkeletonRows('eventsTableBody',    5, 4);
  renderSkeletonRows('blogTableBody',      5, 4);
  renderSkeletonRows('reviewsTableBody',   6, 4);

  await Promise.all([
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
  renderShops(); // Initial tab is overview → shops aren't shown, but loads data
}

// ── OVERVIEW QUICK ACTIONS ──────────────────────────────────
document.querySelectorAll('[data-goto-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-goto-tab');
    switchTab(target);
  });
});

// ── SEED FIRESTORE ──────────────────────────────────────────
document.getElementById('seedDatabaseBtn')?.addEventListener('click', async () => {
  if (!confirm('Seed/refresh Firestore with all 51 stores, events, blog, reviews & site content? This will overwrite existing docs with the same IDs.')) return;
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
  btn.textContent = '⏳ Seeding…';

  try {
    await seedFirestoreDatabase(updateLog);
    showToast('Firestore seeded successfully!', 'success');
    await initDashboard();
    updateOverviewMetrics();
  } catch (err) {
    updateLog(`❌ Error: ${err.message}`);
    showToast(`Seed failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Seed All Collections to Firestore';
  }
});

// ── 1. SHOPS ─────────────────────────────────────────────────
async function fetchShops() {
  try {
    const snap = await getDocs(collection(db, 'shops'));
    shopsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCountBadge('shopsCountBadge', shopsCache.length);
  } catch (err) { console.warn('Shops fetch failed:', err); }
}

function renderShops() {
  const tbody          = document.getElementById('shopsTableBody');
  const search         = document.getElementById('shopSearchInput')?.value.toLowerCase() || '';
  const floorFilter    = document.getElementById('shopFloorFilter')?.value || 'all';
  const categoryFilter = document.getElementById('shopCategoryFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = shopsCache.filter(shop => {
    const q = search;
    const matchesSearch = !q ||
      (shop.name        && shop.name.toLowerCase().includes(q)) ||
      (shop.room        && shop.room.toLowerCase().includes(q)) ||
      (shop.description && shop.description.toLowerCase().includes(q));
    const matchesFloor    = floorFilter === 'all'    || shop.floor === floorFilter;
    const matchesCategory = categoryFilter === 'all' || (shop.category || '').toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesFloor && matchesCategory;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No matching stores found</td></tr>`;
    return;
  }

  filtered.forEach(shop => {
    const tr = document.createElement('tr');
    const isActive = shop.isActive !== false;
    tr.innerHTML = `
      <td>
        <img src="${escHtml(shop.logoUrl || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png')}"
          style="width:38px;height:38px;object-fit:contain;border-radius:8px;background:#fff;padding:2px;border:1px solid rgba(0,0,0,0.08);" alt="${escHtml(shop.name)}">
      </td>
      <td>
        <strong style="color:#fff;display:block;">${escHtml(shop.name)}</strong>
        <small style="color:var(--admin-text-muted);">${escHtml(shop.email || '')}${shop.phone ? ' · ' + escHtml(shop.phone) : ''}</small>
      </td>
      <td><span class="admin-badge">${escHtml(shop.room || '—')}</span></td>
      <td style="color:var(--admin-text-muted);font-size:13px;">${escHtml(shop.floor || 'Ground Floor')}</td>
      <td style="text-transform:capitalize;font-size:13px;">${escHtml(shop.category || 'Retail')}</td>
      <td><span class="status-pill ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Hidden'}</span></td>
      <td>
        <div class="td-actions">
          <button class="btn-secondary btn-sm" onclick="window.editShop('${shop.id}')">Edit</button>
          <button class="btn-danger btn-sm"    onclick="window.deleteShop('${shop.id}','${escHtml(shop.name).replace(/'/g,"\\'")}')">Delete</button>
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
  document.getElementById('shopModalTitle').textContent = `Edit: ${shop.name}`;
  openModal(shopModal);
};

window.deleteShop = async function(shopId, shopName) {
  if (!confirm(`Permanently delete "${shopName}"?`)) return;
  try {
    await deleteDoc(doc(db, 'shops', shopId));
    showToast(`Deleted ${shopName}`, 'success');
    await fetchShops();
    renderShops();
    updateOverviewMetrics();
  } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
};

shopForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveShopBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const docId = document.getElementById('shopDocId').value.trim() ||
                document.getElementById('shopRoomInput').value.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                `shop-${Date.now()}`;

  let logoUrl  = document.getElementById('shopLogoUrlInput').value.trim();
  const logoFile = document.getElementById('shopLogoFileInput').files[0];
  if (logoFile) {
    try {
      const fileRef = storageRef(storage, `shops/logos/${Date.now()}_${logoFile.name}`);
      const snap    = await uploadBytes(fileRef, logoFile);
      logoUrl       = await getDownloadURL(snap.ref);
    } catch (uploadErr) { console.warn('Logo upload failed; using URL fallback:', uploadErr); }
  }

  const shopData = {
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
    await setDoc(doc(db, 'shops', docId), shopData, { merge: true });
    showToast('Store saved!', 'success');
    closeModal(shopModal);
    await fetchShops();
    renderShops();
    updateOverviewMetrics();
  } catch (err) { showToast(`Save failed: ${err.message}`, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Store'; }
});

// ── 2. GALLERY ────────────────────────────────────────────────
async function fetchGallery() {
  try {
    const snap = await getDocs(collection(db, 'gallery'));
    galleryCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
    updateCountBadge('galleryCountBadge', galleryCache.length);
  } catch (err) { console.warn('Gallery fetch failed:', err); }
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
        <button class="btn-danger btn-sm" style="width:100%;" onclick="window.deleteGalleryItem('${item.id}')">Remove</button>
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
    } catch (err) { console.warn('Gallery upload failed:', err); }
  }

  if (!imageUrl) {
    showToast('Please choose an image file or provide a URL.', 'error');
    btn.disabled = false; btn.textContent = 'Upload to Gallery';
    return;
  }

  try {
    await addDoc(collection(db, 'gallery'), { imageUrl, caption, category, sortOrder, uploadedAt: new Date().toISOString() });
    showToast('Photo added to gallery!', 'success');
    closeModal(galleryModal);
    await fetchGallery();
    renderGallery();
  } catch (err) { showToast(`Upload error: ${err.message}`, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Upload to Gallery'; }
});

window.deleteGalleryItem = async function(id) {
  if (!confirm('Remove this photo from the gallery?')) return;
  try {
    await deleteDoc(doc(db, 'gallery', id));
    showToast('Photo removed', 'success');
    await fetchGallery();
    renderGallery();
  } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
};

// ── 3. LED LEADS ──────────────────────────────────────────────
async function fetchLedLeads() {
  try {
    const snap = await getDocs(collection(db, 'ledLeads'));
    ledLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length);
  } catch (err) { console.warn('LED leads fetch failed:', err); }
}

function renderLedLeads() {
  const tbody = document.getElementById('ledLeadsTableBody');
  const statusFilter = document.getElementById('ledStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = ledLeadsCache.filter(l => statusFilter === 'all' || (l.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No LED campaign enquiries${statusFilter !== 'all' ? ' for this status' : ''}</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const statusVal = lead.status || 'new';
    tr.innerHTML = `
      <td>
        <strong style="color:#fff;display:block;">${escHtml(lead.businessName || 'Brand')}</strong>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.contactName || '')}</small>
      </td>
      <td>
        <div>${escHtml(lead.phone || '—')}</div>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small>
      </td>
      <td>
        <span class="admin-badge">${escHtml(lead.packageRequested || 'Standard')}</span>
        <div style="font-size:12px;color:var(--gold);margin-top:4px;">${escHtml(lead.estimatedCost || '')}</div>
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
    activLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    updateCountBadge('activationLeadsCountBadge', activLeadsCache.length);
  } catch (err) { console.warn('Activation leads fetch failed:', err); }
}

function renderActivationLeads() {
  const tbody = document.getElementById('activationLeadsTableBody');
  const statusFilter = document.getElementById('activationStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = activLeadsCache.filter(l => statusFilter === 'all' || (l.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No activation requests${statusFilter !== 'all' ? ' for this status' : ''}</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const statusVal = lead.status || 'new';
    tr.innerHTML = `
      <td>
        <strong style="color:#fff;display:block;">${escHtml(lead.applicantName || 'Applicant')}</strong>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.businessName || '')}</small>
      </td>
      <td>
        <div>${escHtml(lead.phone || '—')}</div>
        <small style="color:var(--admin-text-muted);">${escHtml(lead.email || '')}</small>
      </td>
      <td>
        <span class="admin-badge">${escHtml(lead.activationType || 'Pop-up')}</span>
        <div style="font-size:12px;color:var(--gold);margin-top:4px;">Dates: ${escHtml(lead.proposedDates || 'TBD')}</div>
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
    contactLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length);
  } catch (err) { console.warn('Contact leads fetch failed:', err); }
}

function renderContactLeads() {
  const tbody = document.getElementById('contactLeadsTableBody');
  const statusFilter = document.getElementById('contactStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = contactLeadsCache.filter(l => statusFilter === 'all' || (l.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No contact enquiries${statusFilter !== 'all' ? ' for this status' : ''}</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    const statusVal = lead.status || 'new';
    tr.innerHTML = `
      <td><strong style="color:#fff;">${escHtml(lead.name || 'Visitor')}</strong></td>
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
    await updateDoc(doc(db, collName, id), { status, updatedAt: new Date().toISOString() });
    showToast('Status updated', 'success');
  } catch (err) { showToast(`Status update failed: ${err.message}`, 'error'); }
};

window.deleteLead = async function(collName, id) {
  if (!confirm('Delete this record permanently?')) return;
  try {
    await deleteDoc(doc(db, collName, id));
    showToast('Record deleted', 'success');
    if (collName === 'ledLeads')         { await fetchLedLeads();         renderLedLeads(); }
    if (collName === 'activationLeads')  { await fetchActivationLeads();  renderActivationLeads(); }
    if (collName === 'contactLeads')     { await fetchContactLeads();      renderContactLeads(); }
    updateOverviewMetrics();
  } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
};

// ── 6. EVENTS ─────────────────────────────────────────────────
async function fetchEvents() {
  try {
    const snap = await getDocs(collection(db, 'events'));
    eventsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    updateCountBadge('eventsCountBadge', eventsCache.length);
  } catch (err) { console.warn('Events fetch failed:', err); }
}

function renderEvents() {
  const tbody = document.getElementById('eventsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (eventsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No events yet. Add your first event!</td></tr>`;
    return;
  }

  eventsCache.forEach(evt => {
    const type = evt.type || 'upcoming';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#fff;">${escHtml(evt.title)}</strong></td>
      <td style="color:var(--admin-text-muted);font-size:13px;">${formatDate(evt.date) || 'TBD'}</td>
      <td><span class="status-pill ${type}">${type}</span></td>
      <td>
        <div style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text-muted);">${escHtml(evt.summary || '')}</div>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-secondary btn-sm" onclick="window.editEvent('${evt.id}')">Edit</button>
          <button class="btn-danger btn-sm"    onclick="window.deleteEvent('${evt.id}')">Delete</button>
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
document.getElementById('closeEventModalBtn')?.addEventListener('click', () => {
  editingEventId = null;
  closeModal(eventModal);
});
document.getElementById('cancelEventBtn')?.addEventListener('click', () => {
  editingEventId = null;
  closeModal(eventModal);
});

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
  const btn     = document.getElementById('saveEventBtn');
  btn.disabled  = true; btn.textContent = 'Saving…';

  const data = {
    title:     document.getElementById('eventTitle').value.trim(),
    date:      document.getElementById('eventDate').value,
    type:      document.getElementById('eventType').value,
    summary:   document.getElementById('eventSummary').value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (editingEventId) {
      await updateDoc(doc(db, 'events', editingEventId), data);
      showToast('Event updated!', 'success');
    } else {
      data.createdAt = new Date().toISOString();
      await addDoc(collection(db, 'events'), data);
      showToast('Event created!', 'success');
    }
    editingEventId = null;
    closeModal(eventModal);
    await fetchEvents();
    renderEvents();
    updateOverviewMetrics();
  } catch (err) { showToast(`Error: ${err.message}`, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Event'; }
});

window.deleteEvent = async function(id) {
  if (!confirm('Delete this event permanently?')) return;
  try {
    await deleteDoc(doc(db, 'events', id));
    showToast('Event deleted', 'success');
    await fetchEvents();
    renderEvents();
    updateOverviewMetrics();
  } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
};

// ── 7. BLOG ───────────────────────────────────────────────────
async function fetchBlog() {
  try {
    const snap = await getDocs(collection(db, 'blogPosts'));
    blogCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    updateCountBadge('blogCountBadge', blogCache.length);
  } catch (err) { console.warn('Blog fetch failed:', err); }
}

function renderBlog() {
  const tbody = document.getElementById('blogTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (blogCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No articles published yet.</td></tr>`;
    return;
  }

  blogCache.forEach(post => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#fff;">${escHtml(post.title)}</strong></td>
      <td style="color:var(--admin-text-muted);font-size:13px;">${formatDate(post.date) || '—'}</td>
      <td><code style="font-size:11px;color:var(--coral);background:rgba(255,111,89,0.08);padding:2px 7px;border-radius:5px;">${escHtml(post.slug || '')}</code></td>
      <td>
        <div style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--admin-text-muted);">${escHtml(post.excerpt || '')}</div>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-secondary btn-sm" onclick="window.editBlogPost('${post.id}')">Edit</button>
          <button class="btn-danger btn-sm"    onclick="window.deleteBlogPost('${post.id}')">Delete</button>
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
document.getElementById('closeBlogModalBtn')?.addEventListener('click', () => {
  editingBlogId = null;
  closeModal(blogModal);
});
document.getElementById('cancelBlogBtn')?.addEventListener('click', () => {
  editingBlogId = null;
  closeModal(blogModal);
});

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
  const btn    = document.getElementById('saveBlogBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const slug    = document.getElementById('blogSlugInput').value.trim() || `post-${Date.now()}`;
  const data    = {
    title:     document.getElementById('blogTitleInput').value.trim(),
    slug,
    date:      document.getElementById('blogDateInput').value || new Date().toISOString().slice(0, 10),
    excerpt:   document.getElementById('blogExcerptInput').value.trim(),
    content:   document.getElementById('blogContentInput').value.trim() ||
               document.getElementById('blogExcerptInput').value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (editingBlogId) {
      await updateDoc(doc(db, 'blogPosts', editingBlogId), data);
      showToast('Article updated!', 'success');
    } else {
      data.createdAt = new Date().toISOString();
      await setDoc(doc(db, 'blogPosts', slug), data, { merge: true });
      showToast('Article published!', 'success');
    }
    editingBlogId = null;
    closeModal(blogModal);
    await fetchBlog();
    renderBlog();
  } catch (err) { showToast(`Publish failed: ${err.message}`, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Publish Article'; }
});

window.deleteBlogPost = async function(id) {
  if (!confirm('Delete this article permanently?')) return;
  try {
    await deleteDoc(doc(db, 'blogPosts', id));
    showToast('Article deleted', 'success');
    await fetchBlog();
    renderBlog();
  } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
};

// ── 8. REVIEWS ────────────────────────────────────────────────
async function fetchReviews() {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    reviewsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => Number(a.approved) - Number(b.approved));
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
  } catch (err) { console.warn('Reviews fetch failed:', err); }
}

function renderReviews() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (reviewsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--admin-text-muted);">No reviews found.</td></tr>`;
    return;
  }

  reviewsCache.forEach(rev => {
    const isApproved = rev.approved === true;
    const stars = '★'.repeat(Math.max(1, Math.min(5, rev.rating || 5)));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#fff;">${escHtml(rev.author || 'Customer')}</strong></td>
      <td style="color:var(--gold);letter-spacing:1px;font-size:14px;">${stars}</td>
      <td><span class="admin-badge">${escHtml(rev.type || 'testimonial')}</span></td>
      <td>
        <div style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;">
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
    await updateDoc(doc(db, 'reviews', id), { approved: approveStatus });
    showToast(approveStatus ? '✅ Review approved for public display' : 'Review hidden from public', 'success');
    await fetchReviews();
    renderReviews();
    updateOverviewMetrics();
  } catch (err) { showToast(`Action failed: ${err.message}`, 'error'); }
};

window.deleteReview = async function(id) {
  if (!confirm('Delete this review permanently?')) return;
  try {
    await deleteDoc(doc(db, 'reviews', id));
    showToast('Review removed', 'success');
    await fetchReviews();
    renderReviews();
    updateOverviewMetrics();
  } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
};

// ── 9. HOMEPAGE / SITE CONTENT ────────────────────────────────
async function loadSiteContentForm() {
  try {
    const snap = await getDoc(doc(db, 'siteContent', 'homepage'));
    if (snap.exists()) {
      const d = snap.data();
      document.getElementById('siteNameInput').value    = d.siteName    || '';
      document.getElementById('siteTaglineInput').value = d.tagline     || '';
      document.getElementById('heroHeadingInput').value = d.heroHeading || '';
      document.getElementById('heroSubInput').value     = d.heroSub     || '';
      document.getElementById('marqueeItemsInput').value= (d.marqueeItems || []).join(', ');
      document.getElementById('contactPhoneInput').value= d.phone        || '';
      document.getElementById('contactEmailInput').value= d.email        || '';
      document.getElementById('contactAddressInput').value = d.address  || '';
    }
  } catch (err) { console.warn('siteContent/homepage load failed:', err); }
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
    await setDoc(doc(db, 'siteContent', 'homepage'), payload, { merge: true });
    showToast('Homepage content updated live! 🎉', 'success');
  } catch (err) { showToast(`Save failed: ${err.message}`, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Homepage Content'; }
});

// ── HELPERS ───────────────────────────────────────────────────
function updateCountBadge(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = count;
}

function updateOverviewMetrics() {
  const safe = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  safe('metricTotalShops',   shopsCache.length);
  safe('metricTotalLeads',   ledLeadsCache.length + activLeadsCache.length + contactLeadsCache.length);
  safe('metricUpcomingEvents', eventsCache.filter(e => e.type === 'upcoming').length);
  safe('metricPendingReviews', reviewsCache.filter(r => !r.approved).length);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
