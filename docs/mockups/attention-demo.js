/* Демо внимания: рисунок для раздела «Интуиция» главы Attention.
 * Контейнер: #attention-demo. Веса считаются в JS из фиксированных
 * псевдо-случайных векторов Q и K (seeded PRNG), softmax по строке.
 * API: window.attentionDemo.set({ scaled: boolean, query: number, d: number }).
 */
(function () {
  'use strict';

  var TOKENS = ['кот', 'сел', 'на', 'коврик', 'потому', 'что'];
  var N = TOKENS.length;
  var D_MAX = 256;
  var VB_W = 1000; // ширина viewBox дуг; высота дуг подгоняется по соотношению сторон
  var VB_H = 170;
  var SEED = 20240607;

  // mulberry32: детерминированный PRNG, одинаковые векторы при каждой загрузке.
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(SEED);

  // Компоненты N(0, 1): Var(q·k) = d, поэтому без масштаба разброс логитов ~ √d.
  function gauss() {
    var u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  }
  function makeVec() {
    var v = [];
    for (var k = 0; k < D_MAX; k++) v.push(gauss());
    return v;
  }
  var Qv = [];
  var Kv = [];
  for (var t = 0; t < N; t++) {
    Qv.push(makeVec());
    Kv.push(makeVec());
  }

  // Матрица весов A[i][j] = softmax_j( q_i·k_j / s ), s = √d при масштабе, иначе 1.
  function attention(d, scaled) {
    var s = scaled ? 1 / Math.sqrt(d) : 1;
    var A = [];
    for (var i = 0; i < N; i++) {
      var z = [];
      var max = -Infinity;
      for (var j = 0; j < N; j++) {
        var dot = 0;
        for (var k = 0; k < d; k++) dot += Qv[i][k] * Kv[j][k];
        z.push(dot * s);
        if (z[j] > max) max = z[j];
      }
      var sum = 0;
      for (j = 0; j < N; j++) {
        z[j] = Math.exp(z[j] - max); // вычитание максимума для численной устойчивости
        sum += z[j];
      }
      for (j = 0; j < N; j++) z[j] /= sum;
      A.push(z);
    }
    return A;
  }

  function sumOf(xs) {
    return xs.reduce(function (s, v) { return s + v; }, 0);
  }
  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }
  function cx(i) {
    return (i + 0.5) * VB_W / N;
  }

  // Дуга от запроса i к ключу j; для i === j маленькая петля.
  function arcD(i, j) {
    var x1 = cx(i);
    var x2 = cx(j);
    var y = VB_H - 2;
    if (i === j) {
      return 'M' + (x1 - 8) + ' ' + y +
        ' C' + (x1 - 40) + ' ' + (y - 80) + ' ' + (x1 + 40) + ' ' + (y - 80) +
        ' ' + (x1 + 8) + ' ' + y;
    }
    var h = 14 + 0.12 * Math.abs(x2 - x1);
    return 'M' + x1 + ' ' + y + ' Q' + (x1 + x2) / 2 + ' ' + (y - 2 * h) + ' ' + x2 + ' ' + y;
  }
  function arcLabelPos(i, j) {
    var x1 = cx(i);
    var x2 = cx(j);
    var y = VB_H - 2;
    if (i === j) return [x1, y - 68];
    var h = 14 + 0.12 * Math.abs(x2 - x1);
    return [(x1 + x2) / 2, y - h - 6];
  }

  var state = { scaled: true, query: 1, d: 64 };
  var hover = null; // { i, j } при наведении на ячейку карты
  var refs = null;

  function build(container) {
    var i, j;
    var chipsHtml = '';
    var vbarsHtml = '';
    var arcsHtml = '';
    var labelsHtml = '';
    var gridHead = '<div class="ad-row ad-head"><span></span>';
    var gridRows = '';
    for (i = 0; i < N; i++) {
      chipsHtml += '<button type="button" class="ad-chip" data-i="' + i + '" aria-pressed="false">' + TOKENS[i] + '</button>';
      vbarsHtml += '<div class="ad-vbar"><div class="ad-vbar-track"><div class="ad-vbar-fill"></div></div><span class="ad-vbar-num"></span></div>';
      arcsHtml += '<path class="ad-arc"></path>';
      labelsHtml += '<text class="ad-arc-l"></text>';
      gridHead += '<span class="ad-h">' + TOKENS[i] + '</span>';
    }
    gridHead += '<span class="ad-sum-h">Σ</span></div>';
    for (i = 0; i < N; i++) {
      gridRows += '<div class="ad-row" data-i="' + i + '"><button type="button" class="ad-rl" data-i="' + i + '">' + TOKENS[i] + '</button>';
      for (j = 0; j < N; j++) {
        gridRows += '<div class="ad-cell" tabindex="0" data-i="' + i + '" data-j="' + j + '"></div>';
      }
      gridRows += '<span class="ad-sum"></span></div>';
    }

    container.innerHTML =
      '<figure class="ad">' +
        '<div class="ad-controls">' +
          '<div class="ad-ctl">' +
            '<span class="ad-label">Масштаб 1/√d</span>' +
            '<button type="button" class="ad-switch" role="switch" aria-label="Масштаб 1/√d" aria-checked="true"><span class="ad-knob"></span></button>' +
            '<span class="ad-state"></span>' +
          '</div>' +
          '<label class="ad-ctl">' +
            '<span class="ad-label">Размерность d</span>' +
            '<input class="ad-range" type="range" min="4" max="256" step="4" value="64">' +
            '<output class="ad-d"></output>' +
          '</label>' +
          '<p class="ad-formula">α<sub>ij</sub> = softmax<sub>j</sub>( q<sub>i</sub>·k<sub>j</sub> <span class="ad-scale">/ √d</span> )</p>' +
        '</div>' +
        '<div class="ad-tokens">' +
          '<svg class="ad-arcs" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" aria-hidden="true">' + arcsHtml + labelsHtml + '</svg>' +
          '<div class="ad-chips" role="group" aria-label="Токены предложения">' + chipsHtml + '</div>' +
          '<div class="ad-vbars">' + vbarsHtml + '</div>' +
          '<p class="ad-vnote">Столбцы — вклад значений: α<sub>qj</sub>·v<sub>j</sub>. Их сумма и есть выход O для запроса.</p>' +
        '</div>' +
        '<div class="ad-bottom">' +
          '<div class="ad-map">' +
            '<p class="ad-map-t">Веса α<sub>ij</sub>: строки — запросы Q, столбцы — ключи K</p>' +
            '<div class="ad-grid">' + gridHead + gridRows + '</div>' +
            '<div class="ad-legend"><span>0</span><span class="ad-ramp"></span><span>1</span></div>' +
          '</div>' +
          '<div class="ad-side">' +
            '<p class="ad-side-t"></p>' +
            '<ol class="ad-side-list"></ol>' +
            '<p class="ad-side-sum"></p>' +
          '</div>' +
        '</div>' +
        '<figcaption class="ad-caption">' +
          '<p class="ad-cap-t"></p>' +
          '<p class="ad-note"></p>' +
        '</figcaption>' +
        '<details class="ad-alt">' +
          '<summary>Описание рисунка</summary>' +
          '<p>Предложение «кот сел на коврик потому что» разбито на шесть токенов. Выбранный токен-запрос (синий) соединён дугами со всеми токенами: чем толще и ярче дуга, тем больше его внимание к этому ключу. Ниже те же веса в виде таблицы 6×6: строка — запрос, столбец — ключ, каждая строка в сумме даёт 1. Переключатель масштаба 1/√d и слайдер d меняют разброс весов.</p>' +
        '</details>' +
      '</figure>';

    refs = {
      root: container.querySelector('.ad'),
      sw: container.querySelector('.ad-switch'),
      swState: container.querySelector('.ad-state'),
      range: container.querySelector('.ad-range'),
      dOut: container.querySelector('.ad-d'),
      chips: all(container, '.ad-chip'),
      rows: all(container, '.ad-grid .ad-row:not(.ad-head)'),
      cells: all(container, '.ad-cell'),
      sums: all(container, '.ad-sum'),
      arcs: all(container, '.ad-arc'),
      arcLabels: all(container, '.ad-arc-l'),
      vfills: all(container, '.ad-vbar-fill'),
      vnums: all(container, '.ad-vbar-num'),
      capT: container.querySelector('.ad-cap-t'),
      note: container.querySelector('.ad-note'),
      sideT: container.querySelector('.ad-side-t'),
      sideList: container.querySelector('.ad-side-list'),
      sideSum: container.querySelector('.ad-side-sum')
    };

    var root = refs.root;
    root.addEventListener('click', function (e) {
      var target = e.target;
      var chip = target.closest('.ad-chip, .ad-rl');
      if (chip) {
        state.query = +chip.getAttribute('data-i');
        update();
        return;
      }
      if (target.closest('.ad-switch')) {
        state.scaled = !state.scaled;
        update();
      }
    });
    root.addEventListener('input', function (e) {
      if (e.target.classList.contains('ad-range')) {
        state.d = +e.target.value;
        update();
      }
    });
    function cellOf(e) {
      return e.target.closest ? e.target.closest('.ad-cell') : null;
    }
    root.addEventListener('mouseover', function (e) {
      var c = cellOf(e);
      setHover(c ? { i: +c.getAttribute('data-i'), j: +c.getAttribute('data-j') } : null);
    });
    root.addEventListener('mouseleave', function () { setHover(null); });
    root.addEventListener('focusin', function (e) {
      var c = cellOf(e);
      if (c) setHover({ i: +c.getAttribute('data-i'), j: +c.getAttribute('data-j') });
    });
    root.addEventListener('focusout', function () { setHover(null); });
  }

  function all(container, sel) {
    return Array.prototype.slice.call(container.querySelectorAll(sel));
  }

  function setHover(h) {
    var same = (!h && !hover) || (h && hover && h.i === hover.i && h.j === hover.j);
    if (same) return;
    hover = h;
    update();
  }

  function update() {
    if (!refs) return;
    var q = state.query;
    var A = attention(state.d, state.scaled);
    var row = A[q];

    refs.root.classList.toggle('is-off', !state.scaled);
    refs.sw.setAttribute('aria-checked', String(state.scaled));
    refs.swState.textContent = state.scaled ? 'вкл' : 'выкл';
    refs.range.value = String(state.d);
    refs.dOut.textContent = 'd = ' + state.d;

    refs.chips.forEach(function (c, i) {
      c.classList.toggle('is-q', i === q);
      c.classList.toggle('is-hl', !!hover && (hover.i === i || hover.j === i));
      c.setAttribute('aria-pressed', String(i === q));
    });

    refs.rows.forEach(function (r, i) {
      r.classList.toggle('is-q', i === q);
    });

    refs.cells.forEach(function (c) {
      var i = +c.getAttribute('data-i');
      var j = +c.getAttribute('data-j');
      var a = A[i][j];
      c.style.background = 'color-mix(in srgb, var(--seq-1) ' + (a * 100).toFixed(1) + '%, var(--seq-0))';
      c.textContent = a.toFixed(2);
      c.setAttribute('data-a', a.toFixed(2));
      c.classList.toggle('mid', a >= 0.45);
      c.classList.toggle('hi', a >= 0.6);
      c.classList.toggle('is-hover', !!hover && hover.i === i && hover.j === j);
    });

    refs.sums.forEach(function (s, i) {
      s.textContent = sumOf(A[i]).toFixed(2);
    });

    refs.arcs.forEach(function (p, j) {
      var a = row[j];
      var pair = !!hover && hover.i === q && hover.j === j;
      p.setAttribute('d', arcD(q, j));
      p.style.strokeWidth = (1 + 14 * a + (pair ? 2 : 0)).toFixed(2);
      p.style.strokeOpacity = (0.12 + 0.88 * a).toFixed(2);
    });
    refs.arcLabels.forEach(function (t, j) {
      var a = row[j];
      var p = arcLabelPos(q, j);
      t.setAttribute('x', p[0].toFixed(1));
      t.setAttribute('y', p[1].toFixed(1));
      t.textContent = a.toFixed(2);
      t.style.opacity = a >= 0.05 ? '1' : '0';
    });

    refs.vfills.forEach(function (f, j) {
      f.style.setProperty('--a', row[j].toFixed(4));
    });
    refs.vnums.forEach(function (n, j) {
      n.textContent = row[j].toFixed(2);
    });

    var order = row.map(function (v, j) { return j; }).sort(function (a, b) { return row[b] - row[a]; });
    var top = order[0];
    refs.sideT.textContent = 'Три сильнейших ключа для «' + TOKENS[q] + '»';
    refs.sideList.innerHTML = order.slice(0, 3).map(function (j) {
      return '<li><span class="ad-top-k">' + TOKENS[j] + '</span>' +
        '<span class="ad-side-bar"><span class="ad-side-fill" style="--a:' + row[j].toFixed(4) + '"></span></span>' +
        '<span class="ad-top-v">' + row[j].toFixed(2) + '</span></li>';
    }).join('');
    refs.sideSum.innerHTML = 'Сумма по строке: <b>' + sumOf(row).toFixed(2) +
      '</b>. Softmax нормирует каждую строку, поэтому сумма всегда 1.';

    var sd = state.scaled ? 1 : Math.sqrt(state.d);
    var spread;
    if (state.scaled) {
      spread = 'Масштаб 1/√d держит разброс логитов около 1 при любом d, поэтому веса мягкие.';
    } else {
      spread = row[top] >= 0.9
        ? 'Без масштаба при этом d один ключ забрал ' + row[top].toFixed(2) + ': распределение почти one-hot.'
        : 'Без масштаба разброс растёт как √d: при большом d веса схлопываются к одному ключу.';
    }
    refs.capT.textContent = 'Рис. 1. Куда смотрит «' + TOKENS[q] + '» в предложении';
    refs.note.textContent = 'Что заметить: сильнее всего «' + TOKENS[q] + '» смотрит на «' +
      TOKENS[top] + '» (' + row[top].toFixed(2) + '). Разброс логитов ≈ ' + sd.toFixed(1) + '. ' + spread;
  }

  function init() {
    var container = document.getElementById('attention-demo');
    if (!container) return;
    build(container);
    update();
  }

  window.attentionDemo = {
    set: function (s) {
      if (!s || typeof s !== 'object') return;
      if (typeof s.scaled === 'boolean') state.scaled = s.scaled;
      if (typeof s.query === 'number' && s.query >= 0 && s.query < N) state.query = Math.floor(s.query);
      if (typeof s.d === 'number') state.d = clamp(Math.round(s.d / 4) * 4, 4, D_MAX);
      update();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
