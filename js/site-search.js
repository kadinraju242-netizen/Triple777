/* ============================================================
   Triple 7 Holdings — site search (Mine Projects)
   ------------------------------------------------------------
   Two things at once:

   1. The grid filters live as you type, against each card's name,
      province, commodity, mine type and status. Every term has to
      match, so "gold under" narrows rather than widens.

   2. Suggestions drop down under the field after one character,
      the way a search box is expected to behave. Pick one with the
      mouse, or with Up/Down and Enter, and it opens that mine.

   It is a real combobox — role, aria-expanded and
   aria-activedescendant are all set — so it announces itself
   properly rather than being a div that happens to look like one.

   Nothing is fetched. The cards are already in the markup, their
   links are already real, and this only ever hides rows: the list
   still works with JavaScript off.
   ============================================================ */
(() => {
  const input = document.querySelector('[data-site-search]');
  const grid  = document.querySelector('[data-site-grid]');
  if (!input || !grid) return;

  const cards = [...grid.querySelectorAll('[data-site]')];
  const countEl = document.querySelector('[data-site-count]');
  const emptyEl = document.querySelector('[data-site-empty]');
  const clearBtn = document.querySelector('[data-site-clear]');
  const total = cards.length;
  const MAX_SUGGESTIONS = 6;

  /* What each card is, read from the markup so the two never drift. */
  const sites = cards.map((card, i) => ({
    card,
    href: card.getAttribute('href'),
    name: card.querySelector('.card-name').textContent.trim(),
    meta: card.querySelector('.card-meta').textContent.trim(),
    hay:  card.dataset.search,
    id:   'site-option-' + i
  }));

  /* ---------- the dropdown ----------
     Built here rather than in the markup: with no JavaScript there is
     nothing to show, and an empty listbox in the HTML would just be
     noise for a screen reader. */
  const label = input.closest('.site-search-field');
  const box = document.createElement('div');
  box.className = 'site-search-box';
  label.replaceWith(box);
  box.append(label);

  const list = document.createElement('ul');
  list.className = 'site-suggest';
  list.id = 'site-suggest';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Matching sites');
  list.hidden = true;
  box.append(list);

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'site-suggest');
  input.setAttribute('aria-autocomplete', 'list');

  let matches = [];
  let active = -1;

  /* ---------- filtering the grid ---------- */
  function terms() {
    return input.value.toLowerCase().split(/\s+/).filter(Boolean);
  }

  function filter() {
    const t = terms();
    let shown = 0;
    cards.forEach(card => {
      const hit = t.every(term => card.dataset.search.includes(term));
      card.hidden = !hit;
      if (hit) shown++;
    });
    if (emptyEl) emptyEl.hidden = shown !== 0;
    if (countEl) countEl.textContent = t.length ? shown + ' of ' + total + ' sites' : 'All ' + total + ' sites';
  }

  /* ---------- suggestions ---------- */
  /* Marks the matched run inside the name, built from text nodes so a
     site name can never be read as markup. */
  function nameWithMatch(name, term) {
    const frag = document.createDocumentFragment();
    const at = term ? name.toLowerCase().indexOf(term) : -1;
    if (at === -1) { frag.append(name); return frag; }
    frag.append(name.slice(0, at));
    const mark = document.createElement('mark');
    mark.textContent = name.slice(at, at + term.length);
    frag.append(mark, name.slice(at + term.length));
    return frag;
  }

  function closeList() {
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    matches = [];
    active = -1;
  }

  function suggest() {
    const t = terms();
    if (!t.length) { closeList(); return; }

    matches = sites.filter(s => t.every(term => s.hay.includes(term))).slice(0, MAX_SUGGESTIONS);
    if (!matches.length) { closeList(); return; }

    list.replaceChildren();
    matches.forEach((s, i) => {
      const li = document.createElement('li');
      li.id = s.id;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');

      const name = document.createElement('span');
      name.className = 'site-suggest-name';
      name.append(nameWithMatch(s.name, t[0]));

      const meta = document.createElement('span');
      meta.className = 'site-suggest-meta';
      meta.textContent = s.meta;

      li.append(name, meta);
      /* mousedown, not click: blur would close the list first. */
      li.addEventListener('mousedown', event => { event.preventDefault(); choose(i); });
      li.addEventListener('mouseenter', () => highlight(i));
      list.append(li);
    });

    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  }

  function highlight(i) {
    active = i;
    [...list.children].forEach((li, n) => {
      const on = n === i;
      li.classList.toggle('is-active', on);
      li.setAttribute('aria-selected', String(on));
    });
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', matches[i].id);
      list.children[i].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function choose(i) {
    const site = matches[i];
    if (!site) return;
    closeList();
    location.href = site.href;
  }

  /* ---------- events ---------- */
  input.addEventListener('input', () => { filter(); suggest(); });
  input.addEventListener('search', () => { filter(); suggest(); });   // the field's own clear button
  input.addEventListener('focus', suggest);

  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      if (list.hidden) { suggest(); return; }
      event.preventDefault();
      highlight(active + 1 >= matches.length ? 0 : active + 1);
    } else if (event.key === 'ArrowUp') {
      if (list.hidden) return;
      event.preventDefault();
      highlight(active - 1 < 0 ? matches.length - 1 : active - 1);
    } else if (event.key === 'Enter') {
      if (active >= 0) { event.preventDefault(); choose(active); }
    } else if (event.key === 'Escape') {
      /* First Escape puts the list away, a second clears the field. */
      if (!list.hidden) { closeList(); }
      else if (input.value) { input.value = ''; filter(); }
    }
  });

  input.addEventListener('blur', () => setTimeout(closeList, 120));
  document.addEventListener('click', event => {
    if (!box.contains(event.target)) closeList();
  });

  if (clearBtn) clearBtn.addEventListener('click', () => {
    input.value = '';
    filter();
    closeList();
    input.focus();
  });

  filter();
})();
