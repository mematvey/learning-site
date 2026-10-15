/* Пошаговые карточки «Как считается внимание» (M3, StepCards).
 * Контейнер: #steps-demo. Без зависимостей, KaTeX используется, если загружен.
 */
(function () {
  'use strict';

  var CELL = 16;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Матрицы схемы: x, y — левый верхний угол; r × c — число ячеек (CELL px каждая).
  var BOX = {
    Q: { x: 20, y: 40, r: 6, c: 4, cls: 'm-q', name: 'Q', dim: 'n × d', ly: 26 },
    K: { x: 120, y: 56, r: 4, c: 6, cls: 'm-k', name: 'Kᵀ', dim: 'd × n', ly: 26 },
    S: { x: 244, y: 40, r: 6, c: 6, cls: 'm-s', name: 'S', dim: 'n × n', ly: 26 },
    A: { x: 244, y: 200, r: 6, c: 6, cls: 'm-a', name: 'A', dim: 'n × n', ly: 186 },
    V: { x: 372, y: 200, r: 6, c: 4, cls: 'm-v', name: 'V', dim: 'n × d', ly: 186 },
    O: { x: 464, y: 200, r: 6, c: 4, cls: 'm-o', name: 'O', dim: 'n × d', ly: 186 }
  };

  var STEPS = [
    {
      title: 'Оценки сходства',
      text:
        'Каждый запрос из Q сравнивается с каждым ключом из K скалярным произведением (dot product). ' +
        'Большое значение означает, что токены «смотрят» друг на друга. ' +
        'Результат — матрица S размера n × n: строка i содержит оценки всех токенов для запроса i.',
      tex: 'S = QK^{\\top}',
      plain: 'S = QKᵀ',
      active: ['Q', 'K', 'S'],
      note: 'Q и Kᵀ дают S. Размер S зависит от числа токенов n, а не от d.'
    },
    {
      title: 'Масштаб 1/√d',
      text:
        'Скалярное произведение растёт с размерностью d: при больших d оценки по модулю становятся большими, ' +
        'и softmax на следующем шаге почти не различает их. ' +
        'Делим все оценки на √d, чтобы их разброс оставался примерно одинаковым при любом d.',
      tex: '\\dfrac{S}{\\sqrt{d}}',
      plain: 'S / √d',
      active: ['S'],
      note: 'Деление меняет значения в S, но не размер матрицы.'
    },
    {
      title: 'Веса внимания',
      text:
        'Softmax применяем к каждой строке отдельно. Веса неотрицательны и в сумме дают 1, ' +
        'поэтому i-я строка матрицы A — это распределение внимания токена i по всем ключам.',
      tex: 'A_{ij} = \\dfrac{e^{S_{ij}}}{\\sum_{k} e^{S_{ik}}}',
      plain: 'A = softmax(S) по строкам',
      active: ['S', 'A', 'arrow'],
      note: 'Каждая строка A в сумме даёт 1.'
    },
    {
      title: 'Выход',
      text:
        'Каждый выходной вектор — взвешенная сумма значений V с весами из соответствующей строки A. ' +
        'Размер O совпадает с Q, то есть n × d, поэтому слои внимания можно ставить друг за другом.',
      tex: 'O = AV',
      plain: 'O = AV',
      active: ['A', 'V', 'O'],
      note: 'O имеет размер n × d, как Q и V.'
    }
  ];

  function gridPath(x, y, w, h, rows, cols) {
    var d = '';
    var i, j;
    for (i = 1; i < cols; i++) d += 'M' + (x + i * CELL) + ' ' + y + 'V' + (y + h);
    for (j = 1; j < rows; j++) d += 'M' + x + ' ' + (y + j * CELL) + 'H' + (x + w);
    return d;
  }

  function matrixSvg(id, b) {
    var w = b.c * CELL;
    var h = b.r * CELL;
    var cx = b.x + w / 2;
    return (
      '<g class="sc-m ' + b.cls + '" data-m="' + id + '">' +
      '<rect class="sc-box" x="' + b.x + '" y="' + b.y + '" width="' + w + '" height="' + h + '" rx="4"/>' +
      '<path class="sc-grid" d="' + gridPath(b.x, b.y, w, h, b.r, b.c) + '"/>' +
      '<text class="sc-name" x="' + cx + '" y="' + b.ly + '">' + b.name + '</text>' +
      '<text class="sc-dim" x="' + cx + '" y="' + (b.y + h + 18) + '">' + b.dim + '</text>' +
      '</g>'
    );
  }

  var DIAGRAM =
    matrixSvg('Q', BOX.Q) +
    matrixSvg('K', BOX.K) +
    matrixSvg('S', BOX.S) +
    matrixSvg('A', BOX.A) +
    matrixSvg('V', BOX.V) +
    matrixSvg('O', BOX.O) +
    '<text class="sc-op" x="100" y="96">×</text>' +
    '<text class="sc-op" x="230" y="96">=</text>' +
    '<text class="sc-op" x="356" y="256">×</text>' +
    '<text class="sc-op" x="450" y="256">=</text>' +
    '<g class="sc-m sc-arrow" data-m="arrow">' +
    '<path class="sc-line" d="M322 144V190"/>' +
    '<path class="sc-head" d="M316 190L322 199L328 190Z"/>' +
    '<text class="sc-soft" x="334" y="172">softmax</text>' +
    '</g>' +
    '<g class="sc-pop" data-only="2">' +
    '<rect class="sc-pill" x="356" y="74" width="84" height="28" rx="14"/>' +
    '<text class="sc-pill-t" x="398" y="93">÷ √d</text>' +
    '</g>';

  function renderFormula(el, step) {
    if (window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(step.tex, el, { displayMode: true, throwOnError: false });
        return;
      } catch (e) {
        /* падаем в текстовый вариант ниже */
      }
    }
    el.textContent = step.plain;
  }

  function init() {
    var root = document.getElementById('steps-demo');
    if (!root) return;

    root.classList.add('sc');
    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Пошаговые карточки: вычисление внимания');
    root.innerHTML =
      '<div class="sc-card">' +
      '<p class="sc-count"></p>' +
      '<h3 class="sc-title"></h3>' +
      '<p class="sc-text"></p>' +
      '<div class="sc-formula"></div>' +
      '<div class="sc-nav">' +
      '<button type="button" class="sc-btn" data-act="prev">Назад</button>' +
      '<div class="sc-dots"></div>' +
      '<button type="button" class="sc-btn sc-btn-primary" data-act="next">Далее</button>' +
      '</div>' +
      '</div>' +
      '<figure class="sc-fig">' +
      '<svg class="sc-svg" viewBox="0 0 540 330" role="img" ' +
      'aria-label="Q умножается на Kᵀ и даёт S; softmax даёт A; A умножается на V и даёт O">' +
      DIAGRAM +
      '</svg>' +
      '<figcaption class="sc-cap">Рис. 2. Схема вычисления внимания: Q и Kᵀ дают S, softmax даёт A, A и V дают O.</figcaption>' +
      '<p class="sc-note"><b>Что заметить:</b> <span></span></p>' +
      '<details class="sc-alt"><summary>Описание рисунка</summary>' +
      '<p>Слева направо: Q (n × d) умножается на Kᵀ (d × n), получается S (n × n). ' +
      'Softmax по строкам даёт A (n × n). A умножается на V (n × d), получается O (n × d). ' +
      'n — число токенов, d — размерность.</p></details>' +
      '</figure>';

    var card = root.querySelector('.sc-card');
    var countEl = root.querySelector('.sc-count');
    var titleEl = root.querySelector('.sc-title');
    var textEl = root.querySelector('.sc-text');
    var formulaEl = root.querySelector('.sc-formula');
    var noteEl = root.querySelector('.sc-note span');
    var prevBtn = root.querySelector('[data-act="prev"]');
    var nextBtn = root.querySelector('[data-act="next"]');
    var dotsEl = root.querySelector('.sc-dots');
    var groups = root.querySelectorAll('[data-m]');
    var pops = root.querySelectorAll('[data-only]');
    var idx = 0;

    STEPS.forEach(function (s, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'sc-dot';
      dot.setAttribute('aria-label', 'Шаг ' + (i + 1));
      dot.dataset.step = String(i);
      dotsEl.appendChild(dot);
    });

    function show(next) {
      idx = Math.max(0, Math.min(STEPS.length - 1, next));
      var s = STEPS[idx];

      countEl.textContent = 'Шаг ' + (idx + 1) + ' из ' + STEPS.length;
      titleEl.textContent = s.title;
      textEl.textContent = s.text;
      renderFormula(formulaEl, s);
      noteEl.textContent = s.note;

      groups.forEach(function (g) {
        g.classList.toggle('is-on', s.active.indexOf(g.dataset.m) !== -1);
      });
      pops.forEach(function (p) {
        p.classList.toggle('is-on', p.dataset.only === String(idx + 1));
      });
      dotsEl.querySelectorAll('.sc-dot').forEach(function (d, i) {
        if (i === idx) d.setAttribute('aria-current', 'step');
        else d.removeAttribute('aria-current');
      });

      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === STEPS.length - 1;

      // Перезапуск плавного появления текста карточки.
      card.classList.remove('is-in');
      void card.offsetWidth;
      card.classList.add('is-in');
    }

    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!(t instanceof Element)) return;
      var btn = t.closest('button');
      if (!btn || !root.contains(btn)) return;
      if (btn.dataset.act === 'prev') show(idx - 1);
      else if (btn.dataset.act === 'next') show(idx + 1);
      else if (btn.dataset.step !== undefined) show(Number(btn.dataset.step));
      // Кнопка может заблокироваться (на границах), тогда фокус вернём компоненту.
      if (btn.disabled) root.focus({ preventScroll: true });
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        show(idx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        show(idx + 1);
      }
    });

    // Если KaTeX загрузился позже виджета, перерисовываем формулу.
    window.addEventListener('load', function () {
      if (window.katex) renderFormula(formulaEl, STEPS[idx]);
    });

    show(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
