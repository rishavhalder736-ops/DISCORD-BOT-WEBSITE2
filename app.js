(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- theme ---------- */
  const root = document.documentElement;
  const lite = root.classList.contains('lite');
  let theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = theme;
  $('#themeToggle').addEventListener('click', e => {
    const flip = () => { theme = theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = theme; };
    const r = e.currentTarget.getBoundingClientRect();
    root.style.setProperty('--vt-x', (r.left + r.width / 2) + 'px');
    root.style.setProperty('--vt-y', (r.top + r.height / 2) + 'px');
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return flip();
    root.classList.add('vt-theme');
    document.startViewTransition(flip).finished.finally(() => root.classList.remove('vt-theme'));
  });

  /* ---------- cursor + magnetic ---------- */
  const cursor = $('.cursor');
  if (fine) {
    let cx = -100, cy = -100, tx = -100, ty = -100;
    let running = false;
    const loop = () => {
      cx += (tx - cx) * 0.25; cy += (ty - cy) * 0.25;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.3) requestAnimationFrame(loop); else running = false;
    };
    window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; if (!running) { running = true; requestAnimationFrame(loop); } }, { passive: true });
    document.addEventListener('pointerover', e => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, summary, input, .card'));
    });
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- lazy QR library (only loaded when someone pays) ---------- */
  let qrP = null;
  const loadQR = () => qrP || (qrP = window.qrcode ? Promise.resolve() : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
    s.onload = res; s.onerror = () => { qrP = null; rej(); }; document.head.append(s);
  }));

  /* ---------- hero field canvas ---------- */
  const cv = $('#field'), ctx = cv.getContext('2d');
  let pts = [], W = 0, H = 0, mouse = { x: -9999, y: -9999 }, dpr = Math.min(devicePixelRatio || 1, 2);
  const buildField = () => {
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pts = [];
    const gap = W < 700 ? 34 : 42;
    for (let y = gap / 2; y < H; y += gap) for (let x = gap / 2; x < W; x += gap) pts.push({ ox: x, oy: y, x, y, vx: 0, vy: 0 });
  };
  if (!lite) {
    buildField();
    // rebuild only when the width really changes (mobile URL bars fire resize on every scroll)
    let lastW = cv.clientWidth, rT = 0;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => { if (Math.abs(cv.clientWidth - lastW) > 1 || Math.abs(cv.clientHeight - H) > 120) { lastW = cv.clientWidth; buildField(); } }, 150);
    }, { passive: true });
  }
  $('.hero').addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }, { passive: true });
  $('.hero').addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
  let t = 0, heroVisible = true, accent = '', accentTheme = '', frame = 0;
  let drawing = false;
  const kick = () => { if (!lite && !drawing && heroVisible && !document.hidden) { drawing = true; requestAnimationFrame(draw); } };
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; kick(); }).observe($('.hero'));
  document.addEventListener('visibilitychange', kick);
  const draw = () => {
    // the loop parks itself while the hero is off-screen or the tab is hidden (zero idle CPU)
    if (!heroVisible || document.hidden) { drawing = false; return; }
    requestAnimationFrame(draw);
    t += 0.012;
    if (!accent || accentTheme !== theme + root.className.includes('shift')) { accent = getComputedStyle(root).getPropertyValue('--accent').trim(); accentTheme = theme + root.className.includes('shift'); }
    const dotC = theme === 'dark' ? 'rgba(232,240,214,' : 'rgba(20,24,12,';
    ctx.clearRect(0, 0, W, H);
    const R = 150;
    const near = [];
    for (const p of pts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < R && !reduce) { const f = (1 - d / R) * 2.2; p.vx += (dx / (d || 1)) * f; p.vy += (dy / (d || 1)) * f; }
      p.vx += (p.ox - p.x) * 0.06; p.vy += (p.oy - p.y) * 0.06;
      p.vx *= 0.78; p.vy *= 0.78; p.x += p.vx; p.y += p.vy;
      const wave = reduce ? 0 : Math.sin(p.ox * 0.012 + t) * Math.cos(p.oy * 0.014 + t * 0.8);
      const a = 0.12 + Math.max(0, wave) * 0.22;
      if (d < R) near.push(p);
      ctx.fillStyle = d < R ? accent : dotC + a + ')';
      const s = d < R ? 2.4 : 1.4;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.strokeStyle = accent; ctx.lineWidth = 0.6;
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const a = near[i], b = near[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 60) { ctx.globalAlpha = (1 - d / 60) * 0.6; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  };
  if (!lite) kick(); else cv.remove();

  /* ---------- typed terminal ---------- */
  const lines = ['npx fitter deploy sentinel --guild gamerverse', 'fitter add module economy --currency "coins"', 'fitter status  →  14 shards · 38ms · online', 'fitter build --custom "Nova" --dashboard'];
  const typed = $('#typed');
  let li = 0;
  const typeLine = async () => {
    const s = lines[li++ % lines.length];
    while (document.hidden) await new Promise(r => setTimeout(r, 500));
    for (let i = 0; i <= s.length; i++) { typed.textContent = s.slice(0, i); await new Promise(r => setTimeout(r, 28 + Math.random() * 40)); }
    await new Promise(r => setTimeout(r, 1800));
    for (let i = s.length; i >= 0; i -= 3) { typed.textContent = s.slice(0, i); await new Promise(r => setTimeout(r, 12)); }
    typeLine();
  };
  typeLine();

  /* ---------- GSAP ---------- */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // page progress
  const cssScroll = CSS.supports('animation-timeline: view()');
  if (!cssScroll) gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // hero intro
  // hero intro is orchestrated by premium.js after the build loader
  gsap.to('.hero-inner', { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- assembly scroll animation ---------- */
  const exploded = {
    '.p-antenna': { x: 40, y: -120, rotation: 25 },
    '.p-ear-l': { x: -140, y: -40, rotation: -40 },
    '.p-ear-r': { x: 140, y: -60, rotation: 40 },
    '.p-head': { x: -30, y: -70, rotation: -8 },
    '.p-neck': { x: 110, y: 10, rotation: 60 },
    '.p-arm-l': { x: -150, y: 40, rotation: -35 },
    '.p-arm-r': { x: 160, y: 30, rotation: 30 },
    '.p-body': { x: 20, y: 60, rotation: 6 },
    '.p-base': { x: -50, y: 110, rotation: -20 },
  };
  Object.entries(exploded).forEach(([s, v]) => gsap.set(s, { ...v, transformOrigin: '50% 50%' }));

  const codeLines = [
    '<span class="k">import</span> { Client } <span class="k">from</span> <span class="s">"discord.js"</span>',
    '<span class="k">import</span> { moderation, tickets } <span class="k">from</span> <span class="s">"@fitter/modules"</span>',
    '',
    '<span class="k">const</span> bot = <span class="k">new</span> Client({ intents })',
    'bot.use(moderation({ raidShield: <span class="k">true</span> }))',
    'bot.use(tickets({ channel: <span class="s">"#support"</span> }))',
    '',
    '<span class="k">await</span> bot.test(<span class="s">"staging-guild"</span>)  <span class="s">✓ 48 passed</span>',
    '<span class="k">await</span> bot.shard({ count: <span class="s">14</span> })',
    '<span class="k">await</span> bot.login(process.env.TOKEN)',
    '<span class="s">→ Sentinel#0001 is online</span>',
  ];
  const codeEl = $('#codeStream');
  const steps = $$('.step');
  const leds = $$('.led');
  const hudPct = $('#hudPct'), hudBar = $('#hudBar'), hudState = $('#hudState'), hudPing = $('#hudPing'), pill = $('#statusPill');
  const states = ['drafting blueprint', 'snapping modules', 'compiling · running tests', 'deployed · monitoring'];
  let lastStep = -1, lastCode = -1, lastPing = 0, lastPill = '';

  const updateHud = p => {
    hudPct.textContent = String(Math.round(p * 100)).padStart(3, '0') + '%';
    hudBar.style.transform = `scaleX(${p.toFixed(3)})`;
    const s = Math.min(3, Math.floor(p * 4.001));
    if (s !== lastStep) {
      lastStep = s;
      steps.forEach((el, i) => el.classList.toggle('is-active', i === s));
      hudState.textContent = states[s];
    }
    const n = Math.max(0, Math.min(codeLines.length, Math.round((p - 0.35) / 0.55 * codeLines.length)));
    if (n !== lastCode) { lastCode = n; codeEl.innerHTML = codeLines.slice(0, n).join('\n'); }
    leds.forEach((l, i) => l.classList.toggle('on', p > 0.8 + i * 0.05));
    const on = p > 0.93;
    pill.classList.toggle('on', on);
    const pillTxt = on ? ' online' : p > 0.5 ? ' building' : ' offline';
    if (pillTxt !== lastPill) { lastPill = pillTxt; pill.lastChild.textContent = pillTxt; }
    const now = performance.now();
    if (p <= 0.75) { if (hudPing.textContent !== '— ms') hudPing.textContent = '— ms'; }
    else if (now - lastPing > 260) { lastPing = now; hudPing.textContent = Math.round(30 + Math.random() * 14) + ' ms'; }
  };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 0px)', () => {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.assembly', start: 'top top', end: lite ? '+=1500' : '+=3200', pin: '.assembly-pin', scrub: 0.6,
        onUpdate: self => updateHud(self.progress),
      },
    });
    tl.to('.ln', { strokeDashoffset: 0, duration: 2.5, stagger: 0.08 }, 0)
      .to('.dims', { opacity: 0, duration: 1 }, 3)
      .to(Object.keys(exploded).join(','), { x: 0, y: 0, rotation: 0, duration: 2.6, ease: 'power2.inOut', stagger: 0.05 }, 2.6)
      .to('.scanline', { opacity: 1, duration: 0.2 }, 5.3)
      .fromTo('.scanline', { y: 20 }, { y: 470, duration: 2 }, 5.3)
      .to('.fill-body, .fill-visor', { fillOpacity: 1, duration: 1.6, stagger: 0.05 }, 5.6)
      .to('.scanline', { opacity: 0, duration: 0.3 }, 7.3)
      .to('.blueprint', { opacity: 0.35, duration: 1 }, 6.5)
      .to('.eye', { opacity: 1, duration: 0.3 }, 7.8)
      .fromTo('.eye', { scaleY: 0.1 }, { scaleY: 1, duration: 0.5, ease: 'back.out(3)' }, 7.8)
      .to('.fill-accent', { fillOpacity: 1, duration: 0.4 }, 8.1)
      .to('.shadow', { opacity: 1, duration: 0.8 }, 8.2)
      .to('#bot', { y: -14, duration: 1.2, ease: 'sine.inOut' }, 8.6)
      .to('.p-arm-r', { rotation: -28, transformOrigin: '50% 10%', duration: 0.6, ease: 'sine.inOut' }, 9)
      .to('.p-arm-r', { rotation: 0, duration: 0.6, ease: 'sine.inOut' }, 9.6)
      .to({}, { duration: 0.6 });
    return () => tl.kill();
  });
  updateHud(0);

  // idle blink once assembled
  setInterval(() => {
    if (pill.classList.contains('on') && !reduce && !document.hidden) gsap.fromTo('.eye', { scaleY: 1 }, { scaleY: 0.1, duration: 0.08, yoyo: true, repeat: 1 });
  }, 3200);

  // subtle 3D tilt of bot stage with mouse
  const stage = $('.assembly-stage');
  if (fine && !reduce) {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to('.eyes', { x: px * 14, y: py * 10, duration: 0.4 });
    });
    stage.addEventListener('pointerleave', () => gsap.to('.eyes', { x: 0, y: 0, duration: 0.6 }));
  }

  /* ---------- discord demo ---------- */
  const demoTl = gsap.timeline({
    scrollTrigger: { trigger: '.demo', start: 'top top', end: lite ? '+=1200' : '+=2200', pin: '.demo-pin', scrub: 0.6 },
  });
  gsap.set('.dc-feed .msg', lite ? { opacity: 0, y: 14 } : { height: 0, opacity: 0, y: 14, paddingTop: 0 });
  $$('.dc-feed .msg').forEach((m, i) => {
    if (!lite) demoTl.to(m, { height: 'auto', paddingTop: 14, duration: 0.5, ease: 'power2.out' }, i * 1.1);
    demoTl.to(m, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, i * 1.1 + 0.3);
    if (m.querySelector('.spam')) demoTl.to(m, { opacity: 0.35, duration: 0.5 }, i * 1.1 + 1.3);
  });
  demoTl.to('.xp span', { scaleX: 1, duration: 1.2, ease: 'power2.out' }, 6.2).to({}, { duration: 0.8 });

  /* ---------- counters ---------- */
  const fmtNF = new Intl.NumberFormat('en-IN'); const fmt = n => fmtNF.format(n);
  $$('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(Math.round(o.v)); } }); },
    });
  });

  /* ---------- store ---------- */
  const icons = {
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18"/><path d="M7 6h1v4"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    key: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    gamepad: '<path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/><path d="M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.4 1.8L9 15h6l1.6 1.8A3 3 0 0 0 22 15l-.7-6.4A4 4 0 0 0 17.3 5z"/>',
  };
  const products = [
    { id: 'sentinel', name: 'Sentinel', cat: 'safety', icon: 'shield', once: 4999, mo: 599, badge: 'Best seller', hot: true, feature: true,
      desc: 'Auto-moderation that actually understands context. Raid shield, phishing link scanner, spam heuristics, escalating punishments and a full audit log.',
      cmds: ['/automod', '/warn', '/timeout', '/raidshield', '/case', '/purge'] },
    { id: 'ticketr', name: 'Ticketr', cat: 'utility', icon: 'ticket', once: 3499, mo: 449, badge: 'Support',
      desc: 'Private-thread tickets with categories, staff claims, transcripts and satisfaction ratings.', cmds: ['/ticket open', '/claim', '/transcript'] },
    { id: 'ledger', name: 'Ledger', cat: 'community', icon: 'coins', once: 0, mo: 0, free: true, badge: 'Free · Economy',
      desc: 'OwO-style economy in Python: hunt 26 animals, battle, slots, blackjack, gems, lootboxes and leaderboards. Full source, free.', cmds: ['/hunt', '/zoo', '/battle', '/daily', '/slots', '/blackjack'] },
    { id: 'tempo', name: 'Tempo', cat: 'fun', icon: 'music', once: 2999, mo: 399, badge: 'Audio',
      desc: 'Lag-free music with queues, filters, 24/7 lofi rooms and DJ-role control.', cmds: ['/play', '/queue', '/skip', '/filter'] },
    { id: 'quest', name: 'Quest', cat: 'community', icon: 'trophy', once: 2499, mo: 349, badge: 'Leveling',
      desc: 'XP, rank cards, level-role unlocks and weekly leaderboards that reward real activity.', cmds: ['/rank', '/leaderboard', '/xp'] },
    { id: 'gatekeeper', name: 'Gatekeeper', cat: 'safety', icon: 'key', once: 1999, mo: 299, badge: 'Verification',
      desc: 'Captcha and button verification, alt-account detection and onboarding flows.', cmds: ['/verify', '/setup-gate'] },
    { id: 'herald', name: 'Herald', cat: 'utility', icon: 'megaphone', once: 1799, mo: 249, badge: 'Feeds',
      desc: 'YouTube, Twitch, X and RSS alerts, scheduled announcements and polished embeds.', cmds: ['/announce', '/feed add', '/schedule'] },
    { id: 'arcade', name: 'Arcade', cat: 'fun', icon: 'gamepad', once: 2799, mo: 349, badge: 'Mini-games',
      desc: 'Trivia, word chains, counting, blackjack and tournaments linked to Ledger coins.', cmds: ['/trivia', '/blackjack', '/count'] },
  ];
  const LIVE = ['sentinel', 'ledger'];
  const PROGRESS = { ticketr: 70, tempo: 55, quest: 80, gatekeeper: 40, herald: 35, arcade: 25 };
  const notified = new Set();
  products.sort((a, b) => (LIVE.includes(b.id) - LIVE.includes(a.id)));
  const state = { cur: 'INR', lic: 'once', filter: 'all', cart: [] };
  const RATE = 83;
  const nfIN = new Intl.NumberFormat('en-IN'), nfUS = new Intl.NumberFormat('en-US');
  const money = inr => state.cur === 'INR' ? '₹' + nfIN.format(Math.round(inr)) : '$' + nfUS.format(Math.round(inr / RATE));
  const svgIcon = k => `<svg class="card-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[k]}</svg>`;

  const grid = $('#productGrid');
  const renderProducts = () => {
    grid.innerHTML = products.map(p => {
      const inCart = state.cart.some(c => c.id === p.id);
      const price = state.lic === 'once' ? p.once : p.mo;
      const priceHtml = `<p class="price">${money(price)} <small>${state.lic === 'once' ? 'one-time' : '/ month'}</small></p>`;
      const live = LIVE.includes(p.id);
      const pct = PROGRESS[p.id] || 0;
      const btn = p.free
        ? `<button class="add free-btn" data-free="1" aria-label="Get ${p.name} source for $0">Get for $0</button>`
        : live
        ? `<button class="add${inCart ? ' added' : ''}" data-add="${p.id}" aria-label="${inCart ? 'Added' : 'Add'} ${p.name} to cart">${inCart ? 'Added ✓' : 'Add to cart'}</button>`
        : `<button class="add notify${notified.has(p.id) ? ' added' : ''}" data-notify="${p.id}" aria-label="Notify me when ${p.name} launches">${notified.has(p.id) ? 'We\'ll notify you ✓' : 'Notify me'}</button>`;
      const wip = live ? '' : `<div class="wip" aria-label="${p.name} is ${pct}% built"><div class="wip-row mono"><span><i></i>In progress</span><span>${pct}%</span></div><div class="wip-bar"><span style="transform:scaleX(${pct / 100})"></span></div></div>`;
      const badge = live ? `<span class="badge live mono"><i></i>Live · ${p.badge}</span>` : `<span class="badge mono">${p.badge}</span>`;
      const priceLive = p.free ? `<p class="price">$0 <small>free source · MIT</small></p>` : live ? priceHtml : `<p class="price soon">${money(price)} <small>at launch</small></p>`;
      const hidden = state.filter !== 'all' && p.cat !== state.filter ? ' hide' : '';
      if (p.feature && state.filter === 'all') {
        return `<article class="card feature${hidden}" data-cat="${p.cat}">
          <div class="feature-inner">
            <div>
              <div class="card-top">${svgIcon(p.icon)}${badge}</div>
              <h3>${p.name}</h3><p class="desc">${p.desc}</p>
              <div class="cmds">${p.cmds.map(c => `<span>${c}</span>`).join('')}</div>
            </div>
            <div class="mini-log" aria-hidden="true">
              <b>21:42:07</b> scan msg#8812 … <i>phishing</i><br>
              <b>21:42:07</b> timeout fr33_n1tro 28d<br>
              <b>21:42:08</b> join spike 14/60s → shield<br>
              <b>21:42:08</b> lock #general slowmode 30s<br>
              <b>21:43:30</b> spike cleared · unlock<br>
              <b>21:44:02</b> case #219 logged → #mod-log
            </div>
          </div>
          <div class="card-foot">${priceLive}${btn}</div>
        </article>`;
      }
      return `<article class="card${hidden}${live ? ' is-live' : ' is-wip'}" data-cat="${p.cat}">
        <div class="card-top">${svgIcon(p.icon)}${badge}</div>
        <h3>${p.name}</h3><p class="desc">${p.desc}</p>
        <div class="cmds">${p.cmds.map(c => `<span>${c}</span>`).join('')}</div>
        ${wip}
        <div class="card-foot">${priceLive}${btn}</div>
      </article>`;
    }).join('');
    bindCards();
  };
  const bindCards = () => {
    $$('.card', grid).forEach(card => {
      // one layout read + style write per frame, however fast the pointer moves
      let raf = 0, ex = 0, ey = 0;
      card.addEventListener('pointermove', e => {
        ex = e.clientX; ey = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = card.getBoundingClientRect();
          const x = ex - r.left, y = ey - r.top;
          card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px');
          if (fine && !reduce) card.style.transform = `perspective(900px) rotateX(${(0.5 - y / r.height) * 5}deg) rotateY(${(x / r.width - 0.5) * 6}deg)`;
        });
      }, { passive: true });
      card.addEventListener('pointerleave', () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } card.style.transform = ''; });
    });
  };
  grid.addEventListener('click', e => {
    if (e.target.closest('[data-free]')) { $('#freeAdd').click(); return; }
    const n = e.target.closest('[data-notify]');
    if (n) {
      const p = products.find(x => x.id === n.dataset.notify);
      notified.add(p.id); toast(`We'll message you when ${p.name} launches`); renderProducts(); return;
    }
    const b = e.target.closest('[data-add]'); if (!b) return;
    const p = products.find(x => x.id === b.dataset.add);
    if (state.cart.some(c => c.id === p.id)) { openCart(); return; }
    state.cart.push({ id: p.id, name: p.name, icon: p.name[0], price: state.lic === 'once' ? p.once : p.mo, lic: state.lic });
    toast(`${p.name} added to cart`);
    updateCart(); renderProducts();
  });
  $$('.filters button').forEach(b => b.addEventListener('click', () => {
    const apply = () => {
      state.filter = b.dataset.filter;
      $$('.filters button').forEach(x => x.setAttribute('aria-selected', x === b));
      renderProducts();
      $$('.card', grid).forEach((c, i) => { c.style.viewTransitionName = 'card-' + (c.querySelector('[data-add],[data-notify],[data-free]')?.dataset.add || c.querySelector('h3').textContent.toLowerCase()); });
    };
    $$('.card', grid).forEach(c => { c.style.viewTransitionName = 'card-' + (c.querySelector('[data-add],[data-notify],[data-free]')?.dataset.add || c.querySelector('h3').textContent.toLowerCase()); });
    if (document.startViewTransition && !reduce) {
      document.startViewTransition(apply).finished.then(() => { $$('.card', grid).forEach(c => { c.style.viewTransitionName = ''; }); ScrollTrigger.refresh(); });
    } else { apply(); gsap.from('.card:not(.hide)', { opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }); ScrollTrigger.refresh(); }
  }));
  $$('[data-cur]').forEach(b => b.addEventListener('click', () => {
    state.cur = b.dataset.cur; $$('[data-cur]').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderProducts(); updateCart(); updateQuote();
  }));
  $$('[data-lic]').forEach(b => b.addEventListener('click', () => {
    state.lic = b.dataset.lic; $$('[data-lic]').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderProducts();
  }));
  renderProducts();
  if (!cssScroll) ScrollTrigger.batch('.card', { start: 'top 92%', once: true, onEnter: els => gsap.from(els, { opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power2.out' }) });

  /* ---------- builder ---------- */
  const modules = [
    { id: 'moderation', name: 'Moderation', price: 2000, cmds: ['warn', 'timeout', 'ban', 'purge', 'automod', 'case'], days: 2, on: true },
    { id: 'tickets', name: 'Tickets', price: 1500, cmds: ['ticket', 'claim', 'close', 'transcript'], days: 2 },
    { id: 'economy', name: 'Economy', price: 2500, cmds: ['balance', 'pay', 'shop', 'buy', 'daily', 'work'], days: 3, on: true },
    { id: 'music', name: 'Music', price: 1800, cmds: ['play', 'queue', 'skip', 'pause', 'filter'], days: 2 },
    { id: 'leveling', name: 'Leveling', price: 1200, cmds: ['rank', 'leaderboard', 'xp'], days: 1 },
    { id: 'verify', name: 'Verification', price: 900, cmds: ['verify', 'setup-gate'], days: 1 },
    { id: 'giveaways', name: 'Giveaways', price: 800, cmds: ['giveaway', 'reroll'], days: 1 },
    { id: 'ai', name: 'AI assistant', price: 3500, cmds: ['ask', 'summarize'], days: 3 },
    { id: 'feeds', name: 'Social feeds', price: 1000, cmds: ['feed', 'announce'], days: 1 },
    { id: 'customcmd', name: 'Custom commands', price: 1500, cmds: ['cmd create', 'cmd list'], days: 2 },
  ];
  const sizes = [['< 1k members', 1], ['1k – 10k members', 1.15], ['10k – 50k members', 1.35], ['50k – 200k members', 1.6], ['200k+ members', 2]];
  const BASE = 2999;
  const checkSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent-ink)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>';
  const LIVE_MODS = ['moderation', 'economy'];
  $('#moduleList').innerHTML = modules.map(m => {
    const live = LIVE_MODS.includes(m.id);
    return `<label class="mod${live ? '' : ' mod-wip'}"${live ? '' : ' title="In progress — coming soon"'}><input type="checkbox" value="${m.id}"${m.on ? ' checked' : ''}${live ? '' : ' disabled'}><span class="box">${checkSvg}</span>
      <span><b>${m.name}</b>${live ? `<small data-mprice="${m.price}">+${money(m.price)}</small>` : '<small class="wip-tag"><i></i>In progress</small>'}</span></label>`;
  }).join('');

  const nameIn = $('#botName'), membersIn = $('#members'), dashIn = $('#dashboard');
  let quote = { total: 0, days: 0, mods: [] };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const priceEl = $('#quotePrice');
  let shown = 0;
  const updateQuote = () => {
    const sel = $$('#moduleList input:checked').map(i => modules.find(m => m.id === i.value));
    const [sizeLabel, mult] = sizes[+membersIn.value];
    $('#membersOut').textContent = sizeLabel;
    const sub = BASE + sel.reduce((a, m) => a + m.price, 0) + (dashIn.checked ? 2500 : 0);
    const total = Math.round(sub * mult / 10) * 10;
    const days = 2 + sel.reduce((a, m) => a + m.days, 0) + (dashIn.checked ? 2 : 0);
    const name = (nameIn.value.trim() || 'Nova');
    const cmds = sel.flatMap(m => m.cmds);
    quote = { total, days, mods: sel.map(m => m.name), name };
    $('#pvName').textContent = name;
    $('#pvAvatar').textContent = name[0].toUpperCase();
    $('#pvCmds').textContent = `${cmds.length} slash commands · ${sel.length} modules`;
    $('#quoteDays').textContent = `${days} days`;
    $$('[data-mprice]').forEach(s => { s.textContent = '+' + money(+s.dataset.mprice); });
    const o = { v: shown };
    gsap.to(o, { v: total, duration: 0.6, ease: 'power3.out', onUpdate: () => { priceEl.textContent = money(o.v); }, onComplete: () => { shown = total; } });
    const J = (k, v) => `  <span class="k">"${k}"</span>: ${v}`;
    $('#configOut').innerHTML = [
      '{',
      J('name', `<span class="s">"${esc(name)}"</span>`) + ',',
      J('runtime', '<span class="s">"discord.js@14 / ts"</span>') + ',',
      J('shards', `<span class="n">${[1, 2, 4, 8, 16][+membersIn.value]}</span>`) + ',',
      J('dashboard', `<span class="n">${dashIn.checked}</span>`) + ',',
      J('modules', '[') ,
      ...sel.map((m, i) => `    <span class="s">"${m.id}"</span>${i < sel.length - 1 ? ',' : ''}`),
      '  ],',
      J('commands', `[${cmds.slice(0, 40).map(c => `<span class="s">"/${c}"</span>`).join(', ')}]`),
      '}',
    ].join('\n');
  };
  ['input', 'change'].forEach(ev => {
    $('#moduleList').addEventListener(ev, updateQuote);
    membersIn.addEventListener(ev, updateQuote);
    dashIn.addEventListener(ev, updateQuote);
    nameIn.addEventListener(ev, updateQuote);
  });
  updateQuote();
  $('#addCustom').addEventListener('click', () => {
    if (!quote.mods.length) { toast('Pick at least one module first'); return; }
    state.cart = state.cart.filter(c => c.id !== 'custom');
    state.cart.push({ id: 'custom', name: `${quote.name} (custom)`, icon: quote.name[0].toUpperCase(), price: quote.total, lic: 'custom', note: `${quote.mods.length} modules · ${quote.days} days` });
    updateCart(); toast(`${quote.name} custom build added`); openCart();
  });

  /* ---------- free source code ---------- */
  const FREE = { id: 'ledger-free', name: 'Ledger economy bot (source)', icon: 'L', price: 0, lic: 'free', note: 'Python · MIT · instant download' };
  $('#freeAdd').addEventListener('click', () => {
    if (!state.cart.some(c => c.id === FREE.id)) state.cart.push({ ...FREE });
    updateCart(); toast('Ledger source added — $0'); openCart();
  });
  // IDE code viewer with lightweight Python highlighting
  const snippets = window.FITTER_SNIPPETS || [];
  const hl = src => {
    const e = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return e.replace(/(#[^\n]*)|((?:f)?"(?:[^"\\\n]|\\.)*")|(@[\w.]+)|\b(async|await|def|class|return|if|elif|else|for|in|not|and|or|is|None|True|False|import|from|as|with|try|except|raise|while|lambda|self)\b|\b(\d+(?:\.\d+)?)\b/g,
      (m, c, s, d, k, n) => c ? `<span class="t-c">${c}</span>` : s ? `<span class="t-s">${s}</span>` : d ? `<span class="t-d">${d}</span>` : k ? `<span class="t-k">${k}</span>` : `<span class="t-n">${n}</span>`);
  };
  const tabs = $('#ideTabs'), codeOut = $('#ideCode');
  const showSnip = i => {
    $$('button', tabs).forEach((b, k) => b.setAttribute('aria-selected', k === i));
    const lines = hl(snippets[i].code).split('\n');
    codeOut.innerHTML = lines.map((l, k) => `<span class="ln-row" style="--d:${k}"><i>${k + 1}</i>${l || ' '}</span>`).join('');
    codeOut.parentElement.scrollTop = 0;
  };
  tabs.innerHTML = snippets.map((s, i) => `<button role="tab" aria-selected="${i === 0}" class="mono">${s.file.split('/').pop()}</button>`).join('');
  $$('button', tabs).forEach((b, i) => b.addEventListener('click', () => showSnip(i)));
  if (snippets.length) {
    const ideIO = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { ideIO.disconnect(); showSnip(0); } }, { rootMargin: '600px 0px' });
    ideIO.observe(codeOut);
  }

  /* ---------- cart ---------- */
  const drawer = $('#drawer'), scrim = $('#scrim');
  const openCart = () => { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('show')); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); $('#cartClose').focus(); };
  const closeCart = () => { scrim.classList.remove('show'); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); setTimeout(() => { scrim.hidden = true; }, 300); };
  $('#cartOpen').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeCart(); });
  const updateCart = () => {
    const btn = $('#cartOpen');
    $('#cartCount').textContent = state.cart.length;
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    const total = state.cart.reduce((a, c) => a + c.price, 0);
    $('#cartTotal').textContent = total === 0 && state.cart.length ? '$0 · Free' : money(total);
    $('#checkoutBtn').disabled = !state.cart.length;
    $('#checkoutBtn').style.opacity = state.cart.length ? 1 : 0.5;
    $('#cartItems').innerHTML = state.cart.length ? state.cart.map(c => `
      <div class="line-item"><span class="av av-bot">${esc(c.icon)}</span>
        <div class="li-info"><b>${esc(c.name)}</b><small>${c.note || (c.lic === 'once' ? 'one-time licence + source' : 'hosted · billed monthly')}</small></div>
        <span class="li-price">${c.price === 0 ? '$0' : money(c.price)}</span>
        <button data-remove="${c.id}" aria-label="Remove ${esc(c.name)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>`).join('') : `<div class="empty"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6 5 3H2"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/></svg><p>No bots yet. Add one from the store or spec a custom build.</p></div>`;
  };
  $('#cartItems').addEventListener('click', e => {
    const b = e.target.closest('[data-remove]'); if (!b) return;
    state.cart = state.cart.filter(c => c.id !== b.dataset.remove);
    updateCart(); renderProducts();
  });
  updateCart();

  /* ---------- checkout ---------- */
  const dlg = $('#checkout'), form = $('#coForm'), done = $('#coDone'), pay = $('#coPay');
  const UPI_ID = 'fitterbots@okaxis', UPI_NAME = 'Fitter Labs';
  let order = null;
  const showStep = s => { form.hidden = s !== 'form'; pay.hidden = s !== 'pay'; done.hidden = s !== 'done'; };
  document.addEventListener('click', async e => {
    const c = e.target.closest('[data-copy]'); if (!c) return;
    try { await navigator.clipboard.writeText(c.dataset.copy); toast('UPI ID copied: ' + c.dataset.copy); }
    catch { toast('UPI ID: ' + c.dataset.copy); }
  });
  $('#checkoutBtn').addEventListener('click', () => {
    if (!state.cart.length) return;
    closeCart(); showStep('form'); $('#coError').textContent = '';
    const free = state.cart.every(c => c.price === 0);
    $('#phoneOpt').hidden = !free;
    $('#coSubmit').textContent = free ? 'Get free download' : 'Continue to UPI';
    $('#coIntro').textContent = free ? 'Your order total is $0 — no payment needed. Tell us where to send updates and your download unlocks instantly.' : "Next you'll pay by UPI. We'll then invite you to your private build channel.";
    dlg.showModal();
  });
  $('#coCancel').addEventListener('click', () => dlg.close());
  $('#coClose').addEventListener('click', () => dlg.close());
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    if (!fd.get('name').trim()) { $('#coError').textContent = 'Please add your name.'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fd.get('email'))) { $('#coError').textContent = 'That email doesn\'t look right.'; return; }
    const amount = state.cart.reduce((a, c) => a + c.price, 0);
    if (amount > 0 && fd.get('phone').replace(/\D/g, '').length < 10) { $('#coError').textContent = 'Please add a 10-digit phone number.'; return; }
    const id = 'FT' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const hasFree = state.cart.some(c => c.id === FREE.id);
    order = { id, amount, hasFree };
    if (amount === 0) {
      $('#orderId').textContent = '#' + id;
      $('#coDownload').hidden = !hasFree; $('#coSource').hidden = !hasFree;
      $('#coDoneText').textContent = 'Your $0 order is confirmed. Download the full Python source below — setup steps are in README.md.';
      showStep('done');
      state.cart = []; updateCart(); renderProducts(); form.reset();
      return;
    }
    const uri = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Fitter order ' + id)}`;
    $('#payAmt').textContent = '₹' + nfIN.format(amount);
    $('#payOrder').textContent = '#' + id;
    $('#upiLink').href = uri;
    $('#qr').innerHTML = '<span class="mono small muted">Loading QR…</span>';
    loadQR().then(() => {
      const q = qrcode(0, 'M'); q.addData(uri); q.make();
      $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    }).catch(() => { $('#qr').textContent = 'Pay to ' + UPI_ID; });
    $('#utr').value = ''; $('#payError').textContent = '';
    showStep('pay');
  });
  $('#payBack').addEventListener('click', () => showStep('form'));
  $('#payDone').addEventListener('click', () => {
    const utr = $('#utr').value.replace(/\D/g, '');
    if (utr.length !== 12) { $('#payError').textContent = 'Enter the 12-digit UTR from your UPI app so we can match your payment.'; return; }
    const btn = $('#payDone'); btn.textContent = 'Submitting…'; btn.disabled = true;
    setTimeout(() => {
      btn.textContent = "I've paid"; btn.disabled = false;
      $('#orderId').textContent = '#' + order.id;
      $('#coDownload').hidden = !order.hasFree; $('#coSource').hidden = !order.hasFree;
      $('#coDoneText').textContent = "We're verifying your UPI payment (usually under 30 minutes). You'll get a call or WhatsApp on the number you shared once your bot's build channel is open." + (order.hasFree ? ' Your free Ledger source is ready below.' : '');
      showStep('done');
      state.cart = []; updateCart(); renderProducts(); form.reset();
    }, 900);
  });

  /* ---------- toast ---------- */
  let tt;
  const toast = msg => { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200); };

  /* ---------- section reveals ---------- */
  gsap.utils.toArray('.section-head h2, .builder-form h2, .faq h2, .cta-title, .huge').forEach(el => {
    gsap.from(el, { opacity: 0, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
