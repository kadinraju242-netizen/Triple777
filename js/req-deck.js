/* ============================================================
   Triple 7 Holdings — "Before we can assess it" card deck
   ------------------------------------------------------------
   A deck you can handle: drag or swipe the top card, click one of
   the cards peeking behind it, jump straight to a requirement by
   name, or use the arrows and arrow keys.

   Changing cards is direction-aware. The card you push away lifts,
   drifts off and rotates a little against the travel while fading;
   the next one comes forward from 96% to full size as its image
   settles out of a slight zoom and the copy follows behind.

   Everything is the Web Animations API, the same approach as the
   home page journey (js/journey.js) — no library. Under
   prefers-reduced-motion none of it runs and the card simply
   changes.
   ============================================================ */
(() => {
  const deck = document.querySelector('[data-req-deck]');
  if (!deck) return;

  const stack = deck.querySelector('.req-deck-stack');
  const cards = [...deck.querySelectorAll('[data-req-card]')];
  const count = deck.querySelector('[data-req-count]');
  const total = cards.length;
  if (total < 2) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(.22,.61,.36,1)';
  const CARD_MS = 560;      /* the main transition */
  const TEXT_MS = 400;
  const STAGGER = 140;

  let current = 0;
  let locked = false;       /* stops a rapid click landing mid-transition */

  /* ---------- jump straight to a requirement ----------
     Built from the headings already in the markup, so the cards stay
     the single source of truth. */
  const tabs = document.createElement('div');
  tabs.className = 'req-deck-tabs';
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Choose a requirement');
  const tabButtons = cards.map((card, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = card.querySelector('h3').textContent;
    b.addEventListener('click', () => go(i));
    tabs.append(b);
    return b;
  });
  stack.before(tabs);

  /* ---------- resting layout ---------- */
  function paint() {
    cards.forEach((card, i) => {
      const d = (i - current + total) % total;     // 0 = front of the deck
      card.style.setProperty('--d', d);
      card.style.zIndex = String(total - d);
      card.classList.toggle('is-front', d === 0);
      card.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
      /* Only the cards you can actually see are worth clicking. */
      card.style.pointerEvents = d <= 2 ? 'auto' : 'none';
      if (d !== 0) { card.style.removeProperty('--px'); card.style.removeProperty('--py'); }
    });
    tabButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === current)));
  }

  /* The indicator slides out and back rather than snapping. */
  function setCount(animate) {
    const text = String(current + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    if (!animate || reduced.matches) { count.textContent = text; return; }
    count.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-7px)' }],
      { duration: 150, easing: 'ease-in' }
    );
    /* Swapped on a timer rather than the animation's onfinish: a
       throttled or cancelled animation must never leave the indicator
       showing the wrong number. The latest change always wins. */
    clearTimeout(count._swap);
    count._swap = setTimeout(() => {
      count.textContent = text;
      count.animate(
        [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 230, easing: EASE }
      );
    }, 150);
  }

  /* ---------- the change ---------- */
  function go(next, dir) {
    if (locked || next === current) return;
    if (dir === undefined) {
      /* Shortest way round, so 04 to 01 travels forwards. */
      const forward = (next - current + total) % total;
      dir = forward <= total / 2 ? 1 : -1;
    }

    const outgoing = cards[current];
    current = next;
    paint();
    setCount(true);

    if (reduced.matches) return;

    locked = true;
    setTimeout(() => { locked = false; }, CARD_MS * 0.72);

    /* The card you pushed away lifts, drifts and turns against travel. */
    outgoing.style.zIndex = String(total + 1);
    if (outgoing._anim) outgoing._anim.cancel();
    outgoing._anim = outgoing.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${dir * -18}%, -1%) rotate(${dir * -2}deg) scale(1.015)`, opacity: .92, offset: .22 },
      { transform: `translate(${dir * -118}%, 3%) rotate(${dir * -7}deg) scale(.93)`, opacity: 0, offset: 1 }
    ], { duration: CARD_MS, easing: 'cubic-bezier(.4,0,.2,1)' });
    outgoing._anim.onfinish = () => { outgoing.style.zIndex = ''; paint(); };

    /* The next one comes forward out of the stack. */
    const incoming = cards[current];
    if (incoming._anim) incoming._anim.cancel();
    incoming._anim = incoming.animate([
      { transform: `translate(${dir * 3}%, 9px) rotate(${dir * 0.9}deg) scale(.965)`, opacity: .55 },
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 }
    ], { duration: CARD_MS, easing: EASE });

    /* Its photograph settles out of a slight zoom rather than cutting. */
    const img = incoming.querySelector('.req-card-media img');
    if (img) img.animate(
      [{ transform: 'scale(1.035)', opacity: .65 }, { transform: 'scale(1)', opacity: 1 }],
      { duration: CARD_MS + 80, easing: EASE }
    );

    /* Heading, then description. */
    incoming.querySelectorAll('.req-card-body > *').forEach((el, i) => {
      el.animate(
        [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: TEXT_MS, delay: 150 + i * STAGGER, easing: EASE, fill: 'backwards' }
      );
    });
  }

  const step = by => go((current + by + total) % total, by > 0 ? 1 : -1);

  /* ---------- arrows and keys ---------- */
  deck.querySelectorAll('[data-req-step]').forEach(button => {
    button.addEventListener('click', () => step(Number(button.dataset.reqStep)));
  });
  deck.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft')  { step(-1); event.preventDefault(); }
    if (event.key === 'ArrowRight') { step(1);  event.preventDefault(); }
  });

  /* ---------- click a card behind to bring it forward ---------- */
  cards.forEach((card, i) => card.addEventListener('click', () => {
    if (i !== current && !dragged) go(i);
  }));

  /* ---------- drag and swipe ----------
     touch-action: pan-y in the stylesheet means a vertical swipe still
     scrolls the page; only sideways movement counts as a throw. */
  let startX = 0, startY = 0, dx = 0, dragging = false, dragged = false, pid = null;

  stack.addEventListener('pointerdown', event => {
    if (event.button !== 0 || locked) return;
    const front = cards[current];
    if (!front.contains(event.target)) return;
    dragging = true; dragged = false;
    startX = event.clientX; startY = event.clientY; dx = 0; pid = event.pointerId;
    front.style.transition = 'none';
  });

  stack.addEventListener('pointermove', event => {
    if (!dragging) return;
    dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragged && Math.abs(dy) > Math.abs(dx)) { release(false); return; }
    if (Math.abs(dx) > 4) {
      dragged = true;
      try { cards[current].setPointerCapture(pid); } catch (e) {}
    }
    cards[current].style.transform = `translateX(${dx}px) rotate(${dx * 0.018}deg)`;
  });

  function release(commit) {
    if (!dragging) return;
    dragging = false;
    const front = cards[current];
    try { front.releasePointerCapture(pid); } catch (e) {}
    front.style.transition = '';
    front.style.transform = '';
    const threshold = Math.min(110, front.offsetWidth * 0.22);
    if (commit && Math.abs(dx) > threshold) step(dx < 0 ? 1 : -1);
    dx = 0;
    setTimeout(() => { dragged = false; }, 0);
  }

  stack.addEventListener('pointerup', () => release(true));
  stack.addEventListener('pointercancel', () => release(false));
  stack.addEventListener('pointerleave', () => release(true));

  /* ---------- a few pixels of parallax, mouse only ----------
     Deliberately tiny: the card leans about 3px towards the cursor.
     Fed in as custom properties so it composes with the resting
     transform in the stylesheet instead of fighting it. */
  if (matchMedia('(pointer: fine)').matches && !reduced.matches) {
    const MAX = 3;
    stack.addEventListener('pointermove', event => {
      if (dragging || locked) return;
      const r = stack.getBoundingClientRect();
      const front = cards[current];
      front.style.setProperty('--px', (((event.clientX - r.left) / r.width - .5) * 2 * MAX).toFixed(2) + 'px');
      front.style.setProperty('--py', (((event.clientY - r.top) / r.height - .5) * 2 * MAX).toFixed(2) + 'px');
    });
    stack.addEventListener('pointerleave', () => {
      cards[current].style.removeProperty('--px');
      cards[current].style.removeProperty('--py');
    });
  }

  paint();
  setCount(false);
})();
