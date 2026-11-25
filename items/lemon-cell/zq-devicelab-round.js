/* ZetaQ Device Lab -> SIM ROUND data layer 1.0 (C8 port, 2026-11-19). ZETAQ_ONE_STANDARD section 10.
   Host-side only: the device files (index look, app.js, vendor.js) are not changed. This file reads the Device Lab's own test
   hooks (window.__lab: S.step = the book step on screen) and the page's own controls, and calls the ONE adapter (window.__S =
   ZQSim.start(...) in the page, tasks in window.ZQ_TASKS = [{id, level, step, kind}]).
   One task = one book step of the device = one round:
     kind 'do'    : done when the child used that step's apparatus (a control, an action button, a tap or drag on the 3D scene)
                    and then went on (Next / Again);
     kind 'watch' : done when the child stayed on the step at least WATCH_MS and then went on.
   Stars: 3 = done on the first visit to the step, 2 = done on a later visit (the child left it unfinished and came back).
   Leaving a step unfinished keeps the round open; it ends as quit when another task starts or the child leaves (adapter rules).
   interaction: set <control id> <number> (slider value, or option index), action <button text slug> true, tap|drag scene true. */
(function () {
  'use strict';
  var S = window.__S, TASKS = window.ZQ_TASKS || [], WATCH_MS = 5000;
  if (!S || !TASKS.length) return;
  var byStep = {}, last = 0;
  TASKS.forEach(function (t) { byStep[t.step] = t; });
  var cur = null, acted = false, entered = 0, visits = {}, solved = {}, prev = null, ended = false;
  function now() { return performance.now(); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'button'; }

  function enter(i) {
    var t = byStep[i];
    if (!t || solved[t.id]) return;
    visits[t.id] = (visits[t.id] || 0) + 1;
    if (!(cur && cur.id === t.id)) { S.task(t.id); cur = t; acted = false; }
    entered = now();
  }
  function leave(p, i) {
    if (!cur || cur.step !== p) return;
    var forward = i === p + 1 || (p === last && i === 0);
    if (!forward) return;
    var ok = cur.kind === 'watch' ? (now() - entered >= WATCH_MS) : acted;
    if (!ok) return;
    S.done(visits[cur.id] > 1 ? 2 : 3); solved[cur.id] = true; cur = null; acted = false;
  }
  function onAct(action, target, value) {
    var L = window.__lab; if (!cur || !L || L.S.step !== cur.step) return;
    acted = true; try { S.act(action, target, value); } catch (e) { /* adapter throws only on a bad call; never block the sim */ }
  }

  // the child's input on the page's own controls (capture phase: the device handlers run unchanged)
  document.addEventListener('change', function (e) {
    var x = e.target; if (!x || x.type !== 'range' || !x.closest) return;
    var row = x.closest('.ctrl'); if (row) onAct('set', row.dataset.id, +x.value);
  }, true);
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null; if (!b) return;
    var row = b.closest('.ctrl');
    if (row && b.parentNode && b.parentNode.classList.contains('seg')) { onAct('set', row.dataset.id, Array.prototype.indexOf.call(b.parentNode.children, b)); return; }
    if (b.classList.contains('act')) onAct('action', slug(b.textContent), true);
  }, true);
  var down = null;
  document.addEventListener('pointerdown', function (e) { if (e.target && e.target.classList && e.target.classList.contains('scene')) down = { x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener('pointerup', function (e) {
    if (!down) return; var d = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    onAct(d < 8 ? 'tap' : 'drag', 'scene', true);
  }, true);

  window.__zqEndSim = function () { if (ended) return; ended = true; try { S.end(); } catch (e) { /* closed */ } };

  (function wait() {
    var L = window.__lab;
    if (!L || L.S.step == null || L.S.step < 0) return setTimeout(wait, 100);
    last = L.steps - 1; prev = L.S.step; enter(prev);
    setInterval(function () {
      var i = L.S.step; if (i === prev) return;
      leave(prev, i); prev = i; enter(i);
    }, 120);
  })();
})();
