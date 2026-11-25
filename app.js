(function () {
  var groups = window.ZQ_GROUPS, demos = window.ZQ_DEMOS.filter(function (d) { return !d.hidden; });
  var main = document.getElementById('main'), tabs = document.getElementById('tabs');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  groups.forEach(function (g) {
    var list = demos.filter(function (d) { return d.group === g.id; });
    if (!list.length) return;
    var a = el('a', 'tab', g.name); a.href = '#' + g.id; tabs.appendChild(a);
    var sec = el('section', 'group'); sec.id = g.id;
    var h = el('h2', null, g.name); h.appendChild(el('span', 'count', String(list.length))); sec.appendChild(h);
    var grid = el('div', 'grid');
    list.forEach(function (d) {
      var card = el('a', 'card');
      card.href = 'play.html?d=' + encodeURIComponent(d.slug);
      var fig = el('div', 'thumb');
      var img = new Image(640, 400); img.loading = 'lazy'; img.decoding = 'async'; img.alt = '';
      img.src = 'thumbs/' + d.slug + '.jpg'; fig.appendChild(img);
      card.appendChild(fig);
      var body = el('div', 'body');
      body.appendChild(el('span', 'chip', d.chip));
      body.appendChild(el('h3', null, d.title));
      card.appendChild(body);
      grid.appendChild(card);
    });
    sec.appendChild(grid); main.appendChild(sec);
  });
})();
