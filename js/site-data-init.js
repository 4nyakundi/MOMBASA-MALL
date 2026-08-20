(async function () {
  try {
    const res = await fetch('/json/site-data.json');
    const data = await res.json();

    // Basic fills
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
      if (el) el.textContent = idMap[id];
    });

    // Populate social links if present
    if (data.social) {
      ['facebook','instagram','twitter'].forEach((k) => {
        const el = document.getElementById('social-' + k);
        if (el) el.setAttribute('href', data.social[k]);
      });
    }

    // Update document title and meta description
    if (data.siteName) {
      document.title = data.siteName + ' — ' + (data.tagline || '');
    }
    const md = document.querySelector('meta[name="description"]');
    if (md && data.description) md.setAttribute('content', data.description);
  } catch (err) {
    console.warn('site-data load failed', err);
  }
})();
