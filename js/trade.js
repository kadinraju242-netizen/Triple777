/* ============================================================
   Triple 7 Holdings — Trade Desk shared layer
   ------------------------------------------------------------
   Loaded on every page. Provides:
     T7.esc()        — escaping for anything from the database
     T7.watchlist    — lots a buyer has saved
     T7.lotMedia()   — lot imagery with a graceful fallback
     T7.toast()      — transient confirmations

   There is no basket. A commodities desk is approached lot by
   lot: you open a lot and request a quote on it. Saving a lot to
   a watchlist is a bookmark, not a step towards purchase, and it
   carries no price — because until the desk issues written terms
   no price exists.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {

  T7.esc = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ---------- Lot imagery ---------- */
  const GEM  = '<path d="M30 22h40l18 20-38 40L12 42z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
               '<path d="M12 42h76M30 22l8 20 12 40 12-40 8-20M38 42l12-20 12 20" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55" stroke-linejoin="round"/>';
  const BARS = '<rect x="16" y="38" width="68" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/>' +
               '<rect x="24" y="58" width="52" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/>' +
               '<rect x="30" y="22" width="40" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".6"/>';
  const MARKS = {
    diamond: '<path d="M32 8h36l12 12v60L68 92H32L20 80V20z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
             '<path d="M28 18h44l6 6v52l-6 6H28l-6-6V24z" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/>',
    gold: BARS, platinum: BARS, silver: BARS,
    ruby: GEM, sapphire: GEM, emerald: GEM, tanzanite: GEM
  };

  /* Stones get a cut outline; everything else (metals, ores, coal,
     minerals) gets its chemical symbol, set like a periodic-table tile. */
  T7.lotMark = function (commodity) {
    const c = T7.catalog && T7.catalog.get(commodity);
    if (MARKS[commodity] && (!c || c.unit === 'ct')) {
      return '<svg class="lot-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + MARKS[commodity] + '</svg>';
    }
    if (c && c.symbol) {
      return '<span class="lot-symbol' + (c.symbol.length > 3 ? ' is-long' : '') + '" aria-hidden="true"><b>' + T7.esc(c.symbol) + '</b><small>' + T7.esc(c.label) + '</small></span>';
    }
    return '<svg class="lot-mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' + (MARKS[commodity] || MARKS.diamond) + '</svg>';
  };

  T7.lotMedia = function (lot, opts) {
    const o = opts || {};
    const src = o.card ? (lot.image_card || lot.image) : lot.image;
    const alt = lot.image_alt || lot.name || '';
    const group = T7.catalog && T7.catalog.groupOf(lot.commodity);
    return '<div class="lot-media c-' + T7.esc(lot.commodity || 'diamond') + (group ? ' g-' + group.key : '') + (o.wide ? ' is-wide' : '') + (o.thumb ? ' is-thumb' : '') + '">' +
             T7.lotMark(lot.commodity) +
             (src ? '<img class="lot-photo" src="' + T7.esc(src) + '" alt="' + T7.esc(alt) + '" loading="lazy" decoding="async">' : '') +
           '</div>';
  };

  /* One lot on the board (and under "More …" on a lot page). */
  T7.lotCard = function (l) {
    const esc = T7.esc, cat = T7.catalog;
    const href = 'lot.html?id=' + encodeURIComponent(l.lot_id);
    return '<article class="lot-card">' +
             '<a href="' + href + '" aria-hidden="true" tabindex="-1">' + T7.lotMedia(l, { card: true }) + '</a>' +
             '<div class="lot-card-body">' +
               '<div class="lot-meta">' +
                 '<span class="tag">' + esc(cat.label(l.commodity)) + '</span>' +
                 (l.latest ? '<span class="tag is-verified">New</span>' : '') +
                 '<span class="lot-id">' + esc(l.lot_id) + '</span>' +
               '</div>' +
               '<a class="lot-name" href="' + href + '">' + esc(l.name) + '</a>' +
               '<p class="lot-desc">' + esc(cat.summary(l).join(', ')) + '</p>' +
               '<div class="lot-foot">' +
                 '<span class="lot-price">' + esc(cat.money(l.price_zar)) + '</span>' +
                 '<a class="text-link lot-open" href="' + href + '">View lot</a>' +
               '</div>' +
             '</div>' +
           '</article>';
  };

  document.addEventListener('load', e => {
    const img = e.target;
    if (img.classList && img.classList.contains('lot-photo')) {
      const media = img.closest('.lot-media');
      if (media) media.classList.add('has-photo');
    }
  }, true);

  document.addEventListener('error', e => {
    const img = e.target;
    if (img.classList && img.classList.contains('lot-photo')) img.remove();
  }, true);

  /* ---------- Watchlist ---------- */
  const KEY = 't7.watchlist';

  function read() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('t7:watchlist', { detail: list }));
  }

  T7.watchlist = {
    items: read,
    count: () => read().length,
    has: id => read().some(i => i.lot_id === id),

    add(lot) {
      const list = read();
      if (list.some(i => i.lot_id === lot.lot_id)) return false;
      list.push({
        lot_id: lot.lot_id,
        name: lot.name,
        commodity: lot.commodity,
        type: lot.type,
        pricing: lot.pricing,
        image_card: lot.image_card || lot.image || null,
        added: new Date().toISOString()
      });
      write(list);
      return true;
    },

    remove(id) { write(read().filter(i => i.lot_id !== id)); },
    clear() { write([]); }
  };

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  T7.toast = function (message, action) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = '<span>' + T7.esc(message) + '</span>' +
      (action ? '<a href="' + T7.esc(action.href) + '">' + T7.esc(action.label) + '</a>' : '');
    requestAnimationFrame(() => toastEl.classList.add('is-up'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-up'), 4600);
  };

  T7.COMMODITY_LABEL = {
    diamond: 'Diamond', gold: 'Gold', platinum: 'Platinum', silver: 'Silver',
    ruby: 'Ruby', sapphire: 'Sapphire', emerald: 'Emerald', tanzanite: 'Tanzanite'
  };

  /* Relative time for dashboards. Nothing here claims to be live. */
  T7.ago = function (iso) {
    if (!iso) return '';
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return Math.floor(secs / 60) + ' min ago';
    if (secs < 86400) return Math.floor(secs / 3600) + ' hr ago';
    if (secs < 86400 * 60) return Math.floor(secs / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };
})();
