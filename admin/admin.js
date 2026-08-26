// admin/admin.js - Mombasa Mall Admin Dashboard Controller

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
  deleteDoc,
  query,
  orderBy,
  where
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { seedFirestoreDatabase } from '../js/seed-data.js';

// State
let currentUser = null;
let activeTab = 'overview';
let shopsCache = [];
let galleryCache = [];
let ledLeadsCache = [];
let activationLeadsCache = [];
let contactLeadsCache = [];
let eventsCache = [];
let blogCache = [];
let reviewsCache = [];

// Toast notification helper
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ----------------------------------------------------
// AUTH GUARD
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace('./login.html');
    return;
  }
  currentUser = user;
  const emailEl = document.getElementById('adminEmailDisplay');
  if (emailEl) emailEl.textContent = user.email || 'Admin Staff';
  
  // Initial load
  initDashboard();
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to sign out?')) {
    await signOut(auth);
    window.location.replace('./login.html');
  }
});

// Change Password Handler
const changePwdModal = document.getElementById('changePasswordModal');
document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => {
  changePwdModal.classList.add('is-open');
});
document.getElementById('closeChangePasswordBtn')?.addEventListener('click', () => {
  changePwdModal.classList.remove('is-open');
});
document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPwd = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;
  
  if (newPwd.length < 6) {
    alert('Password must be at least 6 characters.');
    return;
  }
  if (newPwd !== confirmPwd) {
    alert('Passwords do not match.');
    return;
  }

  try {
    await updatePassword(auth.currentUser, newPwd);
    showToast('Password successfully updated!', 'success');
    changePwdModal.classList.remove('is-open');
    document.getElementById('changePasswordForm').reset();
  } catch (err) {
    alert(`Could not update password: ${err.message}. If your session has expired, please sign out and back in.`);
  }
});

// ----------------------------------------------------
// TAB NAVIGATION
// ----------------------------------------------------
const navItems = document.querySelectorAll('.admin-nav-item[data-tab]');
const tabPanels = document.querySelectorAll('.tab-panel');
const topbarTitle = document.getElementById('topbarTitle');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const targetTab = item.getAttribute('data-tab');
    switchTab(targetTab);
  });
});

function switchTab(tabKey) {
  activeTab = tabKey;
  navItems.forEach(item => {
    item.classList.toggle('is-active', item.getAttribute('data-tab') === tabKey);
  });
  tabPanels.forEach(panel => {
    panel.classList.toggle('is-active', panel.id === `tab-${tabKey}`);
  });
  
  const activeNavItem = document.querySelector(`.admin-nav-item[data-tab="${tabKey}"]`);
  if (topbarTitle && activeNavItem) {
    topbarTitle.textContent = activeNavItem.textContent.trim().replace(/\d+/g, '');
  }

  // Refresh tab data
  if (tabKey === 'shops') renderShops();
  if (tabKey === 'gallery') renderGallery();
  if (tabKey === 'ledLeads') renderLedLeads();
  if (tabKey === 'activationLeads') renderActivationLeads();
  if (tabKey === 'contactLeads') renderContactLeads();
  if (tabKey === 'events') renderEvents();
  if (tabKey === 'blogPosts') renderBlog();
  if (tabKey === 'reviews') renderReviews();
  if (tabKey === 'siteContent') loadSiteContentForm();
}

// ----------------------------------------------------
// DASHBOARD INITIALIZATION
// ----------------------------------------------------
async function initDashboard() {
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
  renderShops();
}

