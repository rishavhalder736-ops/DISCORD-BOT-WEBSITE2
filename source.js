(() => {
  const $ = s => document.querySelector(s);
  const sortKey = p => { const i = p.lastIndexOf('/'); return p === 'README.md' ? '' : (i < 0 ? '/' : '/' + p.slice(0, i + 1)) + '\u0000' + p.slice(i + 1); };
  const files = (window.LEDGER_FILES || []).slice().sort((a, b) => sortKey(a.path) < sortKey(b.path) ? -1 : 1);
  const root = document.documentElement;
  let theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = theme;
  $('#themeToggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = theme; });

  let tt;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2000); };
  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); toast(`${label} copied`); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); toast(`${label} copied`); } catch { toast('Copy not available here'); }
      ta.remove();
    }
  };

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const hlPy = src => esc(src).replace(
    /(#[^\n]*)|((?:[rfb])?"""[\s\S]*?"""|(?:[rfb])?"(?:[^"\\\n]|\\.)*"|(?:[rfb])?'(?:[^'\\\n]|\\.)*')|(@[\w.]+)|\b(async|await|def|class|return|if|elif|else|for|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|while|lambda|self|yield|pass|break|continue|global)\b|\b(\d[\d_]*(?:\.\d+)?)\b/g,
    (m, c, s, d, k, n) => c ? `<span class="t-c">${c}</span>` : s ? `<span class="t-s">${s}</span>` : d ? `<span class="t-d">${d}</span>` : k ? `<span class="t-k">${k}</span>` : `<span class="t-n">${n}</span>`);
  const hlMd = src => esc(src).split('\n').map(l => /^#{1,6}\s/.test(l) ? `<span class="t-h">${l}</span>` : /^```/.test(l) ? `<span class="t-c">${l}</span>` : l.replace(/`([^`]+)`/g, '<span class="t-s">`$1`</span>')).join('\n');
  const hlConf = src => esc(src).replace(/(#[^\n]*)/g, '<span class="t-c">$1</span>').replace(/^([A-Z_]+)=/gm, '<span class="t-k">$1</span>=');
  const highlight = (path, code) => path.endsWith('.py') ? hlPy(code) : path.endsWith('.md') ? hlMd(code) : hlConf(code);

  const totalLines = files.reduce((a, f) => a + f.code.split('\n').length, 0);
  $('#metaFiles').textContent = `${files.length} files`;
  $('#metaLines').textContent = `${totalLines.toLocaleString()} lines`;

  // ---------- tree ----------
  const kb = n => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
  const icon = p => p.endsWith('.py') ? '<span class="ico py">py</span>' : p.endsWith('.md') ? '<span class="ico md">md</span>' : '<span class="ico">·</span>';
  const renderTree = (q = '') => {
    q = q.toLowerCase();
    const list = files.filter(f => f.path.toLowerCase().includes(q));
    let html = '', lastDir = null;
    list.forEach(f => {
      const parts = f.path.split('/');
      const dir = parts.slice(0, -1).join('/');
      if (dir !== lastDir) {
        if (dir) html += `<li><span class="t-dir" style="padding-left:${8 + (parts.length - 2) * 14}px"><span class="ico">▾</span>${dir.split('/').pop()}/</span></li>`;
        lastDir = dir;
      }
      html += `<li><button class="t-file" data-path="${f.path}" style="padding-left:${8 + (parts.length - 1) * 14}px" aria-current="${f.path === current}">${icon(f.path)}${parts.at(-1)}<span class="sz">${kb(new Blob([f.code]).size)}</span></button></li>`;
    });
    $('#tree').innerHTML = html || '<li class="muted small" style="padding:10px">No files match.</li>';
  };

  // ---------- viewer ----------
  let current = 'README.md';
  const open = (path, line) => {
    const f = files.find(x => x.path === path) || files[0];
    if (!f) return;
    current = f.path;
    const lines = highlight(f.path, f.code.replace(/\n$/, '')).split('\n');
    $('#code').innerHTML = lines.map((l, i) => `<span class="row${line === i + 1 ? ' hit' : ''}" id="L${i + 1}"><i>${i + 1}</i>${l || ' '}</span>`).join('');
    $('#filePath').textContent = 'ledger-bot/' + f.path;
    $('#fileInfo').textContent = `${lines.length} lines · ${kb(new Blob([f.code]).size)}`;
    document.querySelectorAll('.t-file').forEach(b => b.setAttribute('aria-current', b.dataset.path === f.path));
    $('#codeWrap').scrollTop = 0;
    if (line) document.getElementById('L' + line)?.scrollIntoView({ block: 'center' });
    history.replaceState(null, '', '#' + encodeURIComponent(f.path));
  };
  $('#tree').addEventListener('click', e => { const b = e.target.closest('.t-file'); if (b) open(b.dataset.path); });
  $('#filter').addEventListener('input', e => renderTree(e.target.value));
  $('#filter').addEventListener('keydown', e => { if (e.key === 'Enter') { const first = document.querySelector('.t-file'); if (first) open(first.dataset.path); } });
  document.addEventListener('keydown', e => { if (e.key === 't' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#filter').focus(); } });

  $('#copyFile').addEventListener('click', () => copy(files.find(f => f.path === current).code, current.split('/').pop()));
  $('#rawFile').addEventListener('click', () => {
    const f = files.find(x => x.path === current);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([f.code], { type: 'text/plain' }));
    a.download = f.path.split('/').pop();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  document.querySelectorAll('[data-copy-target]').forEach(b => b.addEventListener('click', () => copy(document.getElementById(b.dataset.copyTarget).textContent, 'Commands')));

  // ---------- command reference ----------
  const cmds = [
    ['hunt', 'Spend 5 coins to catch animals. Gems boost the catch.', 'h · catch · 15s cooldown'],
    ['zoo', 'Your collection, grouped by rarity tier.', 'z'],
    ['battle', 'Fight a wild team of three with your animals.', 'b · fight · 15s cooldown'],
    ['team set / auto', 'Pick up to 3 fighters, or auto-pick your strongest.', 'team'],
    ['sell <animal|tier|all>', 'Turn animals into coins. Team members are kept.', ''],
    ['sacrifice <animal|tier|all>', 'Turn animals into essence.', 'sac'],
    ['cash', 'Show your coins and essence.', 'bal · money · cowoncy'],
    ['daily', 'Daily coins with a growing streak bonus.', '24h'],
    ['give @user <amount>', 'Send coins. Accepts 5k, 2.5m, half, all.', 'send · pay'],
    ['pray / curse [@user]', 'Raise or lower luck, which changes rare-drop odds.', '5 min'],
    ['cookie @user', 'Give +1 reputation once a day.', 'rep'],
    ['coinflip <bet> [h|t]', 'Double or nothing.', 'cf'],
    ['slots <bet>', 'Three reels. Hit 7️⃣ 7️⃣ 7️⃣ for 25×.', 's · slot'],
    ['blackjack <bet>', 'Interactive Hit and Stand buttons. Blackjack pays 2.5×.', 'bj · 21'],
    ['shop / buy / use', 'Lootboxes, Lucky, Triple and XP gems, cookies and rings.', 'store · open'],
    ['profile · leaderboard', 'Level, stats, and server or global rankings.', 'me · top · lb'],
  ];
  $('#cmdGrid').innerHTML = cmds.map(([n, d, a]) => `<div class="cmd"><h3>l ${n}</h3><p>${d}</p>${a ? `<small>${a}</small>` : ''}</div>`).join('');

  const start = decodeURIComponent(location.hash.slice(1));
  current = files.some(f => f.path === start) ? start : 'README.md';
  renderTree();
  open(current);
})();
