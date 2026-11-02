(() => {
  'use strict';

  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const intro = document.getElementById('intro');
  const loop = document.getElementById('loop');
  const seal = document.getElementById('seal');
  const hint = document.getElementById('tapHint');
  const soundBtn = document.getElementById('sound');
  const panel = document.getElementById('panel');

  let state = 'closed';   // closed → opening → looping
  let muted = false;

  // Run cb once the video has actually painted a frame (avoids black flashes).
  function onFirstFrame(video, cb) {
    let done = false;
    const fire = () => { if (!done) { done = true; cb(); } };
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(fire);
    } else {
      const check = () => {
        if (video.currentTime > 0) { video.removeEventListener('timeupdate', check); fire(); }
      };
      video.addEventListener('timeupdate', check);
    }
    // Safety net in case the frame callback never arrives.
    video.addEventListener('playing', () => setTimeout(fire, 250), { once: true });
  }

  function safePlay(video) {
    video.muted = muted;
    const p = video.play();
    if (!p) return;
    p.catch(() => {
      // Browser refused sound — fall back to muted playback, user can unmute.
      setMuted(true);
      video.play().catch(() => {});
    });
  }

  function setMuted(m) {
    muted = m;
    intro.muted = m;
    loop.muted = m;
    soundBtn.setAttribute('aria-pressed', String(!m));
    soundBtn.setAttribute('aria-label', m ? 'Turn sound on' : 'Mute sound');
  }

  function unlockScroll() {
    root.classList.remove('locked');
    setTimeout(() => hero.classList.add('show-cue'), 700);
  }

  function open() {
    if (state !== 'closed') return;
    state = 'opening';
    hero.classList.add('is-opening');

    // Prime the loop video inside the tap so iOS lets it play with sound later.
    try {
      const p = loop.play();
      loop.pause();
      if (p) p.catch(() => {});
    } catch (e) { /* ignore */ }

    onFirstFrame(intro, () => hero.classList.add('is-playing'));
    safePlay(intro);
  }

  function startLoop() {
    if (state === 'looping') return;
    state = 'looping';
    try { loop.currentTime = 0; } catch (e) { /* ignore */ }
    // The intro stays on screen (frozen on its last frame) until the loop
    // has painted its first frame, then we swap — no gap, no flash.
    onFirstFrame(loop, () => {
      hero.classList.add('is-playing', 'is-looping');
      unlockScroll();
    });
    safePlay(loop);
  }

  intro.addEventListener('ended', startLoop);
  intro.addEventListener('error', () => { if (state !== 'closed') startLoop(); });
  loop.addEventListener('error', () => unlockScroll());

  seal.addEventListener('click', open);
  hint.addEventListener('click', open);

  soundBtn.addEventListener('click', () => {
    setMuted(!muted);
    const active = state === 'looping' ? loop : intro;
    if (!muted && active.paused && state !== 'closed') active.play().catch(() => {});
  });

  // Pause when the tab is hidden, resume when back.
  document.addEventListener('visibilitychange', () => {
    const active = state === 'looping' ? loop : (state === 'opening' ? intro : null);
    if (!active) return;
    if (document.hidden) active.pause();
    else active.play().catch(() => {});
  });

  // Hide the scroll cue once the guest starts scrolling.
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) hero.classList.remove('show-cue');
  }, { passive: true });

  // Reveal the names when the palace wall comes into view.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { panel.classList.add('in-view'); io.disconnect(); }
      });
    }, { threshold: 0.3 });
    io.observe(panel);
  } else {
    panel.classList.add('in-view');
  }

  // Always start at the top (some browsers restore scroll on reload).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
})();