// ----------------------------------------------------
// SEED FIRESTORE BUTTON
// ----------------------------------------------------
document.getElementById('seedDatabaseBtn')?.addEventListener('click', async () => {
  if (!confirm('This will seed/refresh Firestore collections with the authoritative store directory, events, blog, and reviews. Proceed?')) {
    return;
  }
  const logBox = document.getElementById('seedProgressLog');
  if (logBox) logBox.style.display = 'block';
  
  function updateLog(msg) {
    if (logBox) {
      logBox.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  try {
    await seedFirestoreDatabase(updateLog);
    showToast('Firestore seeded successfully!', 'success');
    await initDashboard();
  } catch (err) {
    updateLog(`❌ Seed error: ${err.message}`);
    showToast(`Seed failed: ${err.message}`, 'error');
  }
});

// ----------------------------------------------------
// 1. SHOPS MANAGEMENT
// ----------------------------------------------------
async function fetchShops() {
  try {
    const snap = await getDocs(collection(db, 'shops'));
    shopsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCountBadge('shopsCountBadge', shopsCache.length);
  } catch (err) {
    console.warn('Failed to fetch shops:', err);
  }
}

function renderShops() {
  const tbody = document.getElementById('shopsTableBody');
  const search = document.getElementById('shopSearchInput')?.value.toLowerCase() || '';
  const floorFilter = document.getElementById('shopFloorFilter')?.value || 'all';
  const categoryFilter = document.getElementById('shopCategoryFilter')?.value || 'all';
  
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = shopsCache.filter(shop => {
    const matchesSearch = !search || 
      (shop.name && shop.name.toLowerCase().includes(search)) || 
      (shop.room && shop.room.toLowerCase().includes(search)) ||
      (shop.description && shop.description.toLowerCase().includes(search));
    const matchesFloor = floorFilter === 'all' || shop.floor === floorFilter;
    const matchesCategory = categoryFilter === 'all' || (shop.category && shop.category.toLowerCase() === categoryFilter.toLowerCase());
    return matchesSearch && matchesFloor && matchesCategory;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No matching stores found</td></tr>`;
    return;
  }

  filtered.forEach(shop => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <img src="${shop.logoUrl || '../assets/Logo/Mall Logo/MOMBASA MALL 1.0.png'}" style="width:36px; height:36px; object-fit:contain; border-radius:6px; background:#fff; padding:2px;">
      </td>
      <td>
        <strong style="color:#fff;">${shop.name}</strong>
        <div style="font-size:12px; color:var(--admin-text-muted);">${shop.email || ''} · ${shop.phone || ''}</div>
      </td>
      <td><span class="admin-badge">${shop.room || '—'}</span></td>
      <td>${shop.floor || 'Ground Floor'}</td>
      <td style="text-transform:capitalize;">${shop.category || 'Retail'}</td>
      <td>
        <span class="status-pill ${shop.isActive !== false ? 'active' : 'inactive'}">
          ${shop.isActive !== false ? 'Active' : 'Hidden'}
        </span>
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary btn-sm" onclick="window.editShop('${shop.id}')">Edit</button>
          <button class="btn-danger btn-sm" onclick="window.deleteShop('${shop.id}', '${shop.name}')">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Attach Search & Filters
document.getElementById('shopSearchInput')?.addEventListener('input', renderShops);
document.getElementById('shopFloorFilter')?.addEventListener('change', renderShops);
document.getElementById('shopCategoryFilter')?.addEventListener('change', renderShops);

// Add / Edit Shop Modal
const shopModal = document.getElementById('shopModal');
const shopForm = document.getElementById('shopForm');

document.getElementById('openAddShopBtn')?.addEventListener('click', () => {
  shopForm.reset();
  document.getElementById('shopDocId').value = '';
  document.getElementById('shopModalTitle').textContent = 'Add New Store';
  shopModal.classList.add('is-open');
});

document.getElementById('closeShopModalBtn')?.addEventListener('click', () => {
  shopModal.classList.remove('is-open');
});

window.editShop = function(shopId) {
  const shop = shopsCache.find(s => s.id === shopId);
  if (!shop) return;
  document.getElementById('shopDocId').value = shop.id;
  document.getElementById('shopNameInput').value = shop.name || '';
  document.getElementById('shopCategoryInput').value = shop.category || 'retail';
  document.getElementById('shopFloorInput').value = shop.floor || 'Ground Floor';
  document.getElementById('shopRoomInput').value = shop.room || '';
  document.getElementById('shopPhoneInput').value = shop.phone || '';
  document.getElementById('shopEmailInput').value = shop.email || '';
  document.getElementById('shopSocialInput').value = shop.socialHandle || '';
  document.getElementById('shopLogoUrlInput').value = shop.logoUrl || '';
  document.getElementById('shopDescInput').value = shop.description || '';
  document.getElementById('shopIsActiveInput').checked = shop.isActive !== false;
  
  document.getElementById('shopModalTitle').textContent = `Edit Store: ${shop.name}`;
  shopModal.classList.add('is-open');
};

window.deleteShop = async function(shopId, shopName) {
  if (confirm(`Are you sure you want to permanently delete "${shopName}"?`)) {
    try {
      await deleteDoc(doc(db, 'shops', shopId));
      showToast(`Deleted ${shopName}`, 'success');
      await fetchShops();
      renderShops();
      updateOverviewMetrics();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }
};

shopForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('saveShopBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const docId = document.getElementById('shopDocId').value.trim() || 
                document.getElementById('shopRoomInput').value.toLowerCase().replace(/[^a-z0-9]/g, '-') ||
                `shop-${Date.now()}`;
                
  let logoUrl = document.getElementById('shopLogoUrlInput').value.trim();
  const logoFile = document.getElementById('shopLogoFileInput').files[0];

  // Upload logo to Storage if selected
  if (logoFile) {
    try {
      const fileRef = storageRef(storage, `shops/logos/${Date.now()}_${logoFile.name}`);
      const snapshot = await uploadBytes(fileRef, logoFile);
      logoUrl = await getDownloadURL(snapshot.ref);
    } catch (uploadErr) {
      console.warn('Storage upload error (fallback to path):', uploadErr);
    }
  }

  const shopData = {
    name: document.getElementById('shopNameInput').value.trim(),
    category: document.getElementById('shopCategoryInput').value,
    floor: document.getElementById('shopFloorInput').value,
    room: document.getElementById('shopRoomInput').value.trim(),
    phone: document.getElementById('shopPhoneInput').value.trim(),
    email: document.getElementById('shopEmailInput').value.trim(),
    socialHandle: document.getElementById('shopSocialInput').value.trim(),
    logoUrl: logoUrl || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
    description: document.getElementById('shopDescInput').value.trim(),
    isActive: document.getElementById('shopIsActiveInput').checked,
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'shops', docId), shopData, { merge: true });
    showToast('Store saved successfully!', 'success');
    shopModal.classList.remove('is-open');
    await fetchShops();
    renderShops();
    updateOverviewMetrics();
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Store';
  }
});

// ----------------------------------------------------
// 2. GALLERY MANAGEMENT
// ----------------------------------------------------
async function fetchGallery() {
  try {
    const snap = await getDocs(collection(db, 'gallery'));
    galleryCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));
    updateCountBadge('galleryCountBadge', galleryCache.length);
  } catch (err) {
    console.warn('Failed to fetch gallery:', err);
  }
}

function renderGallery() {
  const container = document.getElementById('galleryGridContainer');
  if (!container) return;
  container.innerHTML = '';

  if (galleryCache.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--admin-text-muted);">No gallery photos uploaded yet.</div>`;
    return;
  }

  galleryCache.forEach(item => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.style.padding = '0';
    card.style.overflow = 'hidden';
    card.innerHTML = `
      <img src="${item.imageUrl}" style="width:100%; height:160px; object-fit:cover;">
      <div style="padding:16px;">
        <div style="font-size:11px; text-transform:uppercase; color:var(--coral); font-weight:700;">${item.category || 'General'} · Order ${item.sortOrder || 1}</div>
        <div style="font-size:13px; color:#fff; margin-top:4px; font-weight:600;">${item.caption || 'Photo'}</div>
        <button class="btn-danger btn-sm" style="margin-top:12px; width:100%;" onclick="window.deleteGalleryItem('${item.id}')">Remove Photo</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Add Gallery Photo Modal
const galleryModal = document.getElementById('galleryModal');
document.getElementById('openAddGalleryBtn')?.addEventListener('click', () => {
  document.getElementById('galleryForm').reset();
  galleryModal.classList.add('is-open');
});
document.getElementById('closeGalleryModalBtn')?.addEventListener('click', () => {
  galleryModal.classList.remove('is-open');
});

document.getElementById('galleryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveGalleryBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  const caption = document.getElementById('galleryCaption').value.trim();
  const category = document.getElementById('galleryCategory').value;
  const sortOrder = parseInt(document.getElementById('galleryOrder').value) || 1;
  const file = document.getElementById('galleryFile').files[0];
  let imageUrl = document.getElementById('galleryUrlInput').value.trim();

  if (file) {
    try {
      const imgRef = storageRef(storage, `gallery/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(imgRef, file);
      imageUrl = await getDownloadURL(snapshot.ref);
    } catch (err) {
      console.warn('Storage upload error:', err);
    }
  }

  if (!imageUrl) {
    alert('Please choose an image file or provide an image URL.');
    btn.disabled = false;
    btn.textContent = 'Upload to Gallery';
    return;
  }

  try {
    await addDoc(collection(db, 'gallery'), {
      imageUrl,
      caption,
      category,
      sortOrder,
      uploadedAt: new Date().toISOString()
    });
    showToast('Gallery image added!', 'success');
    galleryModal.classList.remove('is-open');
    await fetchGallery();
    renderGallery();
  } catch (err) {
    showToast(`Error adding image: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload to Gallery';
  }
});

window.deleteGalleryItem = async function(id) {
  if (confirm('Delete this photo from gallery?')) {
    try {
      await deleteDoc(doc(db, 'gallery', id));
      showToast('Photo removed', 'success');
      await fetchGallery();
      renderGallery();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }
};

// ----------------------------------------------------
// 3. LED LEADS INBOX
// ----------------------------------------------------
async function fetchLedLeads() {
  try {
    const snap = await getDocs(collection(db, 'ledLeads'));
    ledLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    updateCountBadge('ledLeadsCountBadge', ledLeadsCache.length);
  } catch (err) {
    console.warn('Failed to fetch led leads:', err);
  }
}

function renderLedLeads() {
  const tbody = document.getElementById('ledLeadsTableBody');
  const statusFilter = document.getElementById('ledStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = ledLeadsCache.filter(lead => statusFilter === 'all' || (lead.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No LED campaign enquiries found</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:#fff;">${lead.businessName || 'Brand'}</strong>
        <div style="font-size:12px; color:var(--admin-text-muted);">${lead.contactName || ''}</div>
      </td>
      <td>
        <div>${lead.phone || '—'}</div>
        <div style="font-size:12px; color:var(--admin-text-muted);">${lead.email || ''}</div>
      </td>
      <td>
        <span class="admin-badge">${lead.packageRequested || 'Standard'}</span>
        <div style="font-size:12px; color:var(--gold); margin-top:2px;">${lead.estimatedCost || ''}</div>
      </td>
      <td>
        <div style="font-size:13px; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${lead.message || '—'}
        </div>
        <div style="font-size:11px; color:var(--admin-text-muted);">${formatDate(lead.submittedAt)}</div>
      </td>
      <td>
        <select class="filter-select" style="padding:6px 10px; font-size:12px;" onchange="window.updateLeadStatus('ledLeads', '${lead.id}', this.value)">
          <option value="new" ${(lead.status || 'new') === 'new' ? 'selected' : ''}>New</option>
          <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="won" ${lead.status === 'won' ? 'selected' : ''}>Won / Booked</option>
          <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Lost</option>
        </select>
      </td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteLead('ledLeads', '${lead.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('ledStatusFilter')?.addEventListener('change', renderLedLeads);

// ----------------------------------------------------
// 4. ACTIVATION LEADS INBOX
// ----------------------------------------------------
async function fetchActivationLeads() {
  try {
    const snap = await getDocs(collection(db, 'activationLeads'));
    activationLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    updateCountBadge('activationLeadsCountBadge', activationLeadsCache.length);
  } catch (err) {
    console.warn('Failed to fetch activation leads:', err);
  }
}

function renderActivationLeads() {
  const tbody = document.getElementById('activationLeadsTableBody');
  const statusFilter = document.getElementById('activationStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = activationLeadsCache.filter(lead => statusFilter === 'all' || (lead.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No activation requests found</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:#fff;">${lead.applicantName || 'Applicant'}</strong>
        <div style="font-size:12px; color:var(--admin-text-muted);">${lead.businessName || ''}</div>
      </td>
      <td>
        <div>${lead.phone || '—'}</div>
        <div style="font-size:12px; color:var(--admin-text-muted);">${lead.email || ''}</div>
      </td>
      <td>
        <span class="admin-badge">${lead.activationType || 'Atrium Pop-up'}</span>
        <div style="font-size:12px; color:var(--gold); margin-top:2px;">Dates: ${lead.proposedDates || 'TBD'}</div>
      </td>
      <td>
        <div style="font-size:13px; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${lead.message || '—'}
        </div>
        <div style="font-size:11px; color:var(--admin-text-muted);">${formatDate(lead.submittedAt)}</div>
      </td>
      <td>
        <select class="filter-select" style="padding:6px 10px; font-size:12px;" onchange="window.updateLeadStatus('activationLeads', '${lead.id}', this.value)">
          <option value="new" ${(lead.status || 'new') === 'new' ? 'selected' : ''}>New</option>
          <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="won" ${lead.status === 'won' ? 'selected' : ''}>Approved / Booked</option>
          <option value="lost" ${lead.status === 'lost' ? 'selected' : ''}>Declined</option>
        </select>
      </td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteLead('activationLeads', '${lead.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('activationStatusFilter')?.addEventListener('change', renderActivationLeads);

// ----------------------------------------------------
// 5. CONTACT & LEASING LEADS INBOX
// ----------------------------------------------------
async function fetchContactLeads() {
  try {
    const snap = await getDocs(collection(db, 'contactLeads'));
    contactLeadsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    updateCountBadge('contactLeadsCountBadge', contactLeadsCache.length);
  } catch (err) {
    console.warn('Failed to fetch contact leads:', err);
  }
}

function renderContactLeads() {
  const tbody = document.getElementById('contactLeadsTableBody');
  const statusFilter = document.getElementById('contactStatusFilter')?.value || 'all';
  if (!tbody) return;
  tbody.innerHTML = '';

  const filtered = contactLeadsCache.filter(lead => statusFilter === 'all' || (lead.status || 'new') === statusFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No contact enquiries found</td></tr>`;
    return;
  }

  filtered.forEach(lead => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong style="color:#fff;">${lead.name || 'Visitor'}</strong>
      </td>
      <td>
        <div>${lead.phone || '—'}</div>
        <div style="font-size:12px; color:var(--admin-text-muted);">${lead.email || ''}</div>
      </td>
      <td>
        <span class="admin-badge">${lead.subject || 'General'}</span>
      </td>
      <td>
        <div style="font-size:13px; max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${lead.message || '—'}
        </div>
        <div style="font-size:11px; color:var(--admin-text-muted);">${formatDate(lead.submittedAt)}</div>
      </td>
      <td>
        <select class="filter-select" style="padding:6px 10px; font-size:12px;" onchange="window.updateLeadStatus('contactLeads', '${lead.id}', this.value)">
          <option value="new" ${(lead.status || 'new') === 'new' ? 'selected' : ''}>New</option>
          <option value="contacted" ${lead.status === 'contacted' ? 'selected' : ''}>Contacted</option>
          <option value="closed" ${lead.status === 'closed' ? 'selected' : ''}>Closed</option>
        </select>
      </td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteLead('contactLeads', '${lead.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('contactStatusFilter')?.addEventListener('change', renderContactLeads);

// Generic Lead Status updater
window.updateLeadStatus = async function(collName, id, status) {
  try {
    await updateDoc(doc(db, collName, id), { status });
    showToast('Status updated', 'success');
  } catch (err) {
    showToast(`Status update failed: ${err.message}`, 'error');
  }
};

window.deleteLead = async function(collName, id) {
  if (confirm('Delete this record?')) {
    try {
      await deleteDoc(doc(db, collName, id));
      showToast('Record deleted', 'success');
      if (collName === 'ledLeads') { await fetchLedLeads(); renderLedLeads(); }
      if (collName === 'activationLeads') { await fetchActivationLeads(); renderActivationLeads(); }
      if (collName === 'contactLeads') { await fetchContactLeads(); renderContactLeads(); }
      updateOverviewMetrics();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }
};

// ----------------------------------------------------
// 6. EVENTS & NEWS MANAGEMENT
// ----------------------------------------------------
async function fetchEvents() {
  try {
    const snap = await getDocs(collection(db, 'events'));
    eventsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCountBadge('eventsCountBadge', eventsCache.length);
  } catch (err) {
    console.warn('Failed to fetch events:', err);
  }
}

function renderEvents() {
  const tbody = document.getElementById('eventsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (eventsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No events found</td></tr>`;
    return;
  }

  eventsCache.forEach(evt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#fff;">${evt.title}</strong></td>
      <td>${evt.date || 'TBD'}</td>
      <td><span class="status-pill ${evt.type === 'upcoming' ? 'active' : 'contacted'}">${evt.type || 'upcoming'}</span></td>
      <td><div style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${evt.summary || ''}</div></td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteEvent('${evt.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Add Event Modal
const eventModal = document.getElementById('eventModal');
document.getElementById('openAddEventBtn')?.addEventListener('click', () => {
  document.getElementById('eventForm').reset();
  eventModal.classList.add('is-open');
});
document.getElementById('closeEventModalBtn')?.addEventListener('click', () => {
  eventModal.classList.remove('is-open');
});

document.getElementById('eventForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const type = document.getElementById('eventType').value;
  const summary = document.getElementById('eventSummary').value.trim();

  try {
    await addDoc(collection(db, 'events'), {
      title,
      date,
      type,
      summary,
      createdAt: new Date().toISOString()
    });
    showToast('Event created successfully!', 'success');
    eventModal.classList.remove('is-open');
    await fetchEvents();
    renderEvents();
    updateOverviewMetrics();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
});

window.deleteEvent = async function(id) {
  if (confirm('Delete this event?')) {
    try {
      await deleteDoc(doc(db, 'events', id));
      showToast('Event deleted', 'success');
      await fetchEvents();
      renderEvents();
      updateOverviewMetrics();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }
};

// ----------------------------------------------------
// 7. BLOG MANAGEMENT
// ----------------------------------------------------
async function fetchBlog() {
  try {
    const snap = await getDocs(collection(db, 'blogPosts'));
    blogCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCountBadge('blogCountBadge', blogCache.length);
  } catch (err) {
    console.warn('Failed to fetch blog posts:', err);
  }
}

function renderBlog() {
  const tbody = document.getElementById('blogTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (blogCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No blog posts found</td></tr>`;
    return;
  }

  blogCache.forEach(post => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:#fff;">${post.title}</strong></td>
      <td>${post.date || ''}</td>
      <td><code>${post.slug || ''}</code></td>
      <td><div style="max-width:280px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${post.excerpt || ''}</div></td>
      <td>
        <button class="btn-danger btn-sm" onclick="window.deleteBlogPost('${post.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Add Blog Modal
const blogModal = document.getElementById('blogModal');
document.getElementById('openAddBlogBtn')?.addEventListener('click', () => {
  document.getElementById('blogForm').reset();
  blogModal.classList.add('is-open');
});
document.getElementById('closeBlogModalBtn')?.addEventListener('click', () => {
  blogModal.classList.remove('is-open');
});

document.getElementById('blogTitleInput')?.addEventListener('input', (e) => {
  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  document.getElementById('blogSlugInput').value = slug;
});

document.getElementById('blogForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('blogTitleInput').value.trim();
  const slug = document.getElementById('blogSlugInput').value.trim();
  const date = document.getElementById('blogDateInput').value || new Date().toISOString().slice(0, 10);
  const excerpt = document.getElementById('blogExcerptInput').value.trim();
  const content = document.getElementById('blogContentInput').value.trim();

  try {
    await setDoc(doc(db, 'blogPosts', slug), {
      title,
      slug,
      date,
      excerpt,
      content: content || excerpt,
      createdAt: new Date().toISOString()
    });
    showToast('Blog article published!', 'success');
    blogModal.classList.remove('is-open');
    await fetchBlog();
    renderBlog();
  } catch (err) {
    showToast(`Publish failed: ${err.message}`, 'error');
  }
});

window.deleteBlogPost = async function(id) {
  if (confirm('Delete this article?')) {
    try {
      await deleteDoc(doc(db, 'blogPosts', id));
      showToast('Article deleted', 'success');
      await fetchBlog();
      renderBlog();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }
};

// ----------------------------------------------------
// 8. REVIEWS MODERATION
// ----------------------------------------------------
async function fetchReviews() {
  try {
    const snap = await getDocs(collection(db, 'reviews'));
    reviewsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateCountBadge('reviewsCountBadge', reviewsCache.length);
  } catch (err) {
    console.warn('Failed to fetch reviews:', err);
  }
}

function renderReviews() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (reviewsCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--admin-text-muted);">No reviews found</td></tr>`;
    return;
  }

  reviewsCache.forEach(rev => {
    const tr = document.createElement('tr');
    const isApproved = rev.approved === true;
    tr.innerHTML = `
      <td><strong style="color:#fff;">${rev.author || 'Customer'}</strong></td>
      <td>${'★'.repeat(rev.rating || 5)}</td>
      <td><span class="admin-badge">${rev.type || 'testimonial'}</span></td>
      <td><div style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">"${rev.quote || ''}"</div></td>
      <td>
        <span class="status-pill ${isApproved ? 'approved' : 'new'}">
          ${isApproved ? 'Approved' : 'Pending'}
        </span>
      </td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn-secondary btn-sm" onclick="window.toggleReviewApproval('${rev.id}', ${!isApproved})">
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
    showToast(approveStatus ? 'Review approved for public display' : 'Review unapproved', 'success');
    await fetchReviews();
    renderReviews();
    updateOverviewMetrics();
  } catch (err) {
    showToast(`Action failed: ${err.message}`, 'error');
  }
};

window.deleteReview = async function(id) {
  if (confirm('Delete this review permanently?')) {
    try {
      await deleteDoc(doc(db, 'reviews', id));
      showToast('Review removed', 'success');
      await fetchReviews();
      renderReviews();
      updateOverviewMetrics();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  }
};

// ----------------------------------------------------
// 9. HOMEPAGE / SITE CONTENT SINGLETON
// ----------------------------------------------------
async function loadSiteContentForm() {
  try {
    const snap = await getDoc(doc(db, 'siteContent', 'homepage'));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById('siteNameInput').value = data.siteName || '';
      document.getElementById('siteTaglineInput').value = data.tagline || '';
      document.getElementById('heroHeadingInput').value = data.heroHeading || '';
      document.getElementById('heroSubInput').value = data.heroSub || '';
      document.getElementById('marqueeItemsInput').value = (data.marqueeItems || []).join(', ');
      document.getElementById('contactPhoneInput').value = data.phone || '';
      document.getElementById('contactEmailInput').value = data.email || '';
      document.getElementById('contactAddressInput').value = data.address || '';
    }
  } catch (err) {
    console.warn('Could not load siteContent/homepage:', err);
  }
}

document.getElementById('siteContentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('saveSiteContentBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const marqueeRaw = document.getElementById('marqueeItemsInput').value;
  const marqueeItems = marqueeRaw.split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    siteName: document.getElementById('siteNameInput').value.trim(),
    tagline: document.getElementById('siteTaglineInput').value.trim(),
    heroHeading: document.getElementById('heroHeadingInput').value.trim(),
    heroSub: document.getElementById('heroSubInput').value.trim(),
    marqueeItems: marqueeItems.length ? marqueeItems : [
      "The Coastal Lifestyle",
      "Premium Shopping",
      "Mombasa's Landmark",
      "120+ Brands",
      "5 Floors of Possibility"
    ],
    phone: document.getElementById('contactPhoneInput').value.trim(),
    email: document.getElementById('contactEmailInput').value.trim(),
    address: document.getElementById('contactAddressInput').value.trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'siteContent', 'homepage'), payload, { merge: true });
    showToast('Homepage content updated live!', 'success');
  } catch (err) {
    showToast(`Error saving content: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Homepage Content';
  }
});

// ----------------------------------------------------
// HELPERS
// ----------------------------------------------------
function updateCountBadge(id, count) {
  const el = document.getElementById(id);
  if (el) el.textContent = count;
}

function updateOverviewMetrics() {
  document.getElementById('metricTotalShops').textContent = shopsCache.length;
  document.getElementById('metricTotalLeads').textContent = ledLeadsCache.length + activationLeadsCache.length + contactLeadsCache.length;
  document.getElementById('metricUpcomingEvents').textContent = eventsCache.filter(e => e.type === 'upcoming').length;
  document.getElementById('metricPendingReviews').textContent = reviewsCache.filter(r => !r.approved).length;
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return isoStr;
  }
}
