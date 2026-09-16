/* Hero intro: the self-mending ceramic bowl. Vanilla port of the Claude Design
   composition (Hero Mend.dc.html / hero-mend.jsx); geometry from shards-data.js.
   Plays full-bleed on every load, docks to the side, then the hero copy rises. */
(function () {
  var host = document.querySelector('.hero-mend');
  var hero = host && host.closest('.hero');
  var D = window.MEND_SHARDS;
  if (!host || !hero || !D) return;

  /* ── knobs ─────────────────────────────────────────────────────────── */
  var SEAM = 1, SPREAD = 1;            // design props seamGlow / spread
  var SCENES = [                       // [name, playback s, authored s] from the design editor
    ['Drift', 0.5, 3.2], ['Gather', 1.3, 2.6], ['Mend', 0.6, 5.6], ['Whole', 0.3, 3.4],
    ['Pour', 2.2, 3], ['Lockup', 1.1, 3], ['Rest', 1.7, 2.2]];
  var DOCK_MS = 1200;                  // slide from full-bleed to the side
  var REVEAL_DELAY_MS = 400;           // pause after docking settles before the copy rises
  var CROP = [240, 190, 1440, 720];    // viewBox framing the finished lockup

  /* ── timeline: wall-clock -> authored seconds, per-scene tempo ─────── */
  var CUES = {}, sections = [], play = 0, auth = 0;
  SCENES.forEach(function (s) {
    CUES[s[0]] = auth; sections.push({ play: play, dur: s[1], auth: auth, nat: s[2] });
    play += s[1]; auth += s[2];
  });
  var authoredTotal = auth;
  var END_T = authoredTotal - 1.2;     // hold just before the design's fade-to-black outro
  function warp(t) {
    var s = sections[sections.length - 1];
    for (var i = 0; i < sections.length; i++) if (t < sections[i].play + sections[i].dur) { s = sections[i]; break; }
    return s.auth + Math.min(Math.max(t - s.play, 0), s.dur) * (s.nat / s.dur);
  }

  var outCubic = function (t) { return (--t) * t * t + 1; };
  var inOutCubic = function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; };
  var outBack = function (t) { return 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2); };
  var tween = function (ease) {
    return function (from, to, start, end, T) {
      return T <= start ? from : T >= end ? to : from + (to - from) * ease((T - start) / (end - start));
    };
  };
  var enter = tween(outCubic), draw = tween(inOutCubic), pop = tween(outBack);
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var f2 = function (v) { return v.toFixed(2); };

  /* ── geometry (verbatim from the design) ───────────────────────────── */
  var SH = D.shards, BW = D.w, BH = D.h, BCX = BW * 0.5, BCY = BH * 0.52, HULL = D.hull || '';
  var rnd = function (i, k) { var h = Math.sin(i * 127.1 + k * 311.7 + 0.5) * 43758.5453; return h - Math.floor(h); };
  var VX0 = -342, VX1 = 1342, VY0 = -266, VY1 = 682, ZOOM = 1.14;
  var toBowl = function (px, py) { return [BCX + (px - 960) / ZOOM, BCY + (py - 548) / ZOOM]; };
  var clampTo = function (v, lo, hi) { return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)); };
  var bbox = function (d) {
    var n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (var i = 0; i + 1 < n.length; i += 2) {
      if (n[i] < x0) x0 = n[i]; if (n[i] > x1) x1 = n[i];
      if (n[i + 1] < y0) y0 = n[i + 1]; if (n[i + 1] > y1) y1 = n[i + 1];
    }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  };
  var SLOTS = [[560, 540], [1620, 250], [260, 230], [1670, 860], [330, 880],
               [1230, 890], [780, 900], [700, 150], [150, 560], [1180, 140], [1780, 560]];
  var SLOT_OF = [];
  SH.map(function (s, i) { return i; }).sort(function (a, b) { return SH[b].a - SH[a].a; })
    .forEach(function (si, k) { SLOT_OF[si] = SLOTS[k % SLOTS.length]; });
  var CFG = SH.map(function (s, i) {
    var b = bbox(s.d), sc0 = 0.5 + rnd(i, 5) * 0.22;
    var r = 0.5 * Math.hypot(b.w, b.h) * sc0 + Math.hypot(s.cx - b.cx, s.cy - b.cy) * sc0 * 2;
    var raw = SLOT_OF[i], slot = toBowl(960 + (raw[0] - 960) * 0.86, 548 + (raw[1] - 548) * 0.86);
    var px = clampTo(slot[0], VX0 + 20 + r, VX1 - 20 - r), py = clampTo(slot[1], VY0 + 20 + r, VY1 - 20 - r);
    var ang = Math.atan2(s.cy - BCY, s.cx - BCX);
    return { sc0: sc0, sx: px - b.cx, sy: py - b.cy,
      hx: Math.cos(ang) * (46 + rnd(i, 7) * 44), hy: Math.sin(ang) * (30 + rnd(i, 7) * 30),
      rot0: (rnd(i, 4) - 0.5) * 95, rotH: (rnd(i, 9) - 0.5) * 16, ph: rnd(i, 6) * 6.283, tone: 1 - rnd(i, 8) * 0.05 };
  });
  var SLOT = [];  // mend from the foot upward: lowest centroid locks first
  SH.map(function (s, i) { return i; }).sort(function (a, b) { return SH[b].cy - SH[a].cy; })
    .forEach(function (si, k) { SLOT[si] = k; });
  var N = Math.max(1, SH.length);
  var MOTES = Array.from({ length: 16 }, function (_, i) {
    return { x: rnd(i, 21) * 1920, y: rnd(i, 22) * 1080, r: 1.1 + rnd(i, 23) * 2.2, sp: 6 + rnd(i, 24) * 14,
      amp: 20 + rnd(i, 25) * 60, ph: rnd(i, 26) * 6.283, o: 0.08 + rnd(i, 27) * 0.16 };
  });

  /* ── build the SVG once; per-frame work only sets attributes ───────── */
  var paths = function (attrs) { return SH.map(function (s) { return '<path d="' + s.d + '" ' + attrs + '/>'; }).join(''); };
  host.innerHTML =
    '<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet">' +
    '<defs>' +
    '<radialGradient id="hm-halo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#d8a24a" stop-opacity=".2"/><stop offset="55%" stop-color="#c07a33" stop-opacity=".07"/><stop offset="100%" stop-color="#c07a33" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="hm-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8a6a45" stop-opacity="0"/><stop offset="42%" stop-color="#8a6a45" stop-opacity=".3"/><stop offset="58%" stop-color="#a98352" stop-opacity=".26"/><stop offset="100%" stop-color="#8a6a45" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="hm-stream" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#a9721a"/><stop offset="35%" stop-color="#f6c85f"/><stop offset="55%" stop-color="#ffeab4"/><stop offset="100%" stop-color="#a9721a"/></linearGradient>' +
    '<filter id="hm-seam" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="5.5"/></filter>' +
    '<mask id="hm-hull" maskUnits="userSpaceOnUse" x="-40" y="-40" width="' + (BW + 80) + '" height="' + (BH + 80) + '"><path d="' + HULL + '" fill="#fff"/></mask>' +
    '<clipPath id="hm-clip">' + paths('') + '</clipPath>' +
    '<clipPath id="hm-rise"><rect class="rise" x="-80" width="' + (BW + 160) + '"/></clipPath>' +
    '</defs>' +
    '<ellipse class="halo" cx="960" cy="548" fill="url(#hm-halo)"/>' +
    MOTES.map(function (m) { return '<circle class="mote" r="' + m.r + '" fill="#e6c48a" opacity="' + m.o + '"/>'; }).join('') +
    '<g class="bowl">' +
      '<g mask="url(#hm-hull)"><g filter="url(#hm-seam)">' + paths('class="seam" fill="none" stroke="#e8a83f" stroke-linejoin="round"') + '</g></g>' +
      '<g mask="url(#hm-hull)" clip-path="url(#hm-rise)">' +
        '<g filter="url(#hm-seam)">' + paths('fill="none" stroke="#e9a534" stroke-width="28" stroke-linejoin="round" opacity="' + 0.95 * SEAM + '"') + '</g>' +
        paths('fill="none" stroke="#ffd98a" stroke-width="12" stroke-linejoin="round" opacity="' + 0.85 * SEAM + '"') +
      '</g>' +
      '<g class="stream"><rect class="s-glow" width="26" fill="#e9a534" opacity=".5" filter="url(#hm-seam)"/><rect class="s-core" width="15" fill="url(#hm-stream)"/><ellipse class="s-head" rx="10" ry="13" fill="#ffeab4"/></g>' +
      '<ellipse class="impact" cx="500" cy="6" fill="#ffd98a" filter="url(#hm-seam)"/>' +
      SH.map(function (s, i) { var t = CFG[i].tone; return '<path class="shard" d="' + s.d + '" fill="rgb(' + Math.round(251 * t) + ',' + Math.round(247 * t) + ',' + Math.round(240 * t) + ')"/>'; }).join('') +
      '<g class="sweep" clip-path="url(#hm-clip)" style="mix-blend-mode:overlay"><rect class="sweep-r" y="-60" width="420" height="' + (BH + 120) + '" fill="url(#hm-sweep)"/></g>' +
    '</g>' +
    '<g class="name"><text x="960" y="742" text-anchor="middle" fill="#fbf7f0" style="font:400 168px \'Playfair Display\',Georgia,serif">Jessica Nussbaum</text></g>' +
    '<g class="sub"><text x="972" y="844" text-anchor="middle" fill="#fbf7f0" letter-spacing="25" style="font:300 46px Jost,\'Helvetica Neue\',sans-serif">GOLDEN THREADS COUNSELLING</text></g>' +
    '</svg>';

  var svg = host.firstChild;
  var $ = function (sel) { return svg.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(svg.querySelectorAll(sel)); };
  var el = { halo: $('.halo'), motes: $$('.mote'), bowl: $('.bowl'), seams: $$('.seam'), shards: $$('.shard'),
    rise: $('.rise'), stream: $('.stream'), sGlow: $('.s-glow'), sCore: $('.s-core'), sHead: $('.s-head'),
    impact: $('.impact'), sweep: $('.sweep'), sweepR: $('.sweep-r'), name: $('.name'), sub: $('.sub') };
  var set = function (e, k, v) { e.setAttribute(k, v); };

  var mendSpan = Math.max(1.2, (CUES.Whole - CUES.Mend) - 1.0), stag = mendSpan / N;
  function render(T) {
    SH.forEach(function (s, i) {
      var c = CFG[i], k = SLOT[i];
      var gS = CUES.Gather + k * 0.045, gE = CUES.Gather + 1.9;
      var lS = CUES.Mend + k * stag, lE = lS + 0.8;
      var driftX = Math.sin(T * 0.42 + c.ph) * 18, driftY = Math.cos(T * 0.31 + c.ph) * 14;
      var x = pop(draw(c.sx * SPREAD + driftX, c.hx, gS, gE, T), 0, lS, lE, T);
      var y = pop(draw(c.sy * SPREAD + driftY, c.hy, gS, gE, T), 0, lS, lE, T);
      var rot = pop(draw(c.rot0 + Math.sin(T * 0.36 + c.ph) * 5, c.rotH, gS, gE, T), 0, lS, lE, T);
      var scl = draw(c.sc0, 1, gS, gE, T);
      var op = enter(0, 1, 0.2 + k * 0.07, 1.3 + k * 0.07, T);
      var flare = T <= lE ? 0 : Math.exp(-(T - lE) / 0.4);
      var settled = enter(0, 0.1, lE, lE + 1.1, T);
      var pulse = 1 + Math.sin(T * 1.05 + c.ph) * 0.16;
      var gold = clamp((0.04 + settled * pulse + flare * 0.45) * SEAM, 0, 1.1);
      var tf = 'translate(' + f2(BCX + x) + ' ' + f2(BCY + y) + ') rotate(' + f2(rot) + ') scale(' + scl.toFixed(4) + ') translate(' + f2(-BCX) + ' ' + f2(-BCY) + ')';
      set(el.seams[i], 'transform', tf); set(el.seams[i], 'stroke-width', 15 + flare * 20); set(el.seams[i], 'opacity', gold * op);
      set(el.shards[i], 'transform', tf); set(el.shards[i], 'opacity', op);
    });

    var still = enter(1, 0, CUES.Mend, CUES.Whole, T);
    var breath = 1 + Math.sin((T - CUES.Whole) * 0.8) * 0.006 * still;
    var float = Math.sin(T * 0.5) * 9 * still;
    var tilt = Math.sin(T * 0.33 + 1.2) * 0.55 * still;
    var haloBreath = 1 + Math.sin(T * 0.62) * 0.05;
    set(el.halo, 'rx', 760 * haloBreath); set(el.halo, 'ry', 460 * haloBreath);
    set(el.halo, 'opacity', enter(0.35, 1, CUES.Mend, CUES.Whole + 0.6, T));
    MOTES.forEach(function (m, i) {
      set(el.motes[i], 'cx', m.x + Math.sin(T * 0.21 + m.ph) * m.amp);
      set(el.motes[i], 'cy', ((m.y - T * m.sp) % 1080 + 1080) % 1080);
    });

    // the pour: gold falls in from offscreen, then the cracks fill from the foot up
    var pS = CUES.Pour;
    var headY = draw(-640, 8, pS, pS + 0.8, T), tailY = draw(-640, 8, pS + 2.0, pS + 2.7, T);
    var streamX = 500 + Math.sin(T * 2.9) * 3;
    var streamOp = enter(0, 1, pS, pS + 0.12, T) * enter(1, 0, pS + 2.6, pS + 2.85, T);
    var impact = T > pS + 0.72 ? Math.exp(-(T - (pS + 0.78)) / 0.45) * streamOp : 0;
    var level = draw(BH + 80, -20, pS + 0.8, pS + 2.5, T);
    set(el.rise, 'y', level); set(el.rise, 'height', BH + 160 - level);
    set(el.stream, 'opacity', streamOp);
    set(el.sGlow, 'x', streamX - 13); set(el.sGlow, 'y', tailY); set(el.sGlow, 'height', Math.max(0, headY - tailY));
    set(el.sCore, 'x', streamX - 7.5); set(el.sCore, 'y', tailY); set(el.sCore, 'height', Math.max(0, headY - tailY));
    set(el.sHead, 'cx', streamX); set(el.sHead, 'cy', headY);
    set(el.impact, 'rx', 40 + impact * 90); set(el.impact, 'ry', 8 + impact * 20); set(el.impact, 'opacity', impact * 0.5);

    set(el.sweep, 'opacity', enter(0, 0.85, CUES.Whole + 0.1, CUES.Whole + 0.9, T));
    set(el.sweepR, 'x', draw(-760, 1900, CUES.Whole, authoredTotal - 0.2, T));

    // lockup: the wordmark rises from the bottom and lifts the bowl into the logo
    var kS = CUES.Lockup;
    var bowlScale = draw(1.14, 0.7, kS + 0.15, kS + 1.55, T), bowlY = draw(548, 388, kS + 0.15, kS + 1.55, T);
    set(el.bowl, 'transform', 'translate(960 ' + f2(bowlY + float) + ') rotate(' + tilt.toFixed(3) + ') scale(' + (bowlScale * breath).toFixed(4) + ') translate(' + (-BCX) + ' ' + (-BCY) + ')');
    set(el.name, 'opacity', enter(0, 1, kS + 0.3, kS + 1.15, T));
    set(el.name, 'transform', 'translate(0 ' + enter(320, 0, kS + 0.3, kS + 1.5, T).toFixed(1) + ')');
    set(el.sub, 'opacity', enter(0, 1, kS + 0.55, kS + 1.4, T));
    set(el.sub, 'transform', 'translate(0 ' + enter(300, 0, kS + 0.55, kS + 1.75, T).toFixed(1) + ')');
  }

  /* ── framing: emulate object-fit:cover during the intro, then tween to CROP */
  function coverBox() {
    var a = host.clientWidth / Math.max(1, host.clientHeight);
    return a >= 16 / 9 ? [0, (1080 - 1920 / a) / 2, 1920, 1920 / a] : [(1920 - 1080 * a) / 2, 0, 1080 * a, 1080];
  }
  function setBox(b) { set(svg, 'viewBox', b.map(f2).join(' ')); }
  function mix(a, b, u) { return a.map(function (v, i) { return v + (b[i] - v) * u; }); }

  var reveal = function () { hero.classList.add('is-revealed'); };
  var skip = false;
  try { skip = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (skip) {
    render(END_T); setBox(CROP);
    hero.classList.add('is-docked'); reveal();
    return;
  }
  host.style.transitionDuration = DOCK_MS + 'ms';
  var t0 = null, dockAt = null, from = null;
  function frame(now) {
    if (t0 == null) t0 = now;
    if (dockAt == null) {
      var T = Math.min(warp((now - t0) / 1000), END_T);
      render(T); setBox(coverBox());
      if (T < END_T) return requestAnimationFrame(frame);
      dockAt = now; from = coverBox();
      hero.classList.add('is-docked');
    }
    var u = Math.min(1, (now - dockAt) / DOCK_MS);
    setBox(mix(from, CROP, inOutCubic(u)));
    if (u < 1) return requestAnimationFrame(frame);
    setTimeout(reveal, REVEAL_DELAY_MS);
  }
  requestAnimationFrame(frame);
})();
