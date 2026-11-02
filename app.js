/* ─────────────────────────────────────────────
   EDIT YOUR DETAILS HERE
   ───────────────────────────────────────────── */
const CONFIG = {
  // Used by "Add Nikah to Calendar". Times are Pakistan time (PKT, UTC+5).
  events: [
    { title: 'Nikah Ceremony — Waheed & Jaweria', start: '2026-11-12T13:00', hours: 3, location: 'Pakistan Marriage Hall, Jhang Road, Bhowana' }
  ],
  // Quran recitation (Mishary Alafasy): Surah An-Naba from ayah 8 to the end.
  recitation: { surah: 78, from: 8, to: 40, folder: 'media/quran/' }
};

(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');

  const $ = (id) => document.getElementById(id);
  const hero = $('hero');
  const intro = $('intro');      // opening, part 1: the curtain parts
  const intro2 = $('intro2');    // opening, part 2: the camera moves in
  const loop = $('loop');
  const seal = $('seal');
  const hint = $('tapHint');
  const soundBtn = $('sound');
  const ayah = $('ayah');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let state = 'closed';        // closed → opening → looping
  const SCROLL_DELAY = 5000;   // ms after tapping the seal before guests can scroll

  /* ───── Videos (silent, already sped up 1.5x in the files) ─────
     The opening film is downloaded completely before the seal can be opened,
     so playback never waits on the network (no stutter). */
  [intro, intro2, loop].forEach((v) => { v.muted = true; });
  const loadBar = $('loadBar');
  const hintText = hint.querySelector('.hint-text');
  let ready = false;
  let tappedEarly = false;

  function fetchVideo(video, onProgress) {
    const url = video.dataset.src;
    if (!window.fetch || !window.ReadableStream || !window.URL || !URL.createObjectURL) {
      video.src = url; video.load(); return Promise.resolve();
    }
    return fetch(url).then((res) => {
      if (!res.ok || !res.body) throw new Error('fetch failed');
      const total = +res.headers.get('Content-Length') || 0;
      const reader = res.body.getReader();
      const chunks = []; let got = 0;
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) return;
        chunks.push(value); got += value.length;
        onProgress(total ? got / total : 0, got, total);
        return pump();
      });
      return pump().then(() => {
        video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
        video.load();
        return new Promise((resolve) => {
          if (video.readyState >= 3) return resolve();
          video.addEventListener('canplaythrough', resolve, { once: true });
          video.addEventListener('loadeddata', () => setTimeout(resolve, 200), { once: true });
        });
      });
    }).catch(() => { video.src = url; video.load(); });
  }

  // Only the short first part of the opening (~280 KB) gates the seal.
  // Part 2 and the loop download one after another while it plays.
  // On slow connections we also wait until part 2 is sure to arrive before
  // part 1 finishes playing (measured from this guest's real download speed).
  const PART1_SECONDS = 3;
  const t0 = performance.now();
  let rate = 0;                 // bytes per second, measured on part 1
  let part2Safe;
  const part2SafePromise = new Promise((r) => { part2Safe = r; });
  const introReady = fetchVideo(intro, (p, got) => {
    loadBar.style.setProperty('--load', Math.round(p * 100) + '%');
    rate = got / Math.max(0.05, (performance.now() - t0) / 1000);
  });
  const part2Ready = introReady.then(() => fetchVideo(intro2, (p, got, total) => {
    if (!total || !rate || (total - got) / rate <= PART1_SECONDS * 0.75) part2Safe();
  })).then(() => part2Safe());
  const loopReady = part2Ready.then(() => fetchVideo(loop, () => {}));
  introReady.then(() => {
    if (!rate) return true;                         // unknown speed: don't hold back
    return Promise.race([part2SafePromise, new Promise((r) => setTimeout(r, 8000))]);
  }).then(() => {
    ready = true;
    hint.classList.remove('is-loading');
    hero.classList.remove('is-loading');
    hintText.textContent = 'Tap to open';
    if (tappedEarly) open();
  });

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
    video.addEventListener('playing', () => setTimeout(fire, 250), { once: true });
  }

  let unlocked = false;
  let inviteShown = false;
  function showInvite() {
    if (inviteShown) return;
    inviteShown = true;
    document.body.classList.add('is-open');
    requestAnimationFrame(updateTimeline);
  }

  function unlockScroll() {
    if (unlocked) return;
    unlocked = true;
    showInvite();
    root.classList.remove('locked');
    setTimeout(() => hero.classList.add('show-cue'), 700);
  }

  function open() {
    if (state !== 'closed') return;
    if (!ready) {
      // Remember the tap; start the moment the film is ready.
      if (!tappedEarly) { tappedEarly = true; unlockAudio(); hintText.textContent = 'Opening…'; }
      return;
    }
    state = 'opening';
    hero.classList.add('is-opening');
    // Render the invitation (its photos/fonts) only once the films are in, or when scrolling unlocks.
    loopReady.then(showInvite);
    unlockAudio();                          // inside the tap, so audio is allowed later
    [intro2, loop].forEach((v) => { try { const p = v.play(); v.pause(); if (p) p.catch(() => {}); } catch (e) { /* ignore */ } });
    // Recitation begins together with the opening animation, not on the tap.
    onFirstFrame(intro, () => { hero.classList.add('is-playing'); beginRecitationOnce(); });
    intro.play().catch(() => startLoop());
    setTimeout(unlockScroll, SCROLL_DELAY);
  }

  // Part 1 → part 2: part 1 holds its last frame until part 2 has painted.
  function startPart2() {
    if (state !== 'opening') return;
    state = 'part2';
    part2Ready.then(() => {
      onFirstFrame(intro2, () => hero.classList.add('is-playing', 'is-part2'));
      intro2.play().catch(() => startLoop());
    });
  }

  function startLoop() {
    if (state === 'looping') return;
    state = 'looping';
    try { loop.currentTime = 0; } catch (e) { /* ignore */ }
    // The intro stays frozen on its last frame until the loop paints, then they swap.
    // If the loop film is still downloading, the opening stays on its last frame.
    loopReady.then(() => {
      onFirstFrame(loop, () => {
        hero.classList.add('is-playing', 'is-looping');
        beginRecitationOnce();
        unlockScroll();
      });
      loop.play().catch(() => {});
    });
  }

  intro.addEventListener('ended', startPart2);
  intro.addEventListener('error', () => { if (state !== 'closed') startPart2(); });
  intro2.addEventListener('ended', startLoop);
  intro2.addEventListener('error', () => { if (state !== 'closed') startLoop(); });
  loop.addEventListener('error', unlockScroll);
  seal.addEventListener('click', open);
  hint.addEventListener('click', open);

  /* ───── Quran recitation: ayah 8, then on through the surah ───── */
  const R = CONFIG.recitation;
  let current = R.from;
  let reciting = false;
  const file = (n) => R.folder + String(R.surah).padStart(3, '0') + String(n).padStart(3, '0') + '.mp3';
  const preloader = new Audio();
  preloader.preload = 'auto';

  function setAyah(n) {
    current = n;
    ayah.src = file(n);
    if (n < R.to) { preloader.src = file(n + 1); preloader.load(); }
  }
  function playCurrent() {
    const p = ayah.play();
    if (p) p.catch(() => setReciting(false));
  }
  function setReciting(on) {
    reciting = on;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Pause recitation' : 'Play recitation');
  }
  // Silently "unlock" the audio element during the guest's tap (needed on iPhone),
  // without letting any sound play yet.
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      ayah.muted = true;
      const p = ayah.play();
      ayah.pause();
      if (p) p.catch(() => {});
      ayah.currentTime = 0;
    } catch (e) { /* ignore */ }
    ayah.muted = false;
  }
  let recitationStarted = false;
  function beginRecitationOnce() {
    if (recitationStarted) return;
    recitationStarted = true;
    startRecitation();
  }
  function startRecitation() {
    setAyah(R.from);
    setReciting(true);
    playCurrent();
  }
  ayah.addEventListener('ended', () => {
    if (current < R.to) {
      setAyah(current + 1);
      if (reciting) playCurrent();
    } else {
      setReciting(false);
      setAyah(R.from);                       // ready to start again
    }
  });
  soundBtn.addEventListener('click', () => {
    if (reciting) { ayah.pause(); setReciting(false); }
    else { setReciting(true); playCurrent(); }
  });

  // Pause everything when the tab is hidden, resume when back.
  let resumeAyah = false;
  document.addEventListener('visibilitychange', () => {
    const v = state === 'looping' ? loop : state === 'part2' ? intro2 : state === 'opening' ? intro : null;
    if (document.hidden) {
      if (v) v.pause();
      resumeAyah = reciting && !ayah.paused;
      ayah.pause();
    } else {
      if (v) v.play().catch(() => {});
      if (resumeAyah) playCurrent();
    }
  });

  // Tapping the scroll button glides down to the invitation.
  $('cue').addEventListener('click', () => {
    $('invite').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) hero.classList.remove('show-cue');
  }, { passive: true });

  /* ───── Scroll reveal ───── */
  document.querySelectorAll('[data-stagger]').forEach((g) => {
    [...g.children].forEach((c, i) => c.style.setProperty('--i', i));
  });
  const revealables = document.querySelectorAll('[data-reveal], [data-stagger]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        ro.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach((el) => ro.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('is-in'));
  }

  /* ───── Timeline line fills as you scroll ───── */
  const timeline = $('timeline');
  const fill = $('timelineFill');
  let ticking = false;
  function updateTimeline() {
    ticking = false;
    const r = timeline.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (window.innerHeight * 0.75 - r.top) / r.height));
    fill.style.setProperty('--p', p.toFixed(3));
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateTimeline); }
  }, { passive: true });
  updateTimeline();

  /* ───── Add to calendar (.ics works with Google, Apple, Outlook) ───── */
  const pad = (n) => String(n).padStart(2, '0');
  function icsDate(local, addHours) {
    const d = new Date(local + ':00+05:00');
    d.setHours(d.getHours() + (addHours || 0));
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
  }
  const esc = (s) => s.replace(/[\\,;]/g, (m) => '\\' + m);
  $('calendarBtn').addEventListener('click', (ev) => {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Waheed Weds Jaweria//Invitation//EN', 'CALSCALE:GREGORIAN'];
    CONFIG.events.forEach((e, i) => {
      lines.push('BEGIN:VEVENT', 'UID:waheed-jaweria-' + i + '@invitation',
        'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
        'DTSTART:' + icsDate(e.start, 0), 'DTEND:' + icsDate(e.start, e.hours), 'SUMMARY:' + esc(e.title));
      if (e.location) lines.push('LOCATION:' + esc(e.location));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'Waheed-Jaweria-Nikah.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    const btn = ev.currentTarget; const label = btn.querySelector('span');
    btn.classList.add('done'); label.textContent = 'Calendar file downloaded — open it to save';
    setTimeout(() => { btn.classList.remove('done'); label.textContent = 'Add Nikah to Calendar (Google & Apple)'; }, 3500);
  });

  // Always start at the top (some browsers restore scroll on reload).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
})();
