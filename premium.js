(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lite = html.classList.contains('lite');

  /* ---------- split text into words + chars ---------- */
  const split = el => {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = 'w';
            [...part].forEach(ch => { const c = document.createElement('span'); c.className = 'c'; c.textContent = ch; c.style.setProperty('--ci', i++); w.append(c); });
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el); el.classList.add('is-split');
    return $$('.c', el);
  };

  $$('.drawer-body, dialog, .config, #checkout, .ide-code').forEach(el => el.setAttribute('data-lenis-prevent', ''));
  const heroChars = lite ? [] : split($('.hero-title'));
  const loaderChars = lite ? [] : split($('.loader-word'));

  /* ---------- smooth scroll (Lenis) wired into GSAP ---------- */
  let lenis = null;
  if (window.Lenis && !reduce && !html.classList.contains('lite')) {
    lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1, smoothWheel: true });
    const marq = document.querySelector('.marquee');
    let lastVel = 0;
    lenis.on('scroll', e => {
      ScrollTrigger.update();
      const v = Math.round(Math.max(-12, Math.min(12, e.velocity * 0.4)));
      if (marq && v !== lastVel && !marq.classList.contains('perf-off')) { lastVel = v; marq.style.setProperty('--vel', v); }
    });
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  /* ---------- hero intro (runs after loader) ---------- */
  const heroIntro = () => {
    html.classList.add('is-ready');
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.nav', { yPercent: -140, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.2 }, 0)
      .fromTo(heroChars, { yPercent: 110, rotateX: -80, opacity: 0 },
        { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.2, stagger: 0.022, transformOrigin: '50% 100%', onComplete: () => gsap.set(heroChars, { clearProps: 'transform' }) }, 0.05)
      .fromTo('.eyebrow', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1 }, 0.3)
      .fromTo('.lede', { opacity: 0, y: 24, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2 }, 0.55)
      .fromTo('.hero-cta .btn', { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 1, stagger: 0.08 }, 0.65)
      .fromTo('.term', { opacity: 0, clipPath: 'inset(0 100% 0 0 round 10px)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0 round 10px)', duration: 1.2, ease: 'power3.inOut' }, 0.8)
      .fromTo('#field', { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' }, 0.2)
      .add(() => { gsap.set('.nav, .eyebrow, .lede, .hero-cta .btn, .term', { clearProps: 'transform,filter,clipPath' }); });
    ScrollTrigger.refresh();
  };

  /* ---------- boot loader ---------- */
  const loader = $('#loader');
  const finishLoader = () => {
    html.classList.remove('is-loading');
    loader.remove();
    lenis && lenis.start();
    heroIntro();
  };
  if (lite) {
    loader && loader.remove();
  } else if (reduce || !loader || html.classList.contains('skip-loader')) {
    loader && loader.remove();
    html.classList.add('is-ready');
    gsap.set('.nav, .eyebrow, .lede, .hero-cta, .term', { opacity: 1 });
  } else {
    html.classList.add('is-loading');
    lenis && lenis.stop();
    window.scrollTo(0, 0);
    const count = $('#loadCount');
    const prog = { v: 0 };
    const tl = gsap.timeline({ onComplete: finishLoader });
    tl.to('.loader-logo rect', { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to('.loader-logo path', { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out' }, 0.45)
      .from(loaderChars, { yPercent: 120, duration: 0.8, stagger: 0.05, ease: 'expo.out' }, 0.3)
      .to('.loader-log li', { opacity: 1, duration: 0.01, stagger: 0.28 }, 0.6)
      .to(prog, { v: 100, duration: 1.9, ease: 'power2.inOut', onUpdate: () => { count.textContent = String(Math.round(prog.v)).padStart(3, '0'); } }, 0.1)
      .to('.loader-bar span', { scaleX: 1, duration: 1.9, ease: 'power2.inOut' }, 0.1)
      .to('.loader-core, .loader-foot, .loader-bar, .loader-grid', { opacity: 0, y: -30, duration: 0.5, ease: 'power2.in' }, 2.1)
      .to('.loader-cols i', { yPercent: -100, duration: 0.9, stagger: 0.07, ease: 'expo.inOut' }, 2.35)
      .add(() => heroIntroEarly(), 2.55);
    let started = false;
    const heroIntroEarly = () => { if (!started) { started = true; heroIntro(); } };
    tl.timeScale(1.8);
    tl.eventCallback('onComplete', () => { html.classList.remove('is-loading'); loader.remove(); lenis && lenis.start(); heroIntroEarly(); });
    loader.style.pointerEvents = 'auto';
    loader.addEventListener('click', () => tl.progress(1));
  }

  /* ---------- section rail + colour shifts ---------- */
  const sections = $$('main > section[data-name]');
  const railIdx = $('#railIdx'), railName = $('#railName');
  let current = -1;
  const setSection = i => {
    if (i === current) return;
    const dir = i > current ? 1 : -1; current = i;
    const label = String(i + 1).padStart(2, '0');
    gsap.to(railIdx, { yPercent: -100 * dir, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => {
      railIdx.textContent = label; gsap.fromTo(railIdx, { yPercent: 100 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.4, ease: 'expo.out' });
    } });
    railName.textContent = sections[i].dataset.name;
  };
  sections.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: 'top 55%', end: 'bottom 55%', onToggle: self => self.isActive && setSection(i) }));
  gsap.to('.rail-line span', { scaleY: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  ScrollTrigger.create({
    trigger: '.cta', start: 'top 55%',
    onEnter: () => html.classList.add('shift-accent'),
    onLeaveBack: () => html.classList.remove('shift-accent'),
  });
  ScrollTrigger.create({
    trigger: '.demo', start: 'top 40%', end: 'bottom 60%',
    onToggle: self => html.classList.toggle('shift-deep', self.isActive),
  });

  /* ---------- curtain transition for in-page navigation ---------- */
  const curtain = $('#curtain'), cols = $$('#curtain i');
  let shifting = false;
  const shiftTo = (target, name) => {
    if (shifting) return; shifting = true;
    const idx = Math.max(0, sections.indexOf(target.closest('section')));
    $('#curtainIdx').textContent = String(idx + 1).padStart(2, '0');
    $('#curtainName').textContent = name || target.dataset.name || '';
    const tl = gsap.timeline({ onComplete: () => { shifting = false; } });
    tl.set(cols, { transformOrigin: '50% 100%' })
      .to(cols, { scaleY: 1, duration: 0.55, stagger: 0.045, ease: 'expo.inOut' })
      .fromTo('.curtain-label', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' }, 0.35)
      .add(() => {
        const y = target.getBoundingClientRect().top + window.scrollY - (target.id === 'top' ? 0 : 20);
        lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y);
        ScrollTrigger.update();
      }, 0.8)
      .to('.curtain-label', { opacity: 0, y: -30, duration: 0.3, ease: 'power2.in' }, 1.0)
      .set(cols, { transformOrigin: '50% 0%' }, 1.05)
      .to(cols, { scaleY: 0, duration: 0.6, stagger: 0.045, ease: 'expo.inOut' }, 1.05);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('skip')) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (reduce || lite) { target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
    shiftTo(target, target.dataset.name || a.textContent.trim());
  }, true);

  /* ---------- kicker text scramble on enter ---------- */
  const glyphs = '01<>/_#$%&*+=ABCDEFXYZ';
  const scramble = el => {
    const final = el.dataset.final || el.textContent; el.dataset.final = final;
    let f = 0; const total = 22;
    const tick = () => {
      el.textContent = [...final].map((ch, i) => (ch === ' ' || i < (f / total) * final.length) ? ch : glyphs[(Math.random() * glyphs.length) | 0]).join('');
      if (++f <= total) requestAnimationFrame(tick); else el.textContent = final;
    };
    tick();
  };
  if (!reduce) $$('.kicker').forEach(k => ScrollTrigger.create({ trigger: k, start: 'top 88%', once: true, onEnter: () => scramble(k) }));

  /* ---------- section headings: word-by-word rise ---------- */
  if (!reduce && !lite) {
    $$('.section-head h2, .builder-form h2, .faq h2, .demo-copy h2, .free-copy h2, .cta-title').forEach(h => {
      const chars = split(h);
      const words = $$('.w', h);
      gsap.from(words.map(w => w.children), {
        yPercent: 110, rotate: 4, duration: 1.1, ease: 'expo.out', stagger: 0.012,
        scrollTrigger: { trigger: h, start: 'top 85%', once: true },
      });
      void chars;
    });
  }

  /* ---------- cursor labels ---------- */
  const cursor = $('.cursor');
  if (fine && cursor) {
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], .card, .assembly-stage, .discord');
      const label = t ? (t.dataset.cursor || (t.classList.contains('card') ? 'view' : t.classList.contains('discord') ? 'live' : 'drag eyes')) : '';
      cursor.dataset.label = label;
      cursor.classList.toggle('has-label', !!label);
    });
  }

  /* ---------- ultra: spotlight, liquid buttons ---------- */
  if (fine) {
    const spot = $('.spotlight');
    let raf = 0, sx = 0, sy = 0;
    if (spot && !html.classList.contains('lite')) window.addEventListener('pointermove', e => {
      sx = e.clientX; sy = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => { spot.style.transform = `translate3d(${sx}px, ${sy}px, 0)`; html.classList.add('spot-on'); raf = 0; });
    }, { passive: true });
    document.addEventListener('pointerover', e => {
      const b = e.target.closest('.btn-ghost'); if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--bx', (e.clientX - r.left) + 'px'); b.style.setProperty('--by', (e.clientY - r.top) + 'px');
    });
  }

  /* ---------- performance: pause off-screen loops, flag active scrolling ---------- */
  const io = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('perf-off', !en.isIntersecting)), { rootMargin: '200px 0px' });
  document.querySelectorAll('main > section, main > div, .footer').forEach(el => io.observe(el));

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
