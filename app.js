/* ─────────────────────────────────────────────
   EDIT YOUR DETAILS HERE
   ───────────────────────────────────────────── */
const CONFIG = {
  // Family WhatsApp number that receives RSVPs (country code, digits only), e.g. '923001234567'.
  // Leave empty and guests will pick the contact themselves in WhatsApp.
  rsvpWhatsApp: '',
  // Shown in the Guest Concierge map.
  mapQuery: 'Bano Market, Bhowana',
  // Used by "Add Wedding Suite to Calendar". Times are Pakistan time (PKT, UTC+5).
  events: [
    { title: 'Nikah Ceremony — Waheed & Jaweria', start: '2026-11-12T13:00', hours: 3, location: 'Bano Market, Bhowana, Punjab, Pakistan' }
  ]};

(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const root = document.documentElement;
  const hero = document.getElementById('hero');
  const intro = document.getElementById('intro');
  const loop = document.getElementById('loop');
  const seal = document.getElementById('seal');
  const hint = document.getElementById('tapHint');
  const soundBtn = document.getElementById('sound');
  const ayah = document.getElementById('ayah');

  let state = 'closed';   // closed → opening → looping
  let muted = false;
  const SPEED = 1.5;          // playback speed for both videos
  const SCROLL_DELAY = 5000;  // ms after tapping the seal before guests can scroll
  [intro, loop].forEach((v) => {
    v.defaultPlaybackRate = SPEED;
    v.playbackRate = SPEED;
    if ('preservesPitch' in v) v.preservesPitch = true;
    v.addEventListener('play', () => { v.playbackRate = SPEED; });
  });

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
    ayah.muted = m;
    soundBtn.setAttribute('aria-pressed', String(!m));
    soundBtn.setAttribute('aria-label', m ? 'Turn sound on' : 'Mute sound');
    syncPlayer();
  }

  let unlocked = false;
  function unlockScroll() {
    if (unlocked) return;
    unlocked = true;
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

    try { const q = ayah.play(); ayah.pause(); if (q) q.catch(() => {}); ayah.currentTime = 0; } catch (e) { /* ignore */ }
    onFirstFrame(intro, () => hero.classList.add('is-playing'));
    safePlay(intro);
    setTimeout(unlockScroll, SCROLL_DELAY);
    syncPlayer();
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
      syncPlayer();
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

  // Always start at the top (some browsers restore scroll on reload).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ═════════════ Landing page ═════════════ */
  const $ = (id) => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Music player (controls the palace video's soundtrack)
  const player = $('player');
  const playerBtn = $('playerBtn');
  const playerSub = $('playerSub');
  function syncPlayer() {
    if (!player) return;
    const playing = !muted && state !== 'closed';
    player.classList.toggle('playing', playing);
    playerBtn.setAttribute('aria-pressed', String(playing));
    playerBtn.setAttribute('aria-label', playing ? 'Pause wedding music' : 'Play wedding music');
    playerSub.textContent = playing ? 'Now playing' : 'Tap to play the music';
  }
  playerBtn.addEventListener('click', () => {
    const active = state === 'looping' ? loop : intro;
    if (state === 'closed') { open(); return; }
    setMuted(!muted);
    if (!muted && active.paused) active.play().catch(() => {});
  });

  // Scroll reveal: fade/slide/zoom items + staggered groups
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

  // Timeline line fills as you scroll through the itinerary
  const timeline = $('timeline');
  const fill = $('timelineFill');
  let ticking = false;
  function updateTimeline() {
    ticking = false;
    const r = timeline.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / r.height));
    fill.style.setProperty('--p', p.toFixed(3));
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateTimeline); }
  }, { passive: true });
  updateTimeline();

  // Add to calendar (.ics works with Google, Apple and Outlook)
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
      lines.push('BEGIN:VEVENT', 'UID:waheed-jaweria-' + i + '@invitation', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
        'DTSTART:' + icsDate(e.start, 0), 'DTEND:' + icsDate(e.start, e.hours), 'SUMMARY:' + esc(e.title));
      if (e.location) lines.push('LOCATION:' + esc(e.location));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Waheed-Jaweria-Nikah.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    const btn = ev.currentTarget; const label = btn.querySelector('span');
    btn.classList.add('done'); label.textContent = 'Calendar file downloaded — open it to save';
    setTimeout(() => { btn.classList.remove('done'); label.textContent = 'Add Nikah to Calendar (Google & Apple)'; }, 3500);
  });

  // RSVP: guest stepper
  let guests = 2;
  const countEl = $('guestCount');
  const minus = $('stepMinus');
  const plus = $('stepPlus');
  function setGuests(n) {
    guests = Math.max(1, Math.min(8, n));
    countEl.textContent = guests;
    countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    minus.disabled = guests <= 1; plus.disabled = guests >= 8;
  }
  minus.addEventListener('click', () => setGuests(guests - 1));
  plus.addEventListener('click', () => setGuests(guests + 1));

  // RSVP: validate, then swap form → success with an animated height change
  const form = $('rsvpForm');
  const success = $('rsvpSuccess');
  const swap = $('rsvpSwap');
  function animateSwap(hideEl, showEl, after) {
    const from = swap.offsetHeight;
    swap.style.height = from + 'px';
    hideEl.hidden = true; showEl.hidden = false;
    const to = showEl.offsetHeight;
    requestAnimationFrame(() => {
      swap.style.height = to + 'px';
      setTimeout(() => { swap.style.height = ''; if (after) after(); }, reduceMotion ? 0 : 620);
    });
  }
  function validField(input, ok) {
    input.closest('.field').classList.toggle('invalid', !ok);
    return ok;
  }
  form.addEventListener('input', (e) => {
    const f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) f.classList.remove('invalid');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const okName = validField(form.name, name.length > 1);
    const okPhone = validField(form.phone, phone.replace(/\D/g, '').length >= 10);
    if (!okName || !okPhone) return;
    const events = [...form.querySelectorAll('input[name="events"]:checked')].map((i) => i.value);
    const diet = form.querySelector('input[name="diet"]:checked').value;
    const note = form.note.value.trim();
    const msg = [
      'Assalam-o-Alaikum! RSVP for Waheed & Jaweria’s Nikah',
      '',
      'Name: ' + name,
      'WhatsApp: ' + phone,
      'Guests: ' + guests,
      'Attending: ' + (events.length ? events.join(', ') : 'Unable to attend'),
      'Dietary: ' + diet,
      note ? 'Blessings: ' + note : ''
    ].filter(Boolean).join('\n');
    const num = String(CONFIG.rsvpWhatsApp || '').replace(/\D/g, '');
    $('sendWhatsApp').href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
    success.classList.remove('show');
    animateSwap(form, success);
    requestAnimationFrame(() => requestAnimationFrame(() => success.classList.add('show')));
    setTimeout(() => $('rsvp').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }), 120);
  });
  $('rsvpReset').addEventListener('click', () => {
    success.classList.remove('show');
    animateSwap(success, form);
  });

  // E-Salami: copy bank details
  const copyBtn = $('copyBtn');
  copyBtn.addEventListener('click', () => {
    const text = 'Bank: ' + $('bankName').textContent + '\nTitle: ' + $('bankTitle').textContent + '\nIBAN: ' + $('bankIban').textContent;
    const done = () => {
      copyBtn.classList.add('copied'); $('copyText').textContent = 'Copied to Clipboard!';
      setTimeout(() => { copyBtn.classList.remove('copied'); $('copyText').textContent = 'Copy Bank Details'; }, 2500);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  });
  function fallbackCopy(text, done) {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    t.remove();
  }

  // Concierge map: load the live Google map only when it scrolls near
  const map = $('map');
  if ('IntersectionObserver' in window) {
    const mo = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      mo.disconnect();
      const f = document.createElement('iframe');
      f.title = 'Map of the wedding venue';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = 'https://www.google.com/maps?q=' + encodeURIComponent(CONFIG.mapQuery) + '&z=13&output=embed';
      f.addEventListener('load', () => f.classList.add('loaded'));
      map.insertBefore(f, map.querySelector('.map-label'));
    }, { rootMargin: '300px 0px' });
    mo.observe(map);
  }

  /* Ayah recitation: “And We created you in pairs” (An-Naba 78:8).
     Plays once when the invitation scrolls into view, softly lowering the
     background music while it recites. Replay with the Listen button. */
  const ayahBtn = $('ayahBtn');
  let ayahPlayed = false;
  function duck(on) {
    const target = on ? 0.15 : 1;
    [intro, loop].forEach((v) => {
      const start = v.volume; const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 500);
        v.volume = start + (target - start) * k;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function playAyah() {
    try { ayah.currentTime = 0; } catch (e) { /* ignore */ }
    const p = ayah.play();
    if (p) p.catch(() => {});
  }
  ayah.addEventListener('play', () => { duck(true); ayahBtn.classList.add('playing'); });
  ayah.addEventListener('ended', () => { duck(false); ayahBtn.classList.remove('playing'); });
  ayah.addEventListener('pause', () => { if (!ayah.ended) { duck(false); ayahBtn.classList.remove('playing'); } });
  ayahBtn.addEventListener('click', () => { ayahPlayed = true; if (ayah.paused) playAyah(); else ayah.pause(); });
  if ('IntersectionObserver' in window) {
    const ao = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting || ayahPlayed || state === 'closed' || muted) return;
      ayahPlayed = true;
      ao.disconnect();
      setTimeout(playAyah, 600);
    }, { threshold: 0.35 });
    ao.observe($('welcome'));
  }
})();
