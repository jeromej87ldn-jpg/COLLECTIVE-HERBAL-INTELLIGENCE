// ── CHI SITE-WIDE FALLING LEAVES (portable, self-contained) ──────────
// Subtle background decoration: low-opacity leaf/herb emoji drifting down
// the page. Injects its own <style> so every page needs only one line —
// <script src="chi-leaves.js"></script> — nothing else to add or keep in
// sync. Fixing that in one shared file (instead of pasting the same CSS +
// JS into every page) means a future tweak only has to happen once, and
// there's nothing for a copy-paste to mismatch between pages.
//
// Bug this fixes vs. the first version (which was pasted directly into
// home.html): the leaf <div>s never had an explicit `top`, so a
// position:fixed element with no top/bottom set falls back to its
// "static position" — roughly where it would have landed in normal
// document flow. Appended as the last child of <body> on a long page,
// that static position can be thousands of pixels down, far below the
// visible viewport, so the leaves were falling — just entirely
// off-screen. Explicit `top:0` pins the starting point to the top of
// the viewport, where the animation actually expects it.
(function () {
  var style = document.createElement('style');
  style.textContent =
    '.chi-leaf-fall{position:fixed;top:0;left:0;pointer-events:none;font-size:20px;opacity:.1;animation:chi-leaf-fall-anim linear forwards;z-index:1;}' +
    '@keyframes chi-leaf-fall-anim{from{transform:translateY(-20px) rotateZ(0deg);opacity:.1;}to{transform:translateY(100vh) rotateZ(360deg);opacity:.05;}}';
  document.head.appendChild(style);

  var LEAVES = ['🍂', '🍃', '🌿', '🌱'];

  function spawnLeaf() {
    var leaf = document.createElement('div');
    leaf.className = 'chi-leaf-fall';
    leaf.textContent = LEAVES[Math.floor(Math.random() * LEAVES.length)];
    leaf.style.left = Math.random() * 100 + '%';
    leaf.style.animationDuration = (3 + Math.random() * 4) + 's';
    document.body.appendChild(leaf);
    setTimeout(function () { leaf.remove(); }, 7500);
  }

  function start() {
    setInterval(spawnLeaf, 400);
  }

  // Same pattern as chi-glossary.js: if this script loads after the
  // document has already parsed (e.g. included right before </body>),
  // DOMContentLoaded has already fired and won't fire again — so start
  // immediately in that case instead of waiting forever.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
