/* Лаб с кодом (макет). Редактор с подсветкой и панель результата.
 * Реального выполнения Python нет: результаты имитируются. Монтируется в #lab-demo. */
(function () {
  'use strict';

  var MOUNT_ID = 'lab-demo';
  var DRAFT_KEY = 'lab-demo:draft';
  var ERR_LINE = 17;

  var STARTER = [
    'import numpy as np',
    '',
    '',
    'def softmax(x, axis=-1):',
    '    x = x - x.max(axis=axis, keepdims=True)',
    '    e = np.exp(x)',
    '    return e / e.sum(axis=axis, keepdims=True)',
    '',
    '',
    'def attention(Q, K, V, mask=None):',
    '    """Scaled dot-product attention.',
    '',
    '    Q: (n, d), K: (m, d), V: (m, d_v) -> (n, d_v)',
    '    """',
    '    d = Q.shape[-1]',
    '    # TODO: S = Q K^T / sqrt(d)',
    '    scores = Q @ K.T',
    '    # TODO: маска: позиции с False получают -inf',
    '    weights = softmax(scores, axis=-1)',
    '    return weights @ V'
  ].join('\n');

  var TESTS = [
    { name: 'test_shape', desc: 'форма выхода (n, d_v)' },
    { name: 'test_rows_sum_to_one', desc: 'строки весов суммируются в 1' },
    { name: 'test_mask', desc: 'маска убирает запрещённые позиции' },
    { name: 'test_scaling', desc: 'масштабирование 1/√d' }
  ];

  // Веса внимания для запроса «сел» (строка 2) и вывод для трёх первых компонент.
  var TOKENS = ['кот', 'сел', 'на', 'коврик', 'потому', 'что'];
  var EXPECTED = [0.05, 0.41, 0.08, 0.22, 0.03, 0.21];
  var YOURS = [0.04, 0.36, 0.09, 0.25, 0.04, 0.22];
  var OUT_EXP = [0.412, -0.108, 0.637];
  var OUT_YOU = [0.329, -0.108, 0.637];

  var KEYWORDS = /^(?:and|as|assert|class|def|elif|else|for|from|if|import|in|is|lambda|not|or|pass|return|while|with|yield|None|True|False|self)$/;
  var TOKEN_RE = /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*|\b\d+(?:\.\d+)?(?:e-?\d+)?\b|\b[A-Za-z_]\w*\b/g;

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function highlight(src) {
    var out = '';
    var last = 0;
    var re = new RegExp(TOKEN_RE.source, 'g');
    var m;
    while ((m = re.exec(src))) {
      var t = m[0];
      var cls = '';
      if (t.charAt(0) === '#') cls = 'c';
      else if (t.charAt(0) === '"' || t.charAt(0) === "'") cls = 's';
      else if (/^\d/.test(t)) cls = 'n';
      else if (KEYWORDS.test(t)) cls = 'k';
      else if (src.charAt(re.lastIndex) === '(') cls = 'f';
      out += esc(src.slice(last, m.index));
      out += cls ? '<span class="tk-' + cls + '">' + esc(t) + '</span>' : esc(t);
      last = m.index + t.length;
    }
    return out + esc(src.slice(last));
  }

  function storage(action, value) {
    try {
      if (action === 'get') return window.localStorage.getItem(DRAFT_KEY);
      if (action === 'set') window.localStorage.setItem(DRAFT_KEY, value);
      if (action === 'del') window.localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* приватный режим или заблокированное хранилище */ }
    return null;
  }

  function fmt(v) { return (v >= 0 ? ' ' : '') + v.toFixed(3); }

  function chartSVG(pass) {
    var W = 600, H = 200, L = 40, R = 8, T = 10, B = 28, MAX = 0.5;
    var ih = H - T - B, iw = W - L - R, gw = iw / TOKENS.length, bw = 16;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Столбчатая диаграмма весов внимания: ожидаемые и ваши значения">';
    [0, 0.25, 0.5].forEach(function (v) {
      var y = T + ih - (v / MAX) * ih;
      s += '<line class="lab-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>';
      s += '<text class="lab-tick" x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + v.toFixed(2) + '</text>';
    });
    var you = pass ? EXPECTED : YOURS;
    TOKENS.forEach(function (tok, i) {
      var cx = L + i * gw + gw / 2;
      var he = (EXPECTED[i] / MAX) * ih, hy = (you[i] / MAX) * ih;
      s += '<rect class="lab-bar-exp" x="' + (cx - bw - 2) + '" y="' + (T + ih - he) + '" width="' + bw + '" height="' + he + '" rx="3"/>';
      s += '<rect class="lab-bar-you" x="' + (cx + 2) + '" y="' + (T + ih - hy) + '" width="' + bw + '" height="' + hy + '" rx="3"/>';
      s += '<text class="lab-xlab" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + tok + '</text>';
    });
    return s + '</svg>';
  }

  function resultHTML(pass, secs) {
    var summary = pass ? '4 из 4 тестов прошли' : '3 из 4 тестов прошли';
    var list = TESTS.map(function (t) {
      var failed = !pass && t.name === 'test_scaling';
      var head = '<summary><span class="lab-mark">' + (failed ? '✕' : '✓') + '</span>' +
        '<code>' + t.name + '</code><span class="lab-desc">' + t.desc + '</span></summary>';
      if (!failed) return '<li class="lab-test">' + head + '</li>';
      var rows = OUT_EXP.map(function (e, i) {
        var d = Math.abs(e - OUT_YOU[i]);
        var bad = d > 1e-6;
        return '<tr><td>[' + i + ']</td><td>' + fmt(e) + '</td><td' + (bad ? ' class="is-bad"' : '') + '>' +
          fmt(OUT_YOU[i]) + '</td><td' + (bad ? ' class="is-bad"' : '') + '>' + d.toFixed(3) + '</td></tr>';
      }).join('');
      return '<li class="lab-test is-fail"><details open>' + head +
        '<div class="lab-detail">' +
        '<p class="lab-msg">test_scaling: ожидалось max|Δ| &lt; 1e-6, получено <b>0.083</b></p>' +
        '<p class="lab-loc">lab.py:' + ERR_LINE + ' · <span class="tk-k">scores</span> = Q @ K.T</p>' +
        '<table class="lab-cmp"><thead><tr><th>выход, строка 2</th><th>ожидалось</th><th>получено</th><th>|Δ|</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></details></li>';
    }).join('');
    return '<div class="lab-out-head"><span class="lab-summary ' + (pass ? 'is-ok' : 'is-fail') + '"><i></i>' +
      summary + '</span><span class="lab-time">' + secs.toFixed(2) + ' с</span></div>' +
      '<ul class="lab-tests">' + list + '</ul>' +
      '<figure class="lab-chart">' + chartSVG(pass) +
      '<figcaption><span class="lab-legend"><span class="lab-sw lab-sw-exp"></span>ожидаемые</span>' +
      '<span class="lab-legend"><span class="lab-sw lab-sw-you"></span>ваши</span>' +
      'Веса внимания для запроса «сел»</figcaption></figure>';
  }

  function mount(root) {
    root.innerHTML =
      '<section class="lab" aria-labelledby="lab-title">' +
        '<header class="lab-head">' +
          '<div class="lab-title"><h3 id="lab-title">Лаб: реализуйте attention на NumPy</h3>' +
          '<span class="lab-badge">Python · Pyodide</span></div>' +
          '<div class="lab-actions">' +
            '<button type="button" class="lab-btn" data-act="reset">Сбросить</button>' +
            '<button type="button" class="lab-btn lab-btn-primary" data-act="run">▶ Запустить</button>' +
          '</div>' +
        '</header>' +
        '<div class="lab-file-bar"><span>attention.py</span>' +
          '<span class="lab-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> запустить</span></div>' +
        '<div class="lab-body">' +
          '<div class="lab-gutter" aria-hidden="true"></div>' +
          '<div class="lab-code">' +
            '<div class="lab-band" aria-hidden="true"></div>' +
            '<pre class="lab-hl" aria-hidden="true"></pre>' +
            '<textarea class="lab-input" spellcheck="false" wrap="off" aria-label="Код лаба"></textarea>' +
          '</div>' +
        '</div>' +
        '<div class="lab-foot"><span class="lab-saved">Черновик сохранён · 2 мин назад</span>' +
          '<span class="lab-status"></span></div>' +
        '<div class="lab-out" aria-live="polite"></div>' +
      '</section>';

    var q = function (s) { return root.querySelector(s); };
    var ta = q('.lab-input'), pre = q('.lab-hl'), gutter = q('.lab-gutter');
    var band = q('.lab-band'), out = q('.lab-out'), saved = q('.lab-saved');
    var status = q('.lab-status'), btnRun = q('[data-act="run"]');
    var code = q('.lab-code');
    var runs = 0, busy = false, showBand = true;

    code.style.setProperty('--line', ERR_LINE);

    function paint() {
      var src = ta.value;
      pre.innerHTML = highlight(src) + '\n';
      var n = src.split('\n').length, g = '';
      for (var i = 1; i <= n; i++) {
        g += '<span' + (showBand && i === ERR_LINE ? ' class="is-err"' : '') + '>' + i + '</span>';
      }
      gutter.innerHTML = g;
      band.style.display = showBand ? '' : 'none';
    }

    function setStatus(text) { status.textContent = text; }

    function onInput() {
      paint();
      storage('set', ta.value);
      saved.textContent = 'Черновик сохранён · только что';
      setStatus('');
    }

    function run() {
      if (busy) return;
      busy = true;
      runs += 1;
      btnRun.disabled = true;
      var t0 = Date.now();
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var label = function () { return ((Date.now() - t0) / 1000).toFixed(1); };
      out.innerHTML = '<div class="lab-running"><span class="lab-spin"' +
        (reduce ? ' style="animation:none"' : '') + '></span><span class="lab-run-t">Выполняется… ' + label() + ' с</span></div>';
      var timer = setInterval(function () {
        var el = out.querySelector('.lab-run-t');
        if (el) el.textContent = 'Выполняется… ' + label() + ' с';
      }, 100);
      setTimeout(function () {
        clearInterval(timer);
        busy = false;
        btnRun.disabled = false;
        var pass = runs >= 2;
        showBand = !pass;
        paint();
        out.innerHTML = resultHTML(pass, Math.max(0.4, (Date.now() - t0) / 1000));
        setStatus(pass ? 'Все тесты зелёные' : '');
      }, 600);
    }

    function insert(text) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      onInput();
    }

    ta.addEventListener('input', onInput);
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); insert('    '); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var s = ta.selectionStart;
        var ls = ta.value.lastIndexOf('\n', s - 1) + 1;
        var line = ta.value.slice(ls, s);
        var ind = (line.match(/^ */) || [''])[0];
        if (/:\s*$/.test(line)) ind += '    ';
        insert('\n' + ind);
      }
    });

    q('[data-act="reset"]').addEventListener('click', function () {
      ta.value = STARTER;
      storage('del');
      runs = 0;
      showBand = true;
      saved.textContent = 'Стартовый код восстановлен';
      paint();
      out.innerHTML = resultHTML(false, 0.42);
      setStatus('');
    });
    btnRun.addEventListener('click', run);

    var draft = storage('get');
    ta.value = draft !== null ? draft : STARTER;
    paint();
    out.innerHTML = resultHTML(false, 0.42);
  }

  function init() {
    var root = document.getElementById(MOUNT_ID);
    if (root) mount(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
