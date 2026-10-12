/* ============================================================
   Triple 7 Holdings — smooth scrolling
   ------------------------------------------------------------
   Reproduces the scroll feel of triple7holdings.co.za.

   That site runs Lenis. Confirmed by inspection rather than
   assumption: its <html> carries the `lenis lenis-smooth`
   classes while scrolling, and its bundle contains the Lenis
   virtual-scroll core. No custom option object appears in its
   application code, so it runs the library's stock settings —
   which is what is reproduced below.

     lerp 0.1          the damping that gives the long, even
                       glide; nothing is "animated" per notch,
                       the view eases toward the real scroll
                       position every frame
     wheelMultiplier 1 one notch travels the same distance as a
                       native scroll, so it feels responsive
                       rather than sluggish
     syncTouch false   touch is left ALONE. Lenis does not smooth
                       it by default and neither does the
                       reference site; phones keep their native
                       momentum, which is what users expect and
                       what any JS substitute gets wrong.

   Scope note: this file only changes how scrolling feels. It
   does not move, restyle or animate anything on the page.
   ============================================================ */
(function () {
  if (typeof Lenis !== 'function') return;

  /* Someone who has asked their system to reduce motion does not
     want inertia applied to their scrolling. Leave them native. */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  const lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
    syncTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1,
    /* In-page #hash links ease with the same curve instead of
       jumping, which is how the reference behaves. */
    anchors: true
  });

  /* Lenis advances on its own rAF loop. autoRaf is not used here so
     the loop can be stopped cleanly if motion preferences change. */
  let running = true;
  function raf(time) {
    if (!running) return;
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  /* Respond if the preference is toggled mid-session. */
  const onPrefChange = e => {
    if (e.matches) {
      running = false;
      lenis.destroy();
    }
  };
  if (reduced.addEventListener) reduced.addEventListener('change', onPrefChange);

  /* Anything that scrolls on its own — the Trade Desk's market
     strip, modals, overflow panes — opts out with
     data-lenis-prevent so the wheel still works inside it. */

  /* Exposed for debugging and for any page script that wants to
     drive a scroll through the same easing. */
  window.__t7Lenis = lenis;
})();
