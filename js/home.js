/* Preview uses the same data source and existing lot detail/quote journey as the board. */
(function () {
  const target = document.getElementById('home-lots');
  if (!target || !window.T7 || !T7.api) return;
  T7.api.listLots().then(lots => {
    if (!lots.length) {
      target.innerHTML = '<p>New listings will appear here. <a class="textlink" href="contact.html">Contact the desk </a></p>';
      return;
    }
    // Include both markets where possible; retain existing lot information.
    const featured = [];
    ['diamond', 'gold'].forEach(commodity => {
      const lot = lots.find(l => l.commodity === commodity);
      if (lot) featured.push(lot);
    });
    lots.forEach(l => { if (featured.length < 3 && !featured.includes(l)) featured.push(l); });
    target.innerHTML = featured.map(l => {
      const href = 'lot.html?id=' + encodeURIComponent(l.lot_id);
      return '<article class="lot-card"><a href="' + href + '" tabindex="-1" aria-hidden="true">' + T7.lotMedia(l, {card:true}) + '</a><div class="lot-card-body"><div class="lot-meta"><span class="lot-id">' + T7.esc(l.lot_id) + '</span><span class="tag">' + T7.esc(T7.COMMODITY_LABEL[l.commodity] || l.commodity) + '</span></div><a class="lot-name" href="' + href + '">' + T7.esc(l.name) + '</a><p class="lot-desc">' + T7.esc((l.descriptors || []).join(' · ')) + '</p><div class="lot-foot"><span class="lot-pricing">' + T7.esc(l.pricing || 'Quote on request') + '</span><a class="lot-open" href="' + href + '">View lot </a></div></div></article>';
    }).join('');
  }).catch(() => {
    target.innerHTML = '<p>Listings are temporarily unavailable. <a class="textlink" href="trade.html">Open the Trade Desk </a></p>';
  });
})();
