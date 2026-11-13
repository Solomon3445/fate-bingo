/* FATE Dinner Bingo, the phone page (v2: supper club + banknote engraving, animated).
 * Views (by ?view=): none = the game, board = big screen leaderboard, admin = export for Josh and Ramp,
 * qr = printable table card.
 * Backend: n8n workflow "[FATE] Dinner Bingo" (fate-bingo/build_workflow.py). The server re-scores every card,
 * so the score shown here is only a preview until the save comes back.
 * Animation: GSAP 3 + Flip from cdnjs. Every animation is optional: if GSAP fails to load, or the phone asks for
 * reduced motion, the page renders the same end state without movement.
 * COUPLED: the three URLs below = the webhook paths in build_workflow.py. Squares come from squares.json,
 * icons from img/icons/01.png to 16.png in the same order. */
(function () {
  'use strict';
  var N8N = 'https://n8n-production-0d1d.up.railway.app/webhook/';
  var SAVE_URL = N8N + 'fate-bingo-save';
  var BOARD_URL = N8N + 'fate-bingo-board';
  var EXPORT_URL = N8N + 'fate-bingo-export';
  var PLAY_URL = location.origin + location.pathname.replace(/index\.html$/, '');
  var STORE = 'fateBingo.v1';
  var MAX_PER_PERSON = 2, BONUS = 3;
  var LINES = [[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],[0,5,10,15],[3,6,9,12]];

  var $ = function (id) { return document.getElementById(id); };
  var view = new URLSearchParams(location.search).get('view') || '';
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = (!REDUCED && window.gsap) ? window.gsap : null;
  if (G && window.Flip) G.registerPlugin(window.Flip);
  var squares = [];

  /* ---------- storage: survives a reload; the page still works if the browser blocks it ---------- */
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch (e) { return null; } }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {} }
  function newId() {
    var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a);
    return 'p' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  var st = load();

  /* ---------- small helpers ---------- */
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function tidy(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function completed(ans) {
    var f = function (i) { return Boolean(ans[String(i)]); };
    return LINES.map(function (l, i) { return l.every(f) ? i : -1; }).filter(function (i) { return i > -1; });
  }
  function score(ans) {
    var n = 0; for (var i = 0; i < 16; i++) if (ans[String(i)]) n++;
    var b = completed(ans).length;
    return { squares: n, bingos: b, score: n + BONUS * b };
  }
  function ordinal(n) { var s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function getJSON(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }); }
  function iconUrl(i) { return 'url(img/icons/' + ('0' + (i + 1)).slice(-2) + '.png)'; }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function seeded(i, name) { var h = i * 31; for (var k = 0; k < name.length; k++) h = (h * 33 + name.charCodeAt(k)) % 997; return (h % 19) - 9; }
  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- engraved drawings, built in code so they stay crisp at any size ---------- */
  // A bingo ball: cream sphere, an inner disc, an ink number.
  function ball(num) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('class', 'ball');
    s.innerHTML = '<circle cx="50" cy="50" r="47" fill="url(#ball)" stroke="#B4B39B" stroke-width="1.5"/>' +
      '<circle cx="50" cy="50" r="27" fill="#FBFBF6" stroke="#38434D" stroke-opacity=".25"/>' +
      '<text x="50" y="51" text-anchor="middle" dominant-baseline="middle">' + num + '</text>';
    return s;
  }
  // The dauber stamp: an ink disc with a rough, speckled edge and a faint dotted inner ring.
  function stamp(name, rot) {
    var d = el('span', 'stamp'); d.style.setProperty('--rot', rot + 'deg');
    d.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><g filter="url(#ink-rough)"><circle cx="50" cy="50" r="45" fill="#2E383F"/></g>' +
      '<circle cx="50" cy="50" r="37" fill="none" stroke="#EAE9CB" stroke-opacity=".38" stroke-width="1.3" stroke-dasharray="2 2.6"/></svg>';
    d.appendChild(el('b', null, name));
    return d;
  }
  // A guilloche rosette, the interlaced rings printed on banknotes: many offset sine rings in thin khaki lines.
  function rosette(node) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '-100 -100 200 200');
    var out = '';
    function ring(base, amp, lobes, count, op) {
      for (var c = 0; c < count; c++) {
        var ph = c * (2 * Math.PI / lobes / count), d = '';
        for (var t = 0; t <= 360; t += 2) {
          var a = t * Math.PI / 180, r = base + amp * Math.sin(lobes * a + ph);
          d += (t ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
        }
        out += '<path d="' + d + 'Z" fill="none" stroke="#CFCEB6" stroke-opacity="' + op + '" stroke-width=".35"/>';
      }
    }
    ring(84, 5, 30, 26, .32); ring(66, 4, 24, 22, .3); ring(48, 3.2, 18, 18, .28); ring(32, 2.4, 12, 12, .25);
    s.innerHTML = out; node.textContent = ''; node.appendChild(s);
  }
  // Split text into letters for animation, but keep each word on one line (letters are wrapped per word).
  function splitChars(node) {
    var words = node.textContent.split(' '); node.textContent = '';
    words.forEach(function (w, wi) {
      var wd = el('span', 'wd');
      w.split('').forEach(function (c) { wd.appendChild(el('span', 'ch', c)); });
      node.appendChild(wd);
      if (wi < words.length - 1) node.appendChild(document.createTextNode(' '));
    });
    return node.querySelectorAll('.ch');
  }
  // Count a number up (or down) like an odometer.
  function countTo(node, to) {
    var from = Number(node.textContent) || 0;
    if (!G || from === to) { node.textContent = String(to); return; }
    var o = { v: from };
    G.to(o, { v: to, duration: .9, ease: 'power3.out', onUpdate: function () { node.textContent = String(Math.round(o.v)); } });
  }
  // Paper confetti in the brand colours, drawn on one canvas and removed when it lands.
  function confetti(ms) {
    if (REDUCED) return;
    var c = el('canvas', 'confetti'), x = c.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = innerWidth, H = innerHeight; c.width = W * dpr; c.height = H * dpr; x.scale(dpr, dpr); document.body.appendChild(c);
    var cols = ['#EAE9CB', '#CFCEB6', '#F6F5E8', '#B4B39B', '#718184'], P = [];
    for (var i = 0; i < 160; i++) P.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .42, vx: (Math.random() - .5) * 14,
      vy: -Math.random() * 15 - 5, w: 5 + Math.random() * 7, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
      c: cols[i % cols.length] });
    var t0 = performance.now();
    (function frame(t) {
      var k = (t - t0) / ms; x.clearRect(0, 0, W, H);
      P.forEach(function (p) { p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        x.save(); x.globalAlpha = Math.max(0, 1 - k * k); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
        x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); x.restore(); });
      if (k < 1) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }
  function qr(node, text) {
    node.textContent = '';
    if (!window.QRCode) { node.appendChild(el('p', 'url', text)); return; }
    new window.QRCode(node, { text: text, width: 512, height: 512, colorDark: '#242C33', colorLight: '#FFFFFF',
      correctLevel: window.QRCode.CorrectLevel.M });
  }

  /* ---------- leaderboard rows, shared by the phone and the big screen. Rows are keyed by name so Flip can
     animate each one to its new rank instead of redrawing the list. ---------- */
  function boardRows(list, players, opts) {
    var state = (G && window.Flip) ? window.Flip.getState(list.children) : null;
    var keep = {};
    Array.prototype.forEach.call(list.children, function (li) { keep[li.dataset.k] = li; });
    var seen = {};
    players.slice(0, opts.limit).forEach(function (p, i) {
      var k = norm(p.name), li = keep[k], fresh = !li;
      if (!li) {
        li = el('li'); li.dataset.k = k;
        li.innerHTML = '<span class="rk"></span><span class="nm"></span>' + (opts.big ? '<span class="bb"></span>' : '') + '<span class="pt"><span class="v">0</span><small></small></span>';
      }
      seen[k] = 1;
      li.className = (opts.me && k === norm(opts.me)) ? 'me' : '';
      li.querySelector('.rk').textContent = String(i + 1);
      var nm = li.querySelector('.nm'); nm.textContent = p.name;
      if (i === 0 && p.score > 0) nm.appendChild(el('span', 'laurel'));
      if (p.firm) nm.appendChild(el('span', 'fm', p.firm));
      if (opts.big) {
        var dots = el('span', 'dots'); for (var d = 0; d < 16; d++) dots.appendChild(el('i', d < p.squares ? 'on' : ''));
        nm.appendChild(dots);
        var bb = li.querySelector('.bb'); bb.textContent = '';
        for (var b = 0; b < Math.min(p.bingos, 4); b++) bb.appendChild(ball(b + 1));
      }
      var v = li.querySelector('.pt .v');
      if (fresh) v.textContent = String(p.score); else if (Number(v.textContent) !== p.score) countTo(v, p.score);
      li.querySelector('.pt small').textContent = p.squares + ' sq' + (p.bingos ? ', ' + p.bingos + ' bingo' + (p.bingos > 1 ? 's' : '') : '');
      list.appendChild(li);
      if (fresh && G && opts.animateNew) G.from(li, { opacity: 0, x: 40, duration: .7, ease: 'power3.out' });
    });
    Object.keys(keep).forEach(function (k) { if (!seen[k]) keep[k].remove(); });
    if (state) window.Flip.from(state, { duration: .8, ease: 'power3.inOut', absolute: false, simple: true });
  }

  /* =====================================================================
   * THE GAME
   * ===================================================================== */
  var selected = null, saveTimer = null, inflight = false, dirty = false, retryMs = 2000, board = { players: [], names: [] };

  function introJoin() {
    var balls = $('joinBalls'); balls.textContent = '';
    ['11', '18', '26'].forEach(function (n) { balls.appendChild(ball(n)); });
    if (!G) return;
    var chars = splitChars($('joinTitle'));
    var tl = G.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('#join .hero-img', { scale: 1.14, duration: 2.8 }, 0)
      .from('#join .eyebrow', { opacity: 0, y: 12, duration: .8 }, .35)
      .from(chars, { yPercent: 110, opacity: 0, duration: 1, stagger: .035 }, .45)
      .from('#joinBalls .ball', { x: 160, rotation: 400, opacity: 0, duration: 1.4, stagger: .12, ease: 'power4.out' }, .7)
      .from('#join .subtitle', { opacity: 0, y: 10, duration: .8 }, .9)
      .from('#join .rules li', { opacity: 0, y: 16, duration: .8, stagger: .08 }, 1)
      .from('#join .placecard', { opacity: 0, y: 24, duration: 1 }, 1.25);
  }
  function showJoin(prefill) {
    $('card').hidden = true; $('join').hidden = false;
    if (prefill) { $('fName').value = st.name || ''; $('fFirm').value = st.firm || ''; $('fEmail').value = st.email || ''; }
  }
  function showCard(animate) {
    $('join').hidden = true; $('card').hidden = false;
    $('meName').textContent = st.name + (st.firm ? ', ' + st.firm : '');
    rosette($('rosette'));
    renderGrid(); renderScore(false); drawLines(null); refreshBoard();
    if (G && animate) {
      var tl = G.timeline({ defaults: { ease: 'expo.out' } });
      tl.from('#card .band-img', { scale: 1.12, duration: 2.2 }, 0)
        .from('#card .who', { opacity: 0, y: 14, duration: .8 }, .15)
        .from('#card .scorebox', { opacity: 0, y: 14, duration: .8 }, .25)
        .from('#card .letters span', { opacity: 0, y: -16, duration: .6, stagger: .07 }, .35)
        .from('#grid .tile', { opacity: 0, y: 18, scale: .94, duration: .7, stagger: { each: .035, grid: [4, 4], from: 'start' } }, .45);
    }
  }

  $('joinForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = tidy($('fName').value), firm = tidy($('fFirm').value), email = tidy($('fEmail').value);
    var err = $('joinError');
    if (name.length < 2) { err.textContent = 'Please type your name so people can find you on the board.'; err.hidden = false; $('fName').focus(); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'That email does not look right. Fix it or leave it empty.'; err.hidden = false; $('fEmail').focus(); return; }
    err.hidden = true;
    st = st || { player_id: newId(), answers: {}, first_save: true };
    st.name = name; st.firm = firm; st.email = email;
    persist(); window.scrollTo(0, 0); showCard(true); queueSave(0);
  });
  $('editMe').addEventListener('click', function () { showJoin(true); window.scrollTo(0, 0); $('fName').focus(); });

  function renderGrid() {
    var g = $('grid'); g.textContent = '';
    squares.forEach(function (sq, i) {
      var v = st.answers[String(i)] || '';
      var b = el('button', 'tile' + (v ? ' filled' : '') + (selected === i ? ' selected' : ''));
      b.type = 'button'; b.dataset.i = i;
      b.setAttribute('aria-label', 'Square ' + (i + 1) + ': ' + sq.short + (v ? '. Stamped by ' + v : '. Empty'));
      b.appendChild(el('span', 'paper'));
      b.appendChild(el('span', 'n', String(i + 1)));
      var ic = el('span', 'ic'); ic.style.setProperty('--icon', iconUrl(i)); b.appendChild(ic);
      b.appendChild(el('span', 's', sq.short));
      if (v) b.appendChild(stamp(v, seeded(i, v)));
      b.addEventListener('click', function () { openSheet(i); });
      g.appendChild(b);
    });
  }
  function renderRack(n) {
    var r = $('rack'); r.textContent = '';
    for (var i = 0; i < Math.max(3, n); i++) {
      if (i < n) r.appendChild(ball(i + 1)); else r.appendChild(el('span', 'slot'));
    }
  }
  function renderScore(animate) {
    var s = score(st.answers);
    if (animate) countTo($('pts'), s.score); else $('pts').textContent = String(s.score);
    var line = s.squares + ' of 16 squares';
    var idx = board.players.findIndex(function (p) { return norm(p.name) === norm(st.name); });
    if (idx > -1 && board.players.length > 1) line += ', ' + ordinal(idx + 1) + ' of ' + board.players.length;
    $('scoreline').textContent = line;
    renderRack(s.bingos);
  }

  /* The bingo strokes: a rough ink line through the centres of every completed row, column or diagonal. */
  function drawLines(animateIdx) {
    var svg = $('lines'), wrap = svg.parentNode.getBoundingClientRect(), tiles = $('grid').children;
    svg.setAttribute('viewBox', '0 0 ' + wrap.width + ' ' + wrap.height); svg.textContent = '';
    completed(st.answers).forEach(function (li) {
      var L = LINES[li], a = tiles[L[0]].getBoundingClientRect(), z = tiles[L[3]].getBoundingClientRect();
      var ax = a.left + a.width / 2 - wrap.left, ay = a.top + a.height / 2 - wrap.top, zx = z.left + z.width / 2 - wrap.left, zy = z.top + z.height / 2 - wrap.top;
      var ex = (zx - ax) * .1, ey = (zy - ay) * .1;
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + (ax - ex) + ' ' + (ay - ey) + ' L' + (zx + ex) + ' ' + (zy + ey));
      svg.appendChild(p);
      if (G && animateIdx && animateIdx.indexOf(li) > -1) {
        var len = Math.hypot(zx - ax + 2 * ex, zy - ay + 2 * ey);
        G.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: .55, ease: 'power2.inOut', delay: .35 });
      }
    });
  }
  window.addEventListener('resize', function () { if (st && !$('card').hidden) drawLines(null); });

  /* ---------- the stamp sheet ---------- */
  function openSheet(i) {
    selected = i;
    $('edNum').textContent = 'Square ' + (i + 1);
    $('edPrompt').textContent = squares[i].prompt;
    $('edIcon').style.setProperty('--icon', iconUrl(i));
    $('edName').value = st.answers[String(i)] || '';
    $('edError').hidden = true;
    $('edClear').hidden = !st.answers[String(i)];
    renderChips();
    $('scrim').hidden = false; $('sheet').hidden = false;
    Array.prototype.forEach.call($('grid').children, function (t, k) { t.classList.toggle('selected', k === i); });
    if (G) { G.fromTo('#sheet', { yPercent: 100 }, { yPercent: 0, duration: .5, ease: 'expo.out' }); G.fromTo('#scrim', { opacity: 0 }, { opacity: 1, duration: .3 }); }
    setTimeout(function () { $('edName').focus({ preventScroll: true }); }, G ? 260 : 0);
  }
  function closeSheet(cb) {
    var done = function () { $('sheet').hidden = true; $('scrim').hidden = true; selected = null;
      Array.prototype.forEach.call($('grid').children, function (t) { t.classList.remove('selected'); }); if (cb) cb(); };
    $('edName').blur();
    if (G) { G.to('#scrim', { opacity: 0, duration: .25 }); G.to('#sheet', { yPercent: 100, duration: .35, ease: 'power3.in', onComplete: done }); }
    else done();
  }
  // Keep the sheet above the on screen keyboard.
  if (window.visualViewport) {
    var kb = function () { var v = window.visualViewport; document.documentElement.style.setProperty('--kb', Math.max(0, innerHeight - v.height - v.offsetTop) + 'px'); };
    visualViewport.addEventListener('resize', kb); visualViewport.addEventListener('scroll', kb);
  }
  function usesOf(name, except) {
    return Object.keys(st.answers).filter(function (k) { return Number(k) !== except && norm(st.answers[k]) === norm(name); });
  }
  // Names of people already playing, as tap targets. Typing filters them.
  function renderChips() {
    var box = $('chips'), q = norm($('edName').value); box.textContent = '';
    board.names.filter(function (n) { return norm(n) !== norm(st.name) && (!q || norm(n).indexOf(q) > -1); })
      .slice(0, 12).forEach(function (n) {
        var c = el('button', 'chip' + (norm(n) === q ? ' on' : ''), n); c.type = 'button';
        if (usesOf(n, selected).length >= MAX_PER_PERSON) { c.disabled = true; c.title = 'Already on 2 of your squares'; }
        c.addEventListener('click', function () { $('edName').value = n; renderChips(); });
        box.appendChild(c);
      });
  }
  $('edName').addEventListener('input', renderChips);
  $('edCancel').addEventListener('click', function () { closeSheet(); });
  $('scrim').addEventListener('click', function () { closeSheet(); });
  $('edClear').addEventListener('click', function () {
    var i = selected; delete st.answers[String(i)]; persist();
    closeSheet(function () { renderGrid(); drawLines(null); renderScore(true); queueSave(0); });
  });
  $('edForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = tidy($('edName').value), err = $('edError');
    var fail = function (m) { err.textContent = m; err.hidden = false; $('edName').focus(); if (G) G.fromTo('#sheet', { x: -6 }, { x: 0, duration: .4, ease: 'power3.out' }); };
    if (!v) return fail('Type the name of the person who fits this square, or tap their name.');
    if (norm(v) === norm(st.name)) return fail('Nice try. Find someone else for this one.');
    var used = usesOf(v, selected);
    if (used.length >= MAX_PER_PERSON) return fail(st.answers[used[0]] + ' already fills ' + MAX_PER_PERSON + ' of your squares. Go find someone new.');
    var i = selected, before = completed(st.answers);
    st.answers[String(i)] = v.slice(0, 60); persist();
    var after = completed(st.answers), fresh = after.filter(function (x) { return before.indexOf(x) < 0; });
    closeSheet(function () { stampIn(i, fresh); queueSave(0); });
  });

  /* The stamp moment: cream paper wipes in from the centre, the dauber lands, the card jolts, the phone buzzes. */
  function stampIn(i, freshLines) {
    renderGrid(); drawLines(freshLines);
    var t = $('grid').children[i];
    if (G) {
      var tl = G.timeline();
      tl.fromTo(t.querySelector('.paper'), { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: .5, ease: 'expo.out' }, 0)
        .from(t.querySelector('.stamp'), { scale: 2.1, opacity: 0, duration: .32, ease: 'expo.in' }, .02)
        .to(t, { y: 2, duration: .05, yoyo: true, repeat: 1, ease: 'power1.inOut' }, .34)
        .from(t.querySelector('.ic'), { opacity: .9, duration: .5 }, .2);
      setTimeout(function () { buzz(18); }, 340);
    } else buzz(18);
    renderScore(true);
    if (freshLines.length) setTimeout(function () { bingo(freshLines.length); }, G ? 950 : 0);
  }
  function bingo(n) {
    buzz([40, 50, 90]);
    var box = $('bingoBurst'), w = $('burstWord');
    w.textContent = n > 1 ? 'Double bingo' : 'Bingo';
    $('burstSub').textContent = '+' + (BONUS * n) + ' points. Keep going.';
    box.hidden = false; confetti(1900);
    if (!G) { setTimeout(function () { box.hidden = true; }, 1600); return; }
    var chars = splitChars(w);
    G.timeline({ onComplete: function () { box.hidden = true; } })
      .fromTo(box, { opacity: 0 }, { opacity: 1, duration: .2 })
      .from(chars, { scale: 3, opacity: 0, rotation: function () { return (Math.random() - .5) * 30; }, duration: .35, stagger: .07, ease: 'expo.in' }, .05)
      .from('#burstSub', { opacity: 0, y: 10, duration: .4 }, .55)
      .from('#rack .ball:last-of-type', { y: -140, rotation: -300, duration: .9, ease: 'power3.out' }, .5)
      .to(box, { opacity: 0, duration: .45 }, 1.9);
  }

  /* ---------- saving: always the WHOLE card, so a lost request is repaired by the next one ---------- */
  function setSync(text, cls) { var s = $('sync'); s.textContent = text; s.className = 'sync' + (cls ? ' ' + cls : ''); }
  function queueSave(ms) { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(save, ms == null ? 400 : ms); }
  function save() {
    if (inflight) return;
    inflight = true; dirty = false; setSync('Saving');
    var body = new URLSearchParams();
    body.set('payload', JSON.stringify({ player_id: st.player_id, name: st.name, firm: st.firm, email: st.email,
      answers: st.answers, first_save: Boolean(st.first_save) }));
    fetch(SAVE_URL, { method: 'POST', body: body })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        inflight = false;
        if (res.j && res.j.ok) {
          st.first_save = false; persist(); retryMs = 2000;
          setSync('Saved to the board', 'ok'); refreshBoard();
          if (dirty) queueSave(0);
        } else if (res.status === 400) {
          setSync((res.j && res.j.error) || 'Something on the card was not accepted.', 'warn');
        } else { throw new Error('bad status'); }
      })
      .catch(function () {
        inflight = false;
        setSync('Not saved yet. Your card is safe on this phone, retrying.', 'warn');
        clearTimeout(saveTimer); saveTimer = setTimeout(save, retryMs); retryMs = Math.min(retryMs * 2, 30000);
      });
  }
  window.addEventListener('online', function () { if (st) queueSave(0); });

  function refreshBoard() {
    return getJSON(BOARD_URL).then(function (b) {
      board = { players: b.players || [], names: b.names || [] };
      boardRows($('miniBoard'), board.players, { limit: 5, me: st && st.name });
      renderScore(false);
      if (!$('sheet').hidden) renderChips();
    }).catch(function () {});
  }

  function startGame() {
    if (st && st.name) showCard(true); else { st = null; showJoin(false); introJoin(); }
    setInterval(function () { if (!$('card').hidden && !document.hidden) refreshBoard(); }, 15000);
    if (st && st.first_save) queueSave(0);
  }

  /* =====================================================================
   * BIG SCREEN
   * ===================================================================== */
  function startBoard() {
    $('board').hidden = false;
    qr($('boardQr'), PLAY_URL);
    $('boardUrl').textContent = PLAY_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (G) {
      var chars = splitChars($('boardTitle'));
      G.timeline({ defaults: { ease: 'expo.out' } })
        .from('.board-art', { scale: 1.12, duration: 3 }, 0)
        .from(chars, { yPercent: 110, opacity: 0, duration: 1, stagger: .04 }, .3)
        .from('.board-scan', { opacity: 0, y: 30, duration: 1 }, .7)
        .from('.board-right', { opacity: 0, x: 40, duration: 1 }, .5);
    }
    var prev = null, last = 0, queue = [], bursting = false;
    function feed(html) {
      var f = $('feed'), p = el('p'); p.innerHTML = html; f.appendChild(p);
      while (f.children.length > 3) f.firstChild.remove();
      if (G) G.from(p, { opacity: 0, y: 16, duration: .6, ease: 'power3.out' });
    }
    function esc(s) { var d = el('span', null, s); return d.innerHTML; }
    function nextBurst() {
      if (bursting || !queue.length) return;
      bursting = true;
      var who = queue.shift(), box = $('boardBurst'), bb = $('burstBalls'); bb.textContent = '';
      ['F', 'A', 'T', 'E'].forEach(function (l) { bb.appendChild(ball(l)); });
      $('boardBurstName').textContent = who;
      box.hidden = false; confetti(2600);
      var end = function () { box.hidden = true; bursting = false; setTimeout(nextBurst, 400); };
      if (!G) { setTimeout(end, 3500); return; }
      G.timeline({ onComplete: end })
        .fromTo(box, { opacity: 0 }, { opacity: 1, duration: .3 })
        .from('#burstBalls .ball', { y: -300, rotation: -360, opacity: 0, duration: 1, stagger: .1, ease: 'power3.out' }, .05)
        .from('#boardBurst .burst-word', { scale: 2.6, opacity: 0, duration: .45, ease: 'expo.in' }, .35)
        .from('#boardBurstName', { opacity: 0, y: 20, duration: .6 }, .8)
        .to(box, { opacity: 0, duration: .6 }, 3.6);
    }
    function tick() {
      getJSON(BOARD_URL).then(function (b) {
        var ps = b.players || [];
        if (prev) {
          ps.forEach(function (p) {
            var o = prev[norm(p.name)];
            if (!o) feed('<b>' + esc(p.name) + '</b> just took a seat at the game.');
            else {
              if (p.bingos > o.bingos) { queue.push(p.name); feed('<b>' + esc(p.name) + '</b> got a bingo.'); }
              else if (p.squares > o.squares) feed('<b>' + esc(p.name) + '</b> stamped a square, ' + p.squares + ' of 16.');
            }
          });
          nextBurst();
        }
        prev = {}; ps.forEach(function (p) { prev[norm(p.name)] = p; });
        boardRows($('bigBoard'), ps, { limit: 10, big: true, animateNew: true });
        $('boardEmpty').hidden = ps.length > 0;
        last = Date.now(); stamp();
      }).catch(function () { stamp(true); });
    }
    function stamp(failed) {
      var t = $('stampText');
      if (!last) { t.textContent = failed ? 'Connecting' : ''; return; }
      var s = Math.round((Date.now() - last) / 1000);
      t.textContent = (failed ? 'Reconnecting, ' : '') + (s < 4 ? 'Live' : 'Updated ' + s + ' s ago');
    }
    tick(); setInterval(tick, 6000); setInterval(function () { stamp(); }, 1000);
  }

  /* =====================================================================
   * ADMIN EXPORT
   * ===================================================================== */
  function startAdmin() {
    $('admin').hidden = false;
    var csv = '';
    try { $('adminKey').value = sessionStorage.getItem('fateBingo.key') || ''; } catch (e) {}
    $('keyForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var key = $('adminKey').value.trim(); if (!key) return;
      $('adminMsg').textContent = 'Loading';
      getJSON(EXPORT_URL + '?key=' + encodeURIComponent(key)).then(function (d) {
        if (!d.ok) { $('adminMsg').textContent = d.error || 'Could not load.'; $('adminActions').hidden = true; return; }
        try { sessionStorage.setItem('fateBingo.key', key); } catch (e) {}
        csv = d.csv;
        $('adminMsg').textContent = d.count + ' cards. Most points first.';
        $('adminActions').hidden = d.count === 0;
        var t = $('adminTable'); t.textContent = '';
        var hr = el('tr'); d.columns.forEach(function (c) { hr.appendChild(el('th', null, c)); });
        var th = el('thead'); th.appendChild(hr); t.appendChild(th);
        var tb = el('tbody');
        d.rows.forEach(function (r) { var tr = el('tr'); d.columns.forEach(function (c) { tr.appendChild(el('td', null, r[c] == null ? '' : String(r[c]))); }); tb.appendChild(tr); });
        t.appendChild(tb);
      }).catch(function () { $('adminMsg').textContent = 'Could not reach n8n. Check the connection and try again.'; });
    });
    $('csvBtn').addEventListener('click', function () {
      var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'fate-dinner-bingo-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  /* =====================================================================
   * PRINTABLE TABLE CARD
   * ===================================================================== */
  function startPrint() {
    document.body.classList.add('print-mode');
    $('print').hidden = false;
    qr($('printQr'), PLAY_URL);
    $('printUrl').textContent = PLAY_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  /* ---------- boot ---------- */
  if (view === 'board') return startBoard();
  if (view === 'admin') return startAdmin();
  if (view === 'qr') return startPrint();
  fetch('squares.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
    .then(function (d) { squares = d.squares; startGame(); })
    .catch(function () { document.body.textContent = 'The card did not load. Check your connection and reload the page.'; });
})();
