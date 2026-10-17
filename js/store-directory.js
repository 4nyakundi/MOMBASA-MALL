    (async function () {
      'use strict';

      // ── 1. UNIT GUIDE GENERATED FROM THE CONFIRMED DIRECTORY ──
      const floorBlueprints = {};

      // ── 2. DATA HYDRATION ─────────────────────────────────────
      let allStores = [];
      try {
        const response = await MallAPI.content('stores');
        allStores = response.stores;
      } catch (error) {
        console.warn('Directory service unavailable:', error.message);
        const notice = document.createElement('p');
        notice.className='directory-service-notice'; notice.setAttribute('role','status'); notice.textContent = 'Live directory unavailable. Showing the published directory snapshot.';
        document.getElementById('storesGridContainer')?.before(notice);
        for (const floor of window.MOMBASA_DEFAULT_STORES?.floors || []) {
          for (const shop of floor.shops || []) allStores.push({...shop, floor:floor.name, room:shop.room || '', logoUrl:shop.logo || '', photo:shop.photo || ''});
        }
      }

      // ── 3. RENDER STORES GRID ─────────────────────────────────
      const gridContainer = document.getElementById('storesGridContainer');
      const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      allStores = allStores.filter(store => store.isActive !== false);
      const floorMeta = [
        ['Ground Floor', 'ground-floor', 'Groceries & dining'],
        ['1st Floor', 'first-floor', 'Fashion, banking & technology'],
        ['2nd Floor', 'second-floor', 'Beauty, boutiques & family entertainment'],
        ['3rd Floor', 'third-floor', 'Gaming, fitness, coworking & healthcare'],
        ['Basement', 'basement', 'Parking & guest services']
      ];
      const knownStores = (window.MOMBASA_DEFAULT_STORES?.floors || []).flatMap(f => f.shops.map(shop => ({...shop, floor: f.name})));
      const assetPath = value => { if (!value) return ''; try { const url = new URL(value, document.baseURI); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
      const storePhotos = {'G-02': './assets/store-photos/g-02.webp', 'G-03': './assets/store-photos/g-03.webp', 'G-04': './assets/store-photos/g-04.webp', 'F-05': './assets/store-photos/f-05.webp', 'F-06': './assets/store-photos/f-06.webp', 'F-09': './assets/store-photos/f-09.webp', 'F-12': './assets/store-photos/f-12.webp', 'S-11': './assets/store-photos/s-11.webp', 'S-12': './assets/store-photos/s-12.webp', 'S-16': './assets/store-photos/s-16.webp', 'S-17': './assets/store-photos/s-17.webp', 'T-01': './assets/store-photos/t-01.webp', 'T-02': './assets/store-photos/t-02.webp', 'T-03': './assets/store-photos/t-03.webp'};
      const floorAliases = {'First Floor':'1st Floor', 'Second Floor':'2nd Floor', 'Third Floor':'3rd Floor', 'Basement Parking':'Basement'};
      allStores = allStores.map(store => {
        const normalizeName = name => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const known = knownStores.find(shop => normalizeName(shop.name) === normalizeName(store.name));
        return {...store, room: store.room || '—', floor: floorAliases[store.floor] || store.floor,
          photo: assetPath(store.photoUrls?.[0] || store.photo || store.logoUrl || '/assets/lifestyle/mall-day.webp'),
          photoFit: ['G-01','F-01'].includes(known?.room || store.room) ? 'contain' : storePhotos[known?.room || store.room] ? 'cover' : known?.photoFit || store.photoFit || 'contain',
          logoUrl: assetPath(store.logoUrl || store.logo), website: assetPath(store.website || store.socialMediaUrl)};
      });
      const escapeText = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      floorMeta.forEach(([floor, slug]) => {
        const stores = allStores.filter(store => store.floor === floor).sort((a,b) => a.room.localeCompare(b.room));
        const height = Math.max(400, Math.ceil(stores.length / 4) * 90 + 50);
        floorBlueprints[floor] = {title: floor + ' — Unit Guide', count: stores.length + ' stores / facilities', height,
          svg: stores.map((store,index) => {
            const x = 20 + (index % 4) * 195, y = 25 + Math.floor(index / 4) * 90;
            return `<g class="svg-store-zone" data-store-name="${escapeText(store.name)}"><rect x="${x}" y="${y}" width="175" height="70" rx="10" fill="#173f60" stroke="#7caecb"/><text x="${x+12}" y="${y+25}" fill="white" font-size="15">${escapeText(store.room)}</text><text x="${x+12}" y="${y+49}" fill="#cee8f8" font-size="11">${escapeText(store.name.length>23?store.name.slice(0,21)+'…':store.name)}</text></g>`;
          }).join('')};
      });

      document.getElementById('directoryTotal').textContent = allStores.length;

      const search = document.getElementById('storeSearch');
      const floorFilter = document.getElementById('storeFloor');
      const reset = document.getElementById('resetStoreFilters');
      let activeCategory = 'all';
      const categoryLabels = {retail:'Shopping',fashion:'Fashion',tech:'Tech & electronics',food:'Eat & drink',beauty:'Beauty & wellness',services:'Everyday services'};
      const categoryGroup = store => {
        if (/play.?on|gam(e|er|ing)|fitness|gym|arcade|entertainment/i.test(store.name + ' ' + store.category)) return 'play';
        if (['retail','fashion','tech'].includes(store.category)) return 'shop';
        return store.category;
      };
      function renderStores() {
        if (!gridContainer) return;
        if (window.cleanupStoreCardMotion) window.cleanupStoreCardMotion();
        const query = search.value.trim().toLowerCase();
        const filtered = allStores.filter(store => (activeCategory === 'all' || categoryGroup(store) === activeCategory)
          && (floorFilter.value === 'all' || store.floor === floorFilter.value)
          && [store.name,store.description,store.category,categoryLabels[store.category],store.room,store.floor].join(' ').toLowerCase().includes(query));
        gridContainer.replaceChildren();
        const isFiltered = !!query || activeCategory !== 'all' || floorFilter.value !== 'all';
        reset.hidden = !isFiltered;
        document.getElementById('directoryResults').textContent = `${filtered.length} ${filtered.length === 1 ? 'place' : 'places'} ${isFiltered ? 'for you to explore' : 'to discover'}`;
        if (!filtered.length) {
          gridContainer.innerHTML = `<div class="store-empty"><span aria-hidden="true">↗</span><h3>${allStores.length ? 'Your next find is still out there.' : 'New discoveries are on the way.'}</h3><p>${allStores.length ? 'Try another name, category or floor.' : 'Our directory is being updated. Please check back soon.'}</p>${isFiltered ? '<button type="button">Explore all places</button>' : ''}</div>`;
          gridContainer.querySelector('button')?.addEventListener('click', resetFilters);
        }
        filtered.sort((a,b) => floorMeta.findIndex(f=>f[0]===a.floor)-floorMeta.findIndex(f=>f[0]===b.floor) || a.room.localeCompare(b.room)).forEach(store => {
          const card = document.createElement('article');
          card.className = 'store-card'; card.id = 'store-' + store.room.toLowerCase();
          card.dataset.name = store.name;
          card.innerHTML = `<button type="button" class="store-card-open" aria-label="${escapeText('Explore ' + store.name)}">
            <div class="store-card-photo"><img src="${escapeText(store.photo)}" alt="" class="${store.photoFit === 'cover' ? 'is-photo' : ''}" loading="lazy" decoding="async" width="480" height="360"><span class="store-card-discover" aria-hidden="true">Take a look ↗</span><span class="store-card-category">${escapeText(categoryGroup(store)==='play' ? 'Play & unwind' : categoryLabels[store.category] || store.category || 'Discover')}</span></div>
            <div class="store-card-info"><h3>${escapeText(store.name)}</h3><span class="store-card-arrow" aria-hidden="true">↗</span><p>${escapeText(store.floor)} <span aria-hidden="true">·</span> ${escapeText(store.room)}</p></div>
          </button>`;
          card.querySelector('button').addEventListener('click', () => openStoreModal(store));
          card.querySelector('img').addEventListener('error', function () { if (!this.dataset.fallback) { this.dataset.fallback='true'; this.src='./assets/lifestyle/mall-day.webp'; this.classList.add('is-photo'); } });
          gridContainer.appendChild(card);
        });
        if (window.animateStoreCards) window.animateStoreCards();
      }
      function resetFilters() { search.value=''; floorFilter.value='all'; activeCategory='all'; updateCategoryButtons(); renderStores(); }
      function updateCategoryButtons() { document.querySelectorAll('.category-chip[data-category]').forEach(button => { const active=button.dataset.category===activeCategory; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); }); }
      document.querySelectorAll('.category-chip[data-category]').forEach(button => button.addEventListener('click',()=>{activeCategory=button.dataset.category; updateCategoryButtons(); renderStores();}));
      let searchTimer;
      search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderStores,120);});
      floorFilter.addEventListener('change',renderStores); reset.addEventListener('click',resetFilters);
      document.addEventListener('keydown',event=>{if(event.key==='/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.getElementById('storeModalBackdrop').classList.contains('is-open')) {event.preventDefault();search.focus();}});

      // ── 4. BLUEPRINT SWITCHER ─────────────────────────────────
      const currentMapTitle = document.getElementById('currentMapFloorTitle');
      const svgUnitsGroup = document.getElementById('svgUnitsGroup');
      const blueprintCount = document.getElementById('blueprintUnitCount');

      function switchFloorBlueprint(floorKey, targetStoreName) {
        const bp = floorBlueprints[floorKey] || floorBlueprints["Ground Floor"];
        currentMapTitle.textContent = bp.title;
        blueprintCount.textContent = bp.count;
        svgUnitsGroup.innerHTML = bp.svg;
        document.getElementById('blueprintSvg').setAttribute('viewBox', `0 0 800 ${bp.height || 400}`);
        document.querySelectorAll('.blueprint-tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.mapFloor === floorKey)));

        document.querySelectorAll('.svg-store-zone').forEach(zone => {
          zone.setAttribute('tabindex', '0');
          zone.setAttribute('role', 'button');
          zone.setAttribute('aria-label', `View ${zone.getAttribute('data-store-name')} details`);
          zone.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); zone.dispatchEvent(new MouseEvent('click')); }
          });
          zone.addEventListener('click', function () {
            const storeName = zone.getAttribute('data-store-name');
            const found = allStores.find(s => s.name.toLowerCase() === storeName.toLowerCase()) || { name: storeName, floor: floorKey, room: 'Unit', category: 'Retail', description: 'Explore this premier brand at Mombasa Mall.' };
            openStoreModal(found);
          });
        });
        if (window.animateStoreMap) window.animateStoreMap();

        if (targetStoreName) {
          const matchedZone = [...document.querySelectorAll('.svg-store-zone')].find(zone => zone.dataset.storeName === targetStoreName);
          if (matchedZone) {
            document.querySelectorAll('.svg-store-zone').forEach(z => z.classList.remove('is-spotlight'));
            matchedZone.classList.add('is-spotlight');
            setTimeout(() => matchedZone.classList.remove('is-spotlight'), 4500);
          }
        }
      }

      window.highlightUnitOnMap = function (storeName, floor) {
        const targetFloor = floor || "Ground Floor";
        document.querySelectorAll('.blueprint-tab').forEach(t => {
          t.classList.toggle('active', t.getAttribute('data-map-floor') === targetFloor);
        });
        document.getElementById('floorMapSection').open = true;
        switchFloorBlueprint(targetFloor, storeName);
        document.getElementById('floorMapSection')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      };

      document.querySelectorAll('.blueprint-tab').forEach(tab => {
        tab.addEventListener('click', function () {
          document.querySelectorAll('.blueprint-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const floorKey = tab.getAttribute('data-map-floor');
          switchFloorBlueprint(floorKey);
        });
      });

      // ── 6. POP-UP MODAL CONTROLLER ───────────────────────────
      const modalBackdrop = document.getElementById('storeModalBackdrop');
      const modalCloseBtn = document.getElementById('modalCloseBtn');
      const modalHeroImg = document.getElementById('modalHeroImg');
      const modalLogoImg = document.getElementById('modalLogoImg');
      const modalTitle = document.getElementById('modalTitle');
      const modalUnit = document.getElementById('modalUnit');
      const modalCatPill = document.getElementById('modalCatPill');
      const modalFloorPill = document.getElementById('modalFloorPill');
      const modalDesc = document.getElementById('modalDesc');
      const modalHoursVal = document.getElementById('modalHoursVal');
      const modalPhoneVal = document.getElementById('modalPhoneVal');
      const modalEmailVal = document.getElementById('modalEmailVal');
      const modalLocVal = document.getElementById('modalLocVal');
      const modalCallBtn = document.getElementById('modalCallBtn');
      const modalSocialChannels = document.getElementById('modalSocialChannels');
      const modalLocateMapBtn = document.getElementById('modalLocateMapBtn');

      let currentModalStore = null;
      let modalReturnFocus = null;
      modalBackdrop.setAttribute('role', 'dialog');
      modalBackdrop.setAttribute('aria-modal', 'true');
      modalBackdrop.setAttribute('aria-labelledby', 'modalTitle');

      function openStoreModal(store) {
        modalReturnFocus = document.activeElement;
        currentModalStore = store;
        modalTitle.textContent = store.name;
        modalUnit.textContent = `${store.floor || 'Ground'} · Unit ${store.room || '—'}`;
        modalCatPill.textContent = store.category || 'Retail';
        modalFloorPill.textContent = store.floor || 'Ground Floor';
        modalDesc.textContent = store.description || 'Welcome to Mombasa Mall.';
        modalHoursVal.textContent = store.name.includes('Naivas') ? 'Open 24 Hours · 7 Days' : 'Contact the store for hours';
        modalPhoneVal.textContent = store.phone || '+254 790 964 002';
        modalEmailVal.textContent = store.email || 'info@mombasamall.co.ke';
        modalLocVal.textContent = `Unit ${store.room || '—'}, ${store.floor || 'Ground'}`;

        modalLogoImg.src = store.logoUrl || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png';
        modalHeroImg.src = store.photo || store.logoUrl;
        modalHeroImg.classList.toggle('is-photo', store.photoFit === 'cover');
        modalHeroImg.alt = store.name;
        modalLogoImg.alt = store.name;

        const phoneClean = (store.phone || '+254790964002').replace(/[^0-9+]/g, '');
        modalCallBtn.href = `tel:${phoneClean}`;

        // Render multi-platform social media channels
        modalSocialChannels.innerHTML = '';
        if (store.website) {
          modalSocialChannels.innerHTML += `<a href="${escapeText(store.website)}" target="_blank" rel="noopener" class="sm-channel-btn">Visit website ↗</a>`;
        }
        const waLink = `https://wa.me/${phoneClean.replace('+', '')}?text=Hello%20${encodeURIComponent(store.name)}%2C%20I%20am%20inquiring%20via%20Mombasa%20Mall%20Directory`;
        modalSocialChannels.innerHTML += `<a href="${waLink}" target="_blank" rel="noopener" class="sm-channel-btn whatsapp">💬 WhatsApp</a>`;

        if (assetPath(store.instagram)) {
          modalSocialChannels.innerHTML += `<a href="${escapeText(assetPath(store.instagram))}" target="_blank" rel="noopener" class="sm-channel-btn instagram">📸 Instagram</a>`;
        }
        if (assetPath(store.facebook)) {
          modalSocialChannels.innerHTML += `<a href="${escapeText(assetPath(store.facebook))}" target="_blank" rel="noopener" class="sm-channel-btn facebook">👤 Facebook</a>`;
        }
        if (assetPath(store.tiktok)) {
          modalSocialChannels.innerHTML += `<a href="${escapeText(assetPath(store.tiktok))}" target="_blank" rel="noopener" class="sm-channel-btn tiktok">🎵 TikTok</a>`;
        }

        modalBackdrop.classList.add('is-open');
        document.querySelector('.subpage-content').inert = true;
        modalBackdrop.setAttribute('aria-hidden', 'false');
        modalCloseBtn.focus({ preventScroll: true });
        if (window.gsap && !prefersReducedMotion()) {
          gsap.fromTo('.store-modal-body > *', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .4, stagger: .04, overwrite: true, clearProps: 'opacity,transform' });
        }
      }

      window.triggerStoreByName = function (storeName) {
        const found = allStores.find(s => s.name.toLowerCase().includes(storeName.toLowerCase()));
        if (found) openStoreModal(found);
      };

      function closeModal() {
        modalBackdrop.classList.remove('is-open');
        document.querySelector('.subpage-content').inert = false;
        modalBackdrop.setAttribute('aria-hidden', 'true');
        if (modalReturnFocus && modalReturnFocus.isConnected) modalReturnFocus.focus({ preventScroll: true });
      }

      modalCloseBtn?.addEventListener('click', closeModal);
      modalBackdrop?.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop.classList.contains('is-open')) closeModal();
        if (e.key === 'Tab' && modalBackdrop.classList.contains('is-open')) {
          const controls = [...modalBackdrop.querySelectorAll('button, a[href]')].filter(el => el.getClientRects().length);
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });

      modalLocateMapBtn?.addEventListener('click', () => {
        if (currentModalStore) {
          closeModal();
          window.highlightUnitOnMap(currentModalStore.name, currentModalStore.floor);
        }
      });

      // ── 7. INITIALIZATION ─────────────────────────────────────
      switchFloorBlueprint("Ground Floor");
      renderStores();
      function revealLinkedFloor() {
        const slug = location.hash.slice(1);
        if (slug.startsWith('store-')) {
          const store = allStores.find(store => 'store-' + store.room.toLowerCase() === slug);
          if (!store) return;
          if (!document.getElementById(slug)) resetFilters();
          document.getElementById(slug)?.scrollIntoView({behavior: 'auto', block: 'center'});
          openStoreModal(store);
          return;
        }
        const meta = floorMeta.find(floor => floor[1] === slug);
        if (meta) { resetFilters(); floorFilter.value=meta[0]; renderStores(); document.getElementById('directorySection').scrollIntoView({behavior:'auto'}); }
      }
      document.querySelectorAll('.quick-picks a[href^="#store-"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();history.replaceState(null,'',location.pathname+location.search+link.getAttribute('href'));revealLinkedFloor();}));
      window.addEventListener('hashchange', revealLinkedFloor);
      requestAnimationFrame(revealLinkedFloor);
    })();
