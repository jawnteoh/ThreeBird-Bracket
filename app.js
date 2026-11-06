(function () {
  var N = 10, KEY = "threebird-rr-v1";
  var DEFAULT_COLORS = ["#d61f26", "#121212", "#fcee21", "#1e6fd9", "#1f9d55", "#f28c28", "#7b3fc4", "#12b5cb", "#e83e8c", "#8a8f98"];
  var state = { names: [], scores: {}, ko: {}, colors: DEFAULT_COLORS.slice() };
  var canEdit = true;
  for (var i = 0; i < N; i++) state.names.push("");

  function adopt(s) {
    if (!s || typeof s !== "object") return;
    if (Array.isArray(s.names) && s.names.length === N) state.names = s.names.map(String);
    if (s.scores && typeof s.scores === "object") state.scores = s.scores;
    if (s.ko && typeof s.ko === "object") state.ko = s.ko;
    if (Array.isArray(s.colors) && s.colors.length === N) {
      var ok = s.colors.every(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
      var uniq = new Set(s.colors.map(function (c) { return String(c).toLowerCase(); })).size === N;
      if (ok && uniq) state.colors = s.colors.map(function (c) { return c.toLowerCase(); });
    }
  }
  function load() { try { var raw = localStorage.getItem(KEY); if (raw) adopt(JSON.parse(raw)); } catch (e) {} }
  function cache() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function save() { cache(); schedulePush(); }

  var reduce = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  function motionOK() { return !(reduce && reduce.matches); }
  function anim(node, frames, opts) {
    if (!node || !node.animate || (reduce && reduce.matches)) return;
    node.animate(frames, opts);
  }
  function toHSL(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, hh = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4;
      hh = (hh * 60 + 360) % 360;
    }
    return { h: hh, s: s, l: l, neutral: s < 0.18 || l < 0.12 || l > 0.92 };
  }
  function similarColor(a, b) {
    var x = toHSL(a), y = toHSL(b);
    if (x.neutral && y.neutral) return Math.abs(x.l - y.l) < 0.25;
    if (x.neutral || y.neutral) return false;
    var dh = Math.abs(x.h - y.h); dh = Math.min(dh, 360 - dh);
    return dh < 20;
  }
  function digitsOnly(inp) {
    inp.type = "text"; inp.inputMode = "numeric"; inp.pattern = "[0-9]*"; inp.maxLength = 2; inp.autocomplete = "off";
    inp.addEventListener("beforeinput", function (e) { if (e.data && /\D/.test(e.data)) e.preventDefault(); });
    inp.addEventListener("input", function () { var v = inp.value.replace(/\D/g, ""); if (v !== inp.value) inp.value = v; });
  }
  function fillLabel(node, i, after) {
    node.textContent = "";
    var sw = document.createElement("span");
    sw.className = "sw" + (after ? " after" : "");
    sw.style.background = state.colors[i];
    var t = document.createElement("span");
    t.textContent = nameOf(i);
    if (after) { node.appendChild(t); node.appendChild(sw); } else { node.appendChild(sw); node.appendChild(t); }
  }
  function nameOf(i) { var n = (state.names[i] || "").trim(); return n || "Team " + (i + 1); }

  /* circle method: 9 rounds x 5 matches, each pair exactly once */
  function buildFixtures() {
    var arr = []; for (var i = 0; i < N; i++) arr.push(i);
    var out = [];
    for (var r = 0; r < N - 1; r++) {
      var matches = [];
      for (var k = 0; k < N / 2; k++) {
        var a = arr[k], b = arr[N - 1 - k];
        if (k === 0 && r % 2 === 1) { var t = a; a = b; b = t; }
        matches.push({ id: r + "-" + k, round: r + 1, home: a, away: b });
      }
      out.push(matches);
      arr.splice(1, 0, arr.pop());
    }
    return out;
  }
  var rounds = buildFixtures();

  function parseScore(v) {
    if (v === undefined || v === null || v === "") return null;
    var n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? null : n;
  }
  function result(m) {
    var s = state.scores[m.id];
    if (!s) return null;
    var h = parseScore(s[0]), a = parseScore(s[1]);
    return h === null || a === null ? null : [h, a];
  }

  function computeTable() {
    var rows = [];
    for (var i = 0; i < N; i++) rows.push({ i: i, pl: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
    rounds.forEach(function (ms) {
      ms.forEach(function (m) {
        var r = result(m); if (!r) return;
        var H = rows[m.home], A = rows[m.away];
        H.pl++; A.pl++; H.gf += r[0]; H.ga += r[1]; A.gf += r[1]; A.ga += r[0];
        if (r[0] > r[1]) { H.w++; A.l++; H.pts += 3; H.form.push("W"); A.form.push("L"); }
        else if (r[0] < r[1]) { A.w++; H.l++; A.pts += 3; A.form.push("W"); H.form.push("L"); }
        else { H.d++; A.d++; H.pts++; A.pts++; H.form.push("D"); A.form.push("D"); }
      });
    });
    rows.forEach(function (r) { r.gd = r.gf - r.ga; });
    rows.sort(function (x, y) {
      return y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.i - y.i;
    });
    return rows;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function sign(n) { return n > 0 ? "+" + n : String(n); }

  var seen = null;
  function sameState(a, b) {
    for (var t in b) { if (!a[t] || a[t].pos !== b[t].pos || a[t].vals.join() !== b[t].vals.join()) return false; }
    return true;
  }
  function renderTable(replay) {
    var tb = document.getElementById("table");
    tb.textContent = "";
    var cur = {};
    computeTable().forEach(function (r, idx) {
      var tr = el("tr", (idx < 8 ? "qual" : "") + (idx === 8 ? " cut" : "") + (idx === 0 ? " lead" : ""));
      tr.dataset.t = r.i;
      cur[r.i] = { pos: idx, vals: [r.pl, r.w, r.d, r.l, r.gf, r.ga, r.gd, r.pts] };
      tr.appendChild(el("td", "pos", idx + 1));
      var tdn = el("td", "team"); fillLabel(tdn, r.i, false); tr.appendChild(tdn);
      [r.pl, r.w, r.d, r.l, r.gf, r.ga, sign(r.gd)].forEach(function (v) { tr.appendChild(el("td", "", v)); });
      tr.appendChild(el("td", "pts", r.pts));
      tb.appendChild(tr);
    });
    var pg = document.getElementById("page-table");
    if (!seen) seen = cur;
    else if (pg && !pg.hidden && !sameState(seen, cur)) { animateTable(tb, cur, seen); seen = cur; }
    if (koRefs.f) refreshKO();
  }

  function animateTable(tb, cur, from) {
    var trs = tb.children;
    if (trs.length < 2) return;
    var rowH = trs[1].offsetTop - trs[0].offsetTop;
    Array.prototype.forEach.call(trs, function (tr) {
      var t = tr.dataset.t, o = from[t], c = cur[t];
      if (!o) return;
      var moved = o.pos - c.pos, changed = false;
      c.vals.forEach(function (v, k) {
        if (v === o.vals[k]) return;
        changed = true;
        anim(tr.children[k + 2], [
          { transform: "scale(1)" },
          { transform: "scale(1.4)", color: "#D61F26", offset: .35 },
          { transform: "scale(1)" }
        ], { duration: 1000, easing: "ease-out" });
      });
      if (moved !== 0) {
        var up = moved > 0, d = moved * rowH, steps = Math.abs(moved);
        tr.style.position = "relative";
        tr.style.zIndex = up ? "3" : "2";
        anim(tr, up ? [
          { transform: "translateY(" + d + "px) scale(1)" },
          { transform: "translateY(" + (d * .45) + "px) scale(1.05)", offset: .4 },
          { transform: "translateY(-5px) scale(1.02)", offset: .8 },
          { transform: "translateY(0) scale(1)" }
        ] : [
          { transform: "translateY(" + d + "px) scale(1)" },
          { transform: "translateY(" + (d * .5) + "px) scale(.97)", offset: .4 },
          { transform: "translateY(3px) scale(.99)", offset: .8 },
          { transform: "translateY(0) scale(1)" }
        ], { duration: 1200, easing: "cubic-bezier(.3,.7,.3,1)" });
        var flash = up ? "#D61F26" : "#121212";
        if (c.vals[0] !== o.vals[0]) anim(tr, [
          { backgroundColor: flash, color: "#FEF6D5" },
          { backgroundColor: flash, color: "#FEF6D5", offset: .45 },
          { backgroundColor: "rgba(255,255,255,0)", color: "#121212" }
        ], { duration: 2200, easing: "ease-out" });
        if (motionOK() && c.vals[0] !== o.vals[0]) {
          var badge = el("span", "mv " + (up ? "up" : "down"), (up ? "\u25B2 " : "\u25BC ") + steps);
          tr.children[1].appendChild(badge);
          anim(badge, [
            { transform: "scale(0) rotate(-12deg)", opacity: 0 },
            { transform: "scale(1.35) rotate(3deg)", opacity: 1, offset: .55 },
            { transform: "scale(1) rotate(0)", opacity: 1 }
          ], { duration: 600, easing: "ease-out" });
          setTimeout(function () {
            anim(badge, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
            setTimeout(function () { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 520);
          }, 3000);
        }
        if (c.vals[0] !== o.vals[0]) anim(tr.children[0], [
          { transform: "scale(1)" },
          { transform: "scale(1.7)", color: flash, offset: .4 },
          { transform: "scale(1)" }
        ], { duration: 900, easing: "ease-out" });
      } else if (changed) {
        anim(tr, [{ backgroundColor: "rgba(214,31,38,.14)" }, { backgroundColor: "rgba(0,0,0,0)" }], { duration: 1600, easing: "ease-out" });
      }
    });
  }

  var fxRefs = [], teamRefs = [];
  var labels = []; /* [{h: el, a: el, i, j}] */
  function renderFixtures() {
    var host = document.getElementById("rounds");
    rounds.forEach(function (ms, ri) {
      var box = el("div", "round");
      box.appendChild(el("h3", "", "Round " + (ri + 1)));
      ms.forEach(function (m) {
        var row = el("div", "match");
        var h = el("div", "h"); fillLabel(h, m.home, true);
        var ih = el("input"); var ia = el("input");
        [ih, ia].forEach(digitsOnly);
        ih.id = "s-" + m.id + "-h"; ia.id = "s-" + m.id + "-a";
        ih.setAttribute("aria-label", "Round " + m.round + " home score");
        ia.setAttribute("aria-label", "Round " + m.round + " away score");
        var saved = state.scores[m.id];
        if (saved) { ih.value = saved[0]; ia.value = saved[1]; }
        var a = el("div", "a"); fillLabel(a, m.away, false);
        function onInput() {
          state.scores[m.id] = [ih.value, ia.value];
          var nowDone = !!result(m);
          row.classList.toggle("done", nowDone);
          if (nowDone) {
            anim(row, [{ backgroundColor: "rgba(214,31,38,.3)" }, { backgroundColor: "rgba(0,0,0,0)" }], { duration: 1400, easing: "ease-out" });
            [ih, ia].forEach(function (i) { anim(i, [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }], { duration: 400, easing: "ease-out" }); });
          }
          save(); renderTable();
        }
        ih.addEventListener("input", onInput); ia.addEventListener("input", onInput);
        row.classList.toggle("done", !!result(m));
        row.appendChild(h); row.appendChild(ih); row.appendChild(el("div", "dash", "-")); row.appendChild(ia); row.appendChild(a);
        box.appendChild(row);
        labels.push({ h: h, a: a, home: m.home, away: m.away });
        fxRefs.push({ m: m, ih: ih, ia: ia, row: row });
      });
      host.appendChild(box);
    });
  }
  function refreshLabels() {
    labels.forEach(function (l) { fillLabel(l.h, l.home, true); fillLabel(l.a, l.away, false); });
  }

  function renderTeams() {
    var host = document.getElementById("teams");
    for (var i = 0; i < N; i++) (function (i) {
      var row = el("div", "trow");
      row.appendChild(el("div", "tlab", "Team " + (i + 1)));
      var f = el("div", "fields");
      var col = el("input");
      col.type = "color"; col.id = "color-" + i; col.value = state.colors[i];
      col.setAttribute("aria-label", "Team " + (i + 1) + " color");
      var inp = el("input");
      inp.type = "text"; inp.id = "team-" + i; inp.placeholder = "Team " + (i + 1);
      inp.maxLength = 40; inp.value = state.names[i] || ""; inp.autocomplete = "off";
      inp.setAttribute("aria-label", "Team " + (i + 1) + " name");
      var err = el("div", "err"); err.hidden = true;
      function owner(hex) {
        for (var j = 0; j < N; j++) if (j !== i && similarColor(state.colors[j], hex)) return j;
        return -1;
      }
      inp.addEventListener("input", function () {
        state.names[i] = inp.value; save(); refreshLabels(); renderTable();
      });
      col.addEventListener("input", function () {
        var o = owner(col.value);
        if (o >= 0) { err.textContent = "Too close to " + nameOf(o) + "'s color"; err.hidden = false; return; }
        err.hidden = true;
        state.colors[i] = col.value.toLowerCase(); save(); refreshLabels(); renderTable();
      });
      col.addEventListener("change", function () {
        if (owner(col.value) >= 0) col.value = state.colors[i];
      });
      teamRefs[i] = { name: inp, color: col };
      f.appendChild(col); f.appendChild(inp);
      row.appendChild(f); row.appendChild(err);
      host.appendChild(row);
    })(i);
  }


  /* knockout */
  var KO = [
    { id: "qf1", label: "Quarterfinal 1", col: 0, h: { seed: 1 }, a: { seed: 8 } },
    { id: "qf2", label: "Quarterfinal 2", col: 0, h: { seed: 4 }, a: { seed: 5 } },
    { id: "qf3", label: "Quarterfinal 3", col: 0, h: { seed: 2 }, a: { seed: 7 } },
    { id: "qf4", label: "Quarterfinal 4", col: 0, h: { seed: 3 }, a: { seed: 6 } },
    { id: "sf1", label: "Semifinal 1", col: 1, h: { from: "qf1", tag: "QF1" }, a: { from: "qf2", tag: "QF2" } },
    { id: "sf2", label: "Semifinal 2", col: 1, h: { from: "qf3", tag: "QF3" }, a: { from: "qf4", tag: "QF4" } },
    { id: "f", label: "Final", col: 2, h: { from: "sf1", tag: "SF1" }, a: { from: "sf2", tag: "SF2" } }
  ];
  var koRefs = {};

  function playedCount() {
    var c = 0;
    rounds.forEach(function (ms) { ms.forEach(function (m) { if (result(m)) c++; }); });
    return c;
  }

  function resolveKO() {
    var done = playedCount() === 45;
    var seeds = done ? computeTable().map(function (r) { return r.i; }) : null;
    var res = {};
    KO.forEach(function (m) {
      function side(s) {
        if (s.seed) return seeds ? seeds[s.seed - 1] : null;
        var w = res[s.from] ? res[s.from].win : null;
        return w === undefined ? null : w;
      }
      var home = side(m.h), away = side(m.a);
      var st = state.ko[m.id] || ["", "", ""];
      var sh = parseScore(st[0]), sa = parseScore(st[1]);
      var win = null, level = false;
      if (home !== null && away !== null && sh !== null && sa !== null) {
        if (sh > sa) win = home;
        else if (sa > sh) win = away;
        else { level = true; win = st[2] === "h" ? home : st[2] === "a" ? away : null; }
      }
      res[m.id] = { home: home, away: away, win: win, level: level, pen: st[2] };
    });
    return { done: done, res: res };
  }

  function buildKO() {
    var host = document.getElementById("ko");
    var titles = ["Quarterfinals", "Semifinals", "Final"];
    var cols = [];
    for (var c = 0; c < 3; c++) { var col = el("div", "ko-col"); col.appendChild(el("h3", "", titles[c])); var body = el("div", "ko-body"); col.appendChild(body); host.appendChild(col); cols.push(body); }
    KO.forEach(function (m) {
      var box = el("div", "km");
      box.appendChild(el("div", "cap", m.label));
      var refs = { slots: [] };
      ["h", "a"].forEach(function (k, idx) {
        var row = el("div", "slot" + (idx === 0 ? " first" : "") + (m[k].seed ? " q" : ""));
        var tag = el("div", "seed", m[k].seed ? m[k].seed : "");
        var nm = el("div", "nm");
        var inp = el("input");
        digitsOnly(inp);
        inp.id = "ko-" + m.id + "-" + k;
        inp.setAttribute("aria-label", m.label + (idx === 0 ? " top team score" : " bottom team score"));
        var st = state.ko[m.id];
        if (st) inp.value = st[idx];
        inp.addEventListener("input", function () {
          var cur = state.ko[m.id] || ["", "", ""];
          cur[idx] = inp.value;
          var a = parseScore(cur[0]), b = parseScore(cur[1]);
          if (a === null || b === null || a !== b) cur[2] = "";
          state.ko[m.id] = cur; save(); refreshKO();
        });
        row.appendChild(tag); row.appendChild(nm); row.appendChild(inp);
        box.appendChild(row);
        refs.slots.push({ row: row, nm: nm, inp: inp });
      });
      var pens = el("div", "pens"); pens.hidden = true;
      pens.appendChild(el("span", "", "Level after full time. Penalty winner:"));
      refs.penBtns = ["h", "a"].map(function (k) {
        var b = el("button"); b.type = "button";
        b.addEventListener("click", function () {
          if (!canEdit) return;
          var cur = state.ko[m.id] || ["", "", ""];
          cur[2] = k; state.ko[m.id] = cur; save(); refreshKO();
        });
        pens.appendChild(b); return b;
      });
      refs.pens = pens; box.appendChild(pens);
      cols[m.col].appendChild(box);
      koRefs[m.id] = refs;
    });
  }

  function refreshKO() {
    var r = resolveKO();
    var lock = document.getElementById("lock");
    lock.textContent = playedCount() + " of 45 matches played";
    KO.forEach(function (m) {
      var x = r.res[m.id], refs = koRefs[m.id];
      var teams = [x.home, x.away];
      refs.slots.forEach(function (s, idx) {
        var side = idx === 0 ? m.h : m.a;
        var t = teams[idx];
        var prevTeam = s.team; s.team = t;
        var wasWin = s.row.classList.contains("win");
        s.nm.className = "nm" + (t === null ? " tbd" : "");
        if (t !== null) fillLabel(s.nm, t, false);
        else s.nm.textContent = side.seed ? "Seed " + side.seed : "Winner " + side.tag;
        s.inp.disabled = x.home === null || x.away === null;
        var nowWin = t !== null && x.win === t;
        s.row.classList.toggle("win", nowWin);
        if (prevTeam !== undefined && prevTeam !== t && t !== null) {
          anim(s.nm, [{ opacity: 0, transform: "translateX(-16px)" }, { opacity: 1, transform: "none" }], { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)" });
        }
        if (nowWin && !wasWin) anim(s.row, [{ transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 500, easing: "ease-out" });
      });
      refs.pens.hidden = !x.level;
      if (x.level) {
        refs.penBtns.forEach(function (b, idx) {
          var t = teams[idx];
          b.textContent = nameOf(t);
          var on = x.pen === (idx === 0 ? "h" : "a");
          b.className = on ? "on" : "";
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.disabled = !canEdit;
        });
      }
    });
    var champ = document.getElementById("champ");
    var w = r.res.f.win;
    var wasHidden = champ.hidden;
    champ.hidden = w === null;
    if (w !== null && wasHidden) anim(champ, [{ opacity: 0, transform: "translateY(18px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
    if (w !== null) document.getElementById("champ-name").textContent = nameOf(w);
  }

  var armed = false, timer = null;
  document.getElementById("clear").addEventListener("click", function () {
    var btn = document.getElementById("clear");
    if (!canEdit) return;
    if (!armed) {
      armed = true; btn.textContent = "Tap again to confirm";
      timer = setTimeout(function () { armed = false; btn.textContent = "Clear all scores"; }, 5000);
      return;
    }
    clearTimeout(timer); armed = false; btn.textContent = "Clear all scores";
    state.scores = {}; state.ko = {}; save();
    document.querySelectorAll(".match input, .slot input").forEach(function (i) { i.value = ""; });
    document.querySelectorAll(".match").forEach(function (r) { r.classList.remove("done"); });
    renderTable();
  });

  var xOpen = null;
  var IC_OPEN = "M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4", IC_CLOSE = "M6 2v4H2M10 2v4h4M14 10h-4v4M2 10h4v4";
  function setLbl(sec, open) {
    var b = sec.querySelector(".xbtn"); if (!b) return;
    b.setAttribute("aria-label", open ? "Close" : "Expand"); b.title = open ? "Close" : "Expand";
    var pth = b.querySelector("path"); if (pth) pth.setAttribute("d", open ? IC_CLOSE : IC_OPEN);
  }
  var fitting = false;
  function fitX() {
    if (!xOpen || fitting) return;
    fitting = true;
    var f = xOpen.querySelector(".xfit"); if (!f) { fitting = false; return; }
    var cs = getComputedStyle(xOpen);
    var cw = xOpen.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ch = xOpen.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    f.style.width = cw + "px";
    var lo = 8, hi = 64;
    for (var i = 0; i < 12; i++) {
      var mid = (lo + hi) / 2;
      xOpen.style.setProperty("--fs", mid + "px");
      if (f.offsetHeight <= ch && f.scrollWidth <= cw + 1) lo = mid; else hi = mid;
    }
    xOpen.style.setProperty("--fs", lo + "px");
    fitting = false;
  }
  function openX(sec) {
    if (xOpen) closeX();
    xOpen = sec; sec.classList.add("full"); document.body.classList.add("xlock"); setLbl(sec, true);
    fitX();
    if (sec.requestFullscreen) { try { var pr = sec.requestFullscreen(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
  }
  function closeX() {
    if (!xOpen) return;
    var sec = xOpen; xOpen = null;
    var f = sec.querySelector(".xfit"); if (f) { f.style.width = ""; f.style.transform = ""; }
    sec.style.removeProperty("--fs");
    sec.classList.remove("full"); document.body.classList.remove("xlock"); setLbl(sec, false);
    if (document.fullscreenElement && document.exitFullscreen) { try { var pr = document.exitFullscreen(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
  }
  window.addEventListener("resize", fitX);
  if (window.ResizeObserver) document.querySelectorAll(".xfit").forEach(function (f) { new ResizeObserver(function () { if (xOpen && !fitting) requestAnimationFrame(fitX); }).observe(f); });
  document.querySelectorAll(".xbtn").forEach(function (b) {
    b.addEventListener("click", function () {
      var sec = document.getElementById(b.getAttribute("data-sec"));
      if (xOpen === sec) closeX(); else openX(sec);
    });
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && xOpen) closeX(); });
  document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement && xOpen) closeX(); else fitX(); });

  var firstRoute = true;
  function route() {
    closeX();
    var page = location.hash === "#fixtures" ? "fixtures" : location.hash === "#settings" ? "settings" : "table";
    if (page === "settings" && !canEdit) page = "table";
    ["table", "fixtures", "settings"].forEach(function (p) {
      document.getElementById("page-" + p).hidden = p !== page;
      var t = document.getElementById("tab-" + p);
      if (p === page) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    if (!firstRoute) anim(document.getElementById("page-" + page), [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: "ease-out" });
    firstRoute = false;
    if (page === "table") renderTable(true);
  }
  window.addEventListener("hashchange", function () { route(); window.scrollTo(0, 0); });

  function fitSub() {
    var title = document.getElementById("title"), sub = document.getElementById("sub"), t = document.getElementById("sub-t");
    var target = title.getBoundingClientRect().width;
    if (!target) return;
    var n = t.textContent.length;
    sub.style.fontSize = "18px"; sub.style.letterSpacing = "0px";
    var w0 = t.getBoundingClientRect().width;
    var size = Math.max(11, 18 * (target * 0.8) / w0);
    sub.style.fontSize = size + "px"; w0 = t.getBoundingClientRect().width;
    if (w0 > target * 0.92) { sub.style.fontSize = (size * target * 0.92 / w0) + "px"; w0 = t.getBoundingClientRect().width; }
    sub.style.letterSpacing = ((target - w0) / (n - 1)) + "px";
  }
  window.addEventListener("resize", fitSub);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSub);

  /* ---- shared data (Supabase). Without config.js values the page runs in local-only mode. ---- */
  var CFG = window.TB_CONFIG || {};
  var REMOTE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && window.supabase.createClient);
  var sb = null, pushTimer = null, pending = false, signedIn = false;

  function stable(o) {
    if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]";
    if (o && typeof o === "object") return "{" + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(o[k]); }).join(",") + "}";
    return JSON.stringify(o);
  }
  function setNote(t) { var n = document.getElementById("sync-note"); n.textContent = t || ""; n.hidden = !t; }

  function applyEditable() {
    document.body.classList.toggle("viewer", !canEdit);
    fxRefs.forEach(function (r) { r.ih.readOnly = !canEdit; r.ia.readOnly = !canEdit; });
    teamRefs.forEach(function (r) { r.name.readOnly = !canEdit; r.color.disabled = !canEdit; });
    KO.forEach(function (m) { koRefs[m.id].slots.forEach(function (s) { s.inp.readOnly = !canEdit; }); });
    document.getElementById("tab-settings").hidden = !canEdit;
    document.getElementById("clear").hidden = !canEdit;
    refreshKO();
  }

  function refreshUI() {
    fxRefs.forEach(function (r) {
      var s = state.scores[r.m.id];
      r.ih.value = s ? s[0] : ""; r.ia.value = s ? s[1] : "";
      r.row.classList.toggle("done", !!result(r.m));
    });
    for (var i = 0; i < N; i++) { teamRefs[i].name.value = state.names[i] || ""; teamRefs[i].color.value = state.colors[i]; }
    KO.forEach(function (m) {
      var st = state.ko[m.id];
      koRefs[m.id].slots.forEach(function (s, idx) { s.inp.value = st ? st[idx] : ""; });
    });
    refreshLabels(); renderTable();
  }

  function applyRemote(d) {
    if (pending || !d || typeof d !== "object") return;
    if (stable(d) === stable(state)) return;
    adopt(d); cache(); refreshUI();
  }

  function fetchRemote() {
    sb.from("tournament").select("data").eq("id", "main").maybeSingle().then(function (r) {
      if (r.error || !r.data) return;
      var d = r.data.data;
      if (d && Array.isArray(d.names)) applyRemote(d);
      else if (canEdit) schedulePush();
    }, function () {});
  }

  function push() {
    var body = JSON.parse(JSON.stringify(state)), sent = stable(body);
    sb.from("tournament").upsert({ id: "main", data: body, updated_at: new Date().toISOString() }).then(function (r) {
      if (r.error) throw r.error;
      setNote("");
      if (stable(state) === sent) pending = false; else schedulePush();
    }).catch(function () {
      setNote("Not saved. Retrying");
      clearTimeout(pushTimer); pushTimer = setTimeout(push, 5000);
    });
  }
  function schedulePush() {
    if (!REMOTE || !canEdit) return;
    pending = true; clearTimeout(pushTimer); pushTimer = setTimeout(push, 500);
  }

  function updateAuthUI() {
    var b = document.getElementById("auth-btn");
    b.querySelector(".i-lock").hidden = signedIn;
    b.querySelector(".i-unlock").hidden = !signedIn;
    var t = signedIn ? "Sign out" : "Organizer sign in";
    b.setAttribute("aria-label", t); b.title = t;
    if (signedIn) document.getElementById("auth-form").hidden = true;
  }
  function setAuth(on) {
    var changed = on !== signedIn;
    signedIn = on; canEdit = on;
    applyEditable(); updateAuthUI();
    if (changed) { route(); if (on) setTimeout(fetchRemote, 0); }
  }

  function initSync() {
    if (CFG.supabaseUrl && CFG.supabaseAnonKey && !(window.supabase && window.supabase.createClient)) { setNote("Backend library not loaded"); return; }
    if (!REMOTE) return;
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    canEdit = false; applyEditable();
    var btn = document.getElementById("auth-btn"), form = document.getElementById("auth-form"), err = document.getElementById("auth-err");
    btn.hidden = false;
    btn.addEventListener("click", function () {
      if (signedIn) { sb.auth.signOut(); return; }
      form.hidden = !form.hidden;
      if (!form.hidden) document.getElementById("auth-email").focus();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); err.textContent = "";
      sb.auth.signInWithPassword({ email: document.getElementById("auth-email").value.trim(), password: document.getElementById("auth-pass").value }).then(function (r) {
        if (r.error) { err.textContent = r.error.message || "Sign in failed"; return; }
        document.getElementById("auth-pass").value = "";
      }).catch(function () { err.textContent = "Could not reach Supabase. Check the URL and key in config.js."; });
    });
    sb.auth.getSession().then(function (r) { setAuth(!!(r.data && r.data.session)); });
    sb.auth.onAuthStateChange(function (ev, session) { setAuth(!!session); });
    fetchRemote();
    sb.channel("tournament-main").on("postgres_changes", { event: "*", schema: "public", table: "tournament", filter: "id=eq.main" }, function (p) {
      if (p.new && p.new.data) applyRemote(p.new.data);
    }).subscribe();
    setInterval(function () { if (!document.hidden) fetchRemote(); }, 20000);
  }

  load(); renderTeams(); renderFixtures(); buildKO(); renderTable(); route(); fitSub(); initSync();
})();
