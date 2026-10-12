/* ============================================================
   Triple 7 Holdings — "What We Offer" automatic slideshow
   ------------------------------------------------------------
   Plays the six existing offer stages on a timer. There are no
   controls by design: the section advances on its own and the page
   scrolls normally around it. Nothing here touches the scroll
   position, so the Lenis scrolling set up elsewhere is unaffected.

   Cost: one setTimeout at a time and one IntersectionObserver.
   No work happens on scroll, and the timer stops completely when
   the section is off screen or the tab is in the background.
   ============================================================ */
(function () {
  var stage = document.querySelector('[data-offer-stage]');
  if (!stage) return;

  var slides = Array.prototype.slice.call(stage.querySelectorAll('[data-slide]'));
  var texts  = Array.prototype.slice.call(stage.querySelectorAll('[data-text]'));
  var segs   = Array.prototype.slice.call(stage.querySelectorAll('[data-seg]'));
  var total  = slides.length;

  /* If the markup is ever trimmed to a single stage there is nothing
     to play; leave it showing as a still. */
  if (total < 2 || texts.length !== total) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Each stage is held long enough to actually read it. The floor
     covers the short captions, the ceiling stops the longest one
     (Consulting) from stalling the section. */
  var dwell = texts.map(function (t) {
    var desc  = t.querySelector('.offer-text-desc');
    var words = desc ? desc.textContent.trim().split(/\s+/).length : 0;
    return Math.min(8200, Math.max(5000, 2800 + words * 250));
  });

  var index   = 0;
  var timer   = null;
  var outTimer = null;
  var onScreen = false;

  function setRail(live) {
    segs.forEach(function (s, n) {
      s.classList.remove('is-done', 'is-live');
      if (n < index) s.classList.add('is-done');
    });
    var seg = segs[index];
    if (!seg) return;
    seg.style.setProperty('--os-dur', dwell[index] + 'ms');
    if (!live) return;
    /* Force a frame so the fill restarts from zero rather than
       inheriting the previous segment's finished state. */
    void seg.offsetWidth;
    seg.classList.add('is-live');
  }

  function show(next, animate) {
    var prevText = texts[index];

    slides[index].classList.remove('is-active');
    prevText.classList.remove('is-active');

    if (animate) {
      prevText.classList.add('is-out');
      clearTimeout(outTimer);
      outTimer = setTimeout(function () {
        prevText.classList.remove('is-out');
      }, 380);
    }

    index = next;
    slides[index].classList.add('is-active');
    texts[index].classList.add('is-active');

    setRail(true);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      show((index + 1) % total, true);
      schedule();
    }, dwell[index]);
  }

  /* The slides are stacked, so only the active one is ever painted and
     the lazy loader can leave the rest untouched — which loses a race
     on a slow connection, because a stage would arrive before its
     photograph. The set is fetched once, when the section first comes
     into view. Six files: what the card grid this replaced loaded. */
  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    slides.forEach(function (s) {
      var img = s.querySelector('img');
      if (img && img.loading === 'lazy') img.loading = 'eager';
    });
  }

  function play() {
    if (timer || !onScreen || document.hidden) return;
    warm();
    setRail(true);
    schedule();
  }

  function pause() {
    clearTimeout(timer);
    timer = null;
    setRail(false);   /* drop the fill rather than let it drift on */
  }

  /* Settle on the first stage before anything is wired up, so a
     watcher that reports back synchronously is not immediately
     cancelled by this reset. Nothing is playing yet. */
  show(0, false);
  pause();

  /* Only runs while the section is actually in front of someone.
     The negative margins mean it starts when the block reaches the
     middle band of the viewport and stops once it has left it. */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) play(); else pause();
    }, { rootMargin: '-12% 0px -12% 0px', threshold: 0 }).observe(stage);
  } else {
    onScreen = true;
    play();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause(); else play();
  });

  /* Honour a motion preference that is changed mid-visit. */
  if (reduced.addEventListener) {
    reduced.addEventListener('change', function () {
      pause();
      play();
    });
  }
})();
