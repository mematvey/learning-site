/* Шорткаты макета: общий модуль для chapter.html и index.html.
 * Действует только через атрибуты страницы, внутренностей не знает:
 *   data-search, data-theme-toggle, data-levels-toggle, a[data-prev], a[data-next],
 *   data-note-btn, data-mark-done, a[data-home], section[id].
 * Нотация: kbd[data-kbd="mod+k"] перерисовывается (⌘K на macOS, Ctrl+K иначе).
 * Публичный API: window.Shortcuts = { formatKbd, openHelp, closeHelp, toast, isMac }.
 * Лабовые шорткаты (mod+enter, mod+s, mod+shift+backspace) здесь только показываются в справке.
 */
(function () {
  'use strict';
  if (window.Shortcuts) return;

  var HEAD_OFFSET = 72; // высота липкой шапки для прокрутки к разделам
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function detectMac() {
    var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (!p) p = navigator.userAgent || '';
    return /mac|iphone|ipad|ipod/i.test(p);
  }
  var isMac = detectMac();

  var SYM_MAC = { mod: '⌘', shift: '⇧', alt: '⌥', ctrl: '⌃', enter: '↵', backspace: '⌫', esc: 'Esc', space: 'Space', tab: '⇥', up: '↑', down: '↓', left: '←', right: '→' };
  var SYM_WIN = { mod: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', enter: 'Enter', backspace: 'Backspace', esc: 'Esc', space: 'Space', tab: 'Tab', up: '↑', down: '↓', left: '←', right: '→' };
  var ORDER_MAC = ['mod', 'shift', 'alt', 'ctrl'];
  var ORDER_WIN = ['mod', 'ctrl', 'alt', 'shift'];

  function keyLabel(key, table) {
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
    return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
  }

  // formatKbd("mod+shift+backspace") -> "⌘⇧⌫" (mac) или "Ctrl+Shift+Backspace" (win).
  // Второй аргумент необязателен: 'mac' | 'win'; по умолчанию текущая платформа.
  // Пробел разделяет последовательность клавиш: "g h" -> "G H".
  function formatKbd(spec, platform) {
    var win = platform ? platform === 'win' : !isMac;
    var table = win ? SYM_WIN : SYM_MAC;
    var order = win ? ORDER_WIN : ORDER_MAC;
    return String(spec).trim().split(/\s+/).map(function (chord) {
      var parts = chord.toLowerCase().split('+');
      var key = parts.pop();
      var labels = order.filter(function (m) { return parts.indexOf(m) !== -1; })
        .map(function (m) { return table[m]; });
      labels = labels.filter(function (l, i) { return labels.indexOf(l) === i; });
      var k = keyLabel(key, table);
      return win ? labels.concat([k]).join('+') : labels.join('') + k;
    }).join(' ');
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isEditable(el) {
    return !!el && (el.isContentEditable || el.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
  }

  function clickEl(sel) {
    var el = $(sel);
    if (!el) return false;
    el.click();
    return true;
  }

  function focusSearch() {
    var s = $('[data-search]');
    if (!s) return false;
    s.focus();
    if (typeof s.select === 'function') s.select();
    return true;
  }

  // Тост внизу: «Тема: тёмная», «Раздел: Математика»
  var toastEl = null;
  var toastTimer = 0;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'kbd-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1500);
  }

  // ---- Окно справки ----
  var GROUPS = [
    { title: 'Навигация', items: [
      ['mod+k', 'Поиск'], ['/', 'Поиск (фокус в поле)'], ['1-5', 'Карта топика (главная)'],
      ['[', 'Предыдущая глава'], [']', 'Следующая глава'], ['g h', 'На главную']
    ] },
    { title: 'Чтение', items: [
      ['j', 'Следующий раздел'], ['k', 'Предыдущий раздел'], ['l', 'Уровни объяснения'],
      ['n', 'Заметка к выделению'], ['m', 'Отметить пройденным']
    ] },
    { title: 'Лаб', items: [
      ['mod+enter', 'Запустить код'], ['mod+s', 'Сохранить черновик'],
      ['mod+shift+backspace', 'Сбросить к стартовому коду'], ['esc', 'Выйти из редактора']
    ] },
    { title: 'Вид', items: [
      ['t', 'Сменить тему'], ['?', 'Эта справка'], ['esc', 'Закрыть окно']
    ] }
  ];

  var helpEl = null;
  var helpPlatform = isMac ? 'mac' : 'win';
  var lastFocus = null;

  function renderGroups() {
    var box = $('.kbd-groups', helpEl);
    box.innerHTML = GROUPS.map(function (g) {
      return '<div class="kbd-group"><h3>' + g.title + '</h3><ul>' +
        g.items.map(function (it) {
          return '<li><span class="kbd-desc">' + it[1] + '</span><kbd>' + formatKbd(it[0], helpPlatform) + '</kbd></li>';
        }).join('') + '</ul></div>';
    }).join('');
    $all('.kbd-seg button', helpEl).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-plat') === helpPlatform));
    });
  }

  function buildHelp() {
    helpEl = document.createElement('div');
    helpEl.className = 'kbd-backdrop';
    helpEl.hidden = true;
    helpEl.innerHTML =
      '<div class="kbd-dialog" role="dialog" aria-modal="true" aria-labelledby="kbd-title">' +
        '<header class="kbd-head">' +
          '<h2 class="kbd-title" id="kbd-title">Шорткаты</h2>' +
          '<div class="kbd-seg" role="group" aria-label="Показать клавиши для">' +
            '<button type="button" data-plat="mac">macOS</button>' +
            '<button type="button" data-plat="win">Windows</button>' +
          '</div>' +
          '<button type="button" class="kbd-close" aria-label="Закрыть">×</button>' +
        '</header>' +
        '<div class="kbd-groups"></div>' +
        '<p class="kbd-foot">Однобуквенные клавиши не работают, когда курсор в поле ввода.</p>' +
      '</div>';
    document.body.appendChild(helpEl);

    helpEl.addEventListener('click', function (e) {
      if (e.target === helpEl || e.target.closest('.kbd-close')) closeHelp();
      var seg = e.target.closest('.kbd-seg button');
      if (seg) {
        helpPlatform = seg.getAttribute('data-plat');
        renderGroups();
      }
    });
  }

  function isHelpOpen() { return !!helpEl && !helpEl.hidden; }

  function openHelp() {
    if (!helpEl) buildHelp();
    if (isHelpOpen()) return;
    lastFocus = document.activeElement;
    renderGroups();
    helpEl.hidden = false;
    $('.kbd-close', helpEl).focus();
  }

  function closeHelp() {
    if (!isHelpOpen()) return;
    helpEl.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    lastFocus = null;
  }

  // Фокус не уходит из окна справки: Tab и Shift+Tab циклятся внутри.
  function trapTab(e) {
    var f = $all('button:not([disabled])', helpEl);
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    var inside = helpEl.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  }

  // ---- Навигация по разделам (j / k) ----
  function sectionTitle(sec) {
    var h = sec.querySelector('h1, h2, h3');
    return h ? h.textContent.trim() : sec.id;
  }

  function jumpSection(dir) {
    var secs = $all('section[id]');
    if (!secs.length) return;
    var cur = -1;
    secs.forEach(function (s, i) {
      if (s.getBoundingClientRect().top <= HEAD_OFFSET + 8) cur = i;
    });
    var target = dir > 0 ? secs[cur + 1] : secs[cur > 0 ? cur - 1 : 0];
    if (!target) return;
    var y = window.pageYOffset + target.getBoundingClientRect().top - HEAD_OFFSET;
    window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    toast('Раздел: ' + sectionTitle(target));
  }

  function toggleTheme() {
    if (!clickEl('[data-theme-toggle]')) return;
    setTimeout(function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      toast('Тема: ' + (dark ? 'тёмная' : 'светлая'));
    }, 0);
  }

  // ---- Глобальный обработчик ----
  var gUntil = 0;

  function onKey(e) {
    var key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    var open = isHelpOpen();

    if (key === 'Escape') {
      if (open) { e.preventDefault(); closeHelp(); }
      return;
    }
    if (open) {
      if (key === 'Tab') trapTab(e);
      else if (e.key === '?') { e.preventDefault(); closeHelp(); }
      return;
    }

    // Mod+K работает и в полях ввода
    var mod = isMac ? (e.metaKey && !e.ctrlKey) : (e.ctrlKey && !e.metaKey);
    if (mod && !e.altKey && key === 'k') {
      if (focusSearch()) e.preventDefault();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isEditable(e.target)) return;

    if (e.key === '/') {
      if (focusSearch()) e.preventDefault();
      return;
    }
    if (e.key === '?') {
      e.preventDefault();
      openHelp();
      return;
    }

    // G затем H: на главную, окно 1 с
    if (key === 'g') { gUntil = Date.now() + 1000; return; }
    if (key === 'h' && Date.now() < gUntil) {
      gUntil = 0;
      if (clickEl('a[data-home]')) e.preventDefault();
      return;
    }
    gUntil = 0;

    var handled = true;
    switch (key) {
      case 't': toggleTheme(); break;
      case 'l': clickEl('[data-levels-toggle]'); break;
      case '[': clickEl('a[data-prev]'); break;
      case ']': clickEl('a[data-next]'); break;
      case 'n': clickEl('[data-note-btn]'); break;
      case 'm': clickEl('[data-mark-done]'); break;
      case 'j': jumpSection(1); break;
      case 'k': jumpSection(-1); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  // ---- Перерисовка нотации ----
  function render(root) {
    $all('kbd[data-kbd]', root).forEach(function (el) {
      el.textContent = formatKbd(el.getAttribute('data-kbd'));
    });
    // Кнопки и подсказки: title дополняется шорткатом
    $all('[data-shortcut]', root).forEach(function (el) {
      if (el.dataset.shortcutBase === undefined) el.dataset.shortcutBase = el.getAttribute('title') || '';
      var base = el.dataset.shortcutBase;
      var k = formatKbd(el.getAttribute('data-shortcut'));
      el.setAttribute('title', base ? base + ' (' + k + ')' : k);
    });
  }

  function init() {
    render(document);
    if (new URLSearchParams(location.search).get('help') === '1') openHelp();
  }

  window.Shortcuts = {
    formatKbd: formatKbd,
    openHelp: openHelp,
    closeHelp: closeHelp,
    toast: toast,
    isMac: isMac
  };

  document.addEventListener('keydown', onKey);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
