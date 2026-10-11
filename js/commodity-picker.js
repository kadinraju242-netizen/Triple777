/* ============================================================
   Triple 7 Holdings — the "what is it?" step
   ------------------------------------------------------------
   Thirty commodities is too many for one row of buttons, so the
   seller's "List a lot" form and the buyer's "Request a commodity"
   form both use this: a row of groups, and the commodities of the
   chosen group as tiles. Same look in both forms.

   T7.picker.html(name, selected)   the markup
   T7.picker.wire(root, onPick)     group switching; onPick(key) on change
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const esc = s => T7.esc(s);

  function tiles(name, groupKey, selected) {
    const cat = T7.catalog;
    const g = cat.group(groupKey);
    return g.items.map(key => {
      const c = cat.get(key);
      return '<label class="role-card pick-tile">' +
               '<input type="radio" name="' + esc(name) + '" value="' + key + '"' + (selected === key ? ' checked' : '') + '>' +
               '<span class="pick-symbol" aria-hidden="true">' + esc(c.symbol || c.label.slice(0, 2)) + '</span>' +
               '<span class="role-title">' + esc(c.label) + '</span>' +
             '</label>';
    }).join('');
  }

  function html(name, selected) {
    const cat = T7.catalog;
    const group = (selected && cat.get(selected) && cat.get(selected).group) || cat.groups[0].key;
    return '<fieldset class="pick td-pick" data-picker="' + esc(name) + '"><legend class="sr-only">Commodity</legend>' +
             '<div class="pick-groups" role="group" aria-label="Commodity group">' +
               cat.groups.map(g => '<button type="button" data-pick-group="' + g.key + '" aria-pressed="' + (g.key === group) + '">' + esc(g.label) + '</button>').join('') +
             '</div>' +
             '<div class="pick-grid" data-pick-tiles>' + tiles(name, group, selected) + '</div>' +
           '</fieldset>';
  }

  function wire(root, onPick) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-pick-group]');
      if (!b) return;
      const box = b.closest('[data-picker]');
      const name = box.dataset.picker;
      const checked = box.querySelector('input:checked');
      box.querySelectorAll('[data-pick-group]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      box.querySelector('[data-pick-tiles]').innerHTML = tiles(name, b.dataset.pickGroup, checked ? checked.value : null);
      /* Picking a group picks its first commodity, so the details below
         always match what is shown. */
      const keep = box.querySelector('input:checked');
      if (!keep) {
        const first = box.querySelector('input[type=radio]');
        first.checked = true;
        onPick(first.value);
      }
    });
  }

  T7.picker = { html: html, wire: wire };
})();
