// js/site-data-init.js
// Loads live homepage and branding configuration from Firestore siteContent/homepage doc with JSON fallback.

(async function () {
  try {
    let data = null;

    // 1. Try Firestore if online / available
    try {
      const { db } = await import('./firebase-config.js');
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js");
      const snap = await getDoc(doc(db, 'siteContent', 'homepage'));
      if (snap.exists()) {
        data = snap.data();
      }
    } catch (fsErr) {
      console.warn('Firestore siteContent fetch error, falling back to JSON:', fsErr);
    }

    // 2. Fallback to static JSON
    if (!data) {
      const res = await fetch('/json/site-data.json').catch(() => fetch('./json/site-data.json'));
      if (res && res.ok) {
        data = await res.json();
      }
    }

    if (!data) return;

    // Fills by element ID
    const idMap = {
      'site-name': data.siteName,
      'site-tagline': data.tagline,
      'site-description': data.description,
      'contact-address': data.address,
      'contact-phone': data.phone,
      'contact-email': data.email,
      'open-hours': data.openingHours,
      'domain': data.domain
    };

    Object.keys(idMap).forEach((id) => {
      const el = document.getElementById(id);
      if (el && idMap[id]) el.textContent = idMap[id];
    });

    // Populate social links
    if (data.social) {
      ['facebook','instagram','twitter'].forEach((k) => {
        const el = document.getElementById('social-' + k);
        if (el && data.social[k]) el.setAttribute('href', data.social[k]);
      });
    }

    // Update document title and meta description
    if (data.siteName) {
      const titleTagline = data.tagline ? ` — ${data.tagline}` : '';
      if (!document.title.includes('Admin') && !document.title.includes('Sign In')) {
        // preserve specific subpage titles if they exist
      }
    }
    const md = document.querySelector('meta[name="description"]');
    if (md && data.description) md.setAttribute('content', data.description);

  } catch (err) {
    console.warn('site-data load failed:', err);
  }
})();
