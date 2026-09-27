// herbadex-edge-tabs.js
// Edge tabs for the three Herbadex tools.
// - On a tool page (Herbarium, Herb Match, Herb Planner): two tabs linking to
//   the other two tools.
// - On any other page: one "Tools" tab that opens a small panel with all three.
//   Tapping outside the panel (or pressing Escape) closes it.
// Also owns the shared position preferences used by the Herbexa widget
// (herbexa-widget-local.js). Load this file BEFORE herbexa-widget-local.js.
// Preferences are stored on this device only (localStorage).
(function () {
  if (window.__hdxEdgeTabsLoaded) return;
  window.__hdxEdgeTabsLoaded = true;

  // ── Shared position preferences ────────────────────────────────────────
  var PREF_KEY = 'herbadex_edge_prefs';
  var DEFAULTS = { toolsSide: 'left', toolsHeight: 'middle', herbexaSide: 'right', herbexaHeight: 'lower' };
  var SIDES = ['left', 'right'];
  var HEIGHTS = ['upper', 'middle', 'lower'];
  var HEIGHT_TOP = { upper: '26%', middle: '50%', lower: '72%' };

  function getPrefs() {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch (e) { p = {}; }
    var out = {};
    out.toolsSide = SIDES.indexOf(p.toolsSide) > -1 ? p.toolsSide : DEFAULTS.toolsSide;
    out.herbexaSide = SIDES.indexOf(p.herbexaSide) > -1 ? p.herbexaSide : DEFAULTS.herbexaSide;
    out.toolsHeight = HEIGHTS.indexOf(p.toolsHeight) > -1 ? p.toolsHeight : DEFAULTS.toolsHeight;
    out.herbexaHeight = HEIGHTS.indexOf(p.herbexaHeight) > -1 ? p.herbexaHeight : DEFAULTS.herbexaHeight;
    return out;
  }

  // If tools and Herbexa share a side and a height, Herbexa steps to the
  // nearest free height so the two never overlap.
  function herbexaTop(prefs) {
    var h = prefs.herbexaHeight;
    if (prefs.herbexaSide === prefs.toolsSide && h === prefs.toolsHeight) {
      h = h === 'lower' ? 'middle' : 'lower';
    }
    return HEIGHT_TOP[h];
  }

  function setPref(key, value) {
    var p = getPrefs();
    if (!(key in DEFAULTS)) return;
    p[key] = value;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {}
    try { window.dispatchEvent(new Event('herbadex-edge-prefs')); } catch (e) {}
  }

  window.HerbadexEdgePrefs = {
    get: getPrefs,
    set: setPref,
    heightTop: function (h) { return HEIGHT_TOP[h] || HEIGHT_TOP.middle; },
    herbexaTop: herbexaTop,
    DEFAULTS: DEFAULTS
  };

  // ── Tools ──────────────────────────────────────────────────────────────
  var TOOLS = [
    { page: 'supreme', href: 'supreme.html', label: 'Herbarium', icon: '📖' },
    { page: 'herb-match', href: 'herb-match.html', label: 'Herb Match', icon: '🌿' },
    { page: 'herb-planner', href: 'herb-planner.html', label: 'Herb Planner', icon: '🗓️' }
  ];

  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '').toLowerCase();
  var current = null;
  for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].page === page) current = TOOLS[i];

  var css = '' +
    '.hdx-edge{position:fixed;z-index:45;display:flex;flex-direction:column;gap:6px;transform:translateY(-50%);}' +
    '.hdx-edge.hdx-side-left{left:0;align-items:flex-start;}' +
    '.hdx-edge.hdx-side-right{right:0;align-items:flex-end;}' +
    '.hdx-tab{display:flex;align-items:center;gap:6px;writing-mode:vertical-rl;background:rgba(26,58,42,.94);color:#e8b84b;' +
      'border:1px solid rgba(200,149,42,.4);padding:.8rem .42rem;font-family:"DM Sans",-apple-system,sans-serif;font-size:11.5px;' +
      'font-weight:600;letter-spacing:.04em;text-decoration:none;cursor:pointer;opacity:.82;box-shadow:0 4px 14px rgba(0,0,0,.3);' +
      'transition:opacity .15s,padding .15s,background .15s;-webkit-tap-highlight-color:transparent;}' +
    '.hdx-side-left .hdx-tab{border-left:none;border-radius:0 8px 8px 0;}' +
    '.hdx-side-right .hdx-tab{border-right:none;border-radius:8px 0 0 8px;transform:rotate(180deg);}' +
    '.hdx-tab:hover,.hdx-tab:focus-visible,.hdx-tab[aria-expanded="true"]{opacity:1;background:#1a3a2a;}' +
    '.hdx-side-left .hdx-tab:hover{padding-left:.6rem;}' +
    '.hdx-side-right .hdx-tab:hover{padding-right:.6rem;}' +
    '.hdx-tab:focus-visible{outline:2px solid #e8b84b;outline-offset:2px;}' +
    '.hdx-tab-icon{writing-mode:horizontal-tb;font-size:12px;line-height:1;}' +
    '.hdx-flyout{position:fixed;z-index:46;transform:translateY(-50%);background:#1a3a2a;border:1px solid rgba(200,149,42,.4);' +
      'border-radius:10px;padding:.4rem;min-width:170px;box-shadow:0 8px 28px rgba(0,0,0,.45);display:none;}' +
    '.hdx-flyout.open{display:block;}' +
    '.hdx-flyout.hdx-side-left{left:40px;}' +
    '.hdx-flyout.hdx-side-right{right:40px;}' +
    '.hdx-flyout a{display:flex;align-items:center;gap:.6rem;padding:.65rem .75rem;border-radius:6px;color:rgba(245,240,232,.85);' +
      'text-decoration:none;font-family:"DM Sans",-apple-system,sans-serif;font-size:14px;}' +
    '.hdx-flyout a:hover,.hdx-flyout a:focus-visible{background:rgba(200,149,42,.14);color:#e8b84b;outline:none;}' +
    // A page element that already uses an edge (e.g. Herb Match's
    // "Back to Herb Match" tab) sets this attribute; our tabs on that side step aside.
    'body[data-hdx-left-busy] .hdx-edge.hdx-side-left,body[data-hdx-left-busy] .hdx-flyout.hdx-side-left,' +
    'body[data-hdx-left-busy] .herbexa-button.hdx-side-left{display:none!important;}' +
    // Slimmer on phones so tabs cover less of the page edge.
    '@media (max-width:760px){.hdx-tab{font-size:10.5px;padding:.6rem .26rem;gap:4px;}.hdx-tab-icon{font-size:10.5px;}' +
      '.hdx-flyout.hdx-side-left{left:30px;}.hdx-flyout.hdx-side-right{right:30px;}}' +
    '@media (prefers-reduced-motion: reduce){.hdx-tab{transition:none;}}';

  function injectStyles() {
    if (document.getElementById('hdx-edge-styles')) return;
    var s = document.createElement('style');
    s.id = 'hdx-edge-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  var wrap, flyout, toggleBtn;

  function applyPosition() {
    var p = getPrefs();
    var top = HEIGHT_TOP[p.toolsHeight];
    [wrap, flyout].forEach(function (el) {
      if (!el) return;
      el.classList.remove('hdx-side-left', 'hdx-side-right');
      el.classList.add('hdx-side-' + p.toolsSide);
      el.style.top = top;
    });
  }

  function closeFlyout() {
    if (!flyout) return;
    flyout.classList.remove('open');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function build() {
    if (document.getElementById('hdx-edge-tools')) return;
    injectStyles();

    wrap = document.createElement('div');
    wrap.className = 'hdx-edge';
    wrap.id = 'hdx-edge-tools';

    if (current) {
      // Tool page: link to the other two tools.
      wrap.setAttribute('aria-label', 'Other tools');
      TOOLS.forEach(function (t) {
        if (t === current) return;
        var a = document.createElement('a');
        a.className = 'hdx-tab';
        a.href = t.href;
        a.title = 'Go to ' + t.label;
        a.innerHTML = '<span class="hdx-tab-icon" aria-hidden="true">' + t.icon + '</span>' + t.label;
        wrap.appendChild(a);
      });
      document.body.appendChild(wrap);
    } else {
      // Any other page: one retractable Tools tab.
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'hdx-tab';
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.setAttribute('aria-controls', 'hdx-edge-flyout');
      toggleBtn.innerHTML = '<span class="hdx-tab-icon" aria-hidden="true">🧰</span>Tools';
      wrap.appendChild(toggleBtn);

      flyout = document.createElement('div');
      flyout.className = 'hdx-flyout';
      flyout.id = 'hdx-edge-flyout';
      TOOLS.forEach(function (t) {
        var a = document.createElement('a');
        a.href = t.href;
        a.innerHTML = '<span aria-hidden="true">' + t.icon + '</span>' + t.label;
        flyout.appendChild(a);
      });

      toggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = !flyout.classList.contains('open');
        flyout.classList.toggle('open', open);
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      flyout.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', closeFlyout);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeFlyout(); });

      document.body.appendChild(wrap);
      document.body.appendChild(flyout);
    }

    applyPosition();
    watchBackToMatchTab();
  }

  // Herb Match shows "← Back to Herb Match" on the left edge while a herb
  // is open. While it's visible, anything of ours on the left steps aside.
  function watchBackToMatchTab() {
    var back = document.getElementById('back-to-match-tab');
    if (!back || !window.MutationObserver) return;
    var sync = function () {
      if (back.classList.contains('show')) document.body.setAttribute('data-hdx-left-busy', '');
      else document.body.removeAttribute('data-hdx-left-busy');
    };
    new MutationObserver(sync).observe(back, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  window.addEventListener('herbadex-edge-prefs', applyPosition);
  // Keep tabs in sync if prefs change in another open tab of the site.
  window.addEventListener('storage', function (e) {
    if (e.key === PREF_KEY) { try { window.dispatchEvent(new Event('herbadex-edge-prefs')); } catch (x) {} }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
