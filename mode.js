/* Display mode switch — Full (default, every device) ⇄ Lite (recommended for mobile).
   Motion is wired at start-up (smooth scroll, canvas, split text, pinned scenes),
   so switching reloads the page with ?mode=… and keeps your scroll position. */
(() => {
  const html = document.documentElement;
  const lite = html.classList.contains('lite');
  const btn = document.getElementById('modeToggle');
  const chip = document.getElementById('modeChip');

  const go = mode => {
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    url.hash = '';
    const y = Math.round(window.scrollY);
    if (y > 0) url.searchParams.set('y', y); else url.searchParams.delete('y');
    try { window.name = (window.name || '').replace(/fitter-mode:(lite|full)/, '') + 'fitter-mode:' + mode; } catch (e) {}
    html.classList.add('mode-switching');
    setTimeout(() => location.replace(url.toString()), 180);
  };

  if (btn) {
    btn.setAttribute('aria-pressed', String(lite));
    const label = lite ? 'Switch to Full effects' : 'Switch to Lite mode (recommended for mobile)';
    btn.setAttribute('aria-label', label);
    btn.title = lite ? 'Lite mode is on — click for full effects' : 'Lite mode — recommended for mobile';
    btn.addEventListener('click', () => go(lite ? 'full' : 'lite'));
  }

  /* restore scroll position after a mode switch */
  const params = new URLSearchParams(location.search);
  const y = +params.get('y');
  if (y > 0) {
    const restore = () => {
      // let ScrollTrigger measure first (refresh parks the page at 0), then jump
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      if (window.ScrollTrigger) ScrollTrigger.update();
      params.delete('y');
      const clean = location.pathname + (params.toString() ? '?' + params : '') + location.hash;
      try { history.replaceState(null, '', clean); } catch (e) {}
    };
    if (document.readyState === 'complete') setTimeout(restore, 120);
    else window.addEventListener('load', () => setTimeout(restore, 120), { once: true });
  }

  /* recommend Lite on touch / small screens while Full is running */
  if (chip && !lite && html.classList.contains('touch') && html.classList.contains('mode-auto')) {
    const show = () => { chip.hidden = false; requestAnimationFrame(() => chip.classList.add('show')); };
    const hide = () => { chip.classList.remove('show'); setTimeout(() => { chip.hidden = true; }, 400); };
    setTimeout(show, 3200);
    setTimeout(hide, 16000);
    document.getElementById('modeChipGo').addEventListener('click', () => go('lite'));
    document.getElementById('modeChipX').addEventListener('click', hide);
  }
})();
