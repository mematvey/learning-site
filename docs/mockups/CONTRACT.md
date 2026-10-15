# Контракт статического макета

Макет: обычные HTML/CSS/JS без сборки, открываются через `file://`. Цель: показать вид страниц до реализации на SvelteKit. Код макета потом не переиспользуется, но вёрстка и решения переносятся.

## Общие правила

- Все цвета, шрифты, отступы только из `tokens.css` (`var(--...)`). Никаких «сырых» hex в своих файлах, кроме прозрачности через `color-mix(in srgb, var(--x) N%, transparent)`.
- Тема: `?theme=dark` в URL ставит `data-theme="dark"` на `<html>`. Кнопка-переключатель в шапке меняет атрибут. Обе темы должны выглядеть аккуратно.
- Тема топика: `data-topic="dl"` на `<html>` (для главы attention). Акцент топика `var(--topic)` / `var(--topic-soft)`.
- Формулы: KaTeX 0.16.11 с `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/` (`katex.min.css`, `katex.min.js`, `contrib/auto-render.min.js`), разделители `$...$` и `$$...$$`.
- Язык интерфейса и текста: русский, термины по-английски при первом упоминании.
- Без внешних JS-библиотек, кроме KaTeX. Графики: inline SVG, рисуются своим JS.
- Цвета сущностей: Q = `--cat-1`, K = `--cat-2`, V = `--cat-3`. Одинаковы в тексте, формулах (`\color{}` не используем; цвет даём обёрткой `<span class="ent ent-q">`) и на графиках.

## Сборка страницы главы

`chapter.html` владеет каркасом и подключает виджеты:

```html
<link rel="stylesheet" href="attention-demo.css">
<link rel="stylesheet" href="steps-demo.css">
<link rel="stylesheet" href="lab-demo.css">
...
<div id="attention-demo"></div>   <!-- широкий рисунок -->
<div id="steps-demo"></div>
<div id="lab-demo"></div>
...
<script src="attention-demo.js"></script>
<script src="steps-demo.js"></script>
<script src="lab-demo.js"></script>
```

Каждый виджет сам находит свой контейнер по id и рендерится в него. Если контейнера нет, ничего не делает. Каждый виджет должен открываться и отдельно: файл `<widget>.preview.html` в той же папке (подключает `tokens.css`, свой css/js, пустой контейнер, поддерживает `?theme=dark`).

### API между текстом и демо

- Демо внимания выставляет `window.attentionDemo = { set(state) }`, где `state` может содержать `{ scaled: boolean, query: number }` (индекс токена-запроса).
- Ссылки в тексте: `<a class="demo-link" data-demo="attention" data-state='{"scaled":false}'>без масштаба</a>`. Обработчик кликов по `.demo-link` пишет `chapter.html`: парсит `data-state` и вызывает `window.attentionDemo.set(...)`.
- Подсветка сущностей: при наведении на `<span class="ent ent-q">` страница (chapter.html) ставит на `<body>` атрибут `data-hl="q"` (и `k`, `v`). Виджеты в своём CSS усиливают соответствующие элементы при `body[data-hl="q"]` и приглушают остальные.

## Владение файлами

| Пакет | Владеет | Не трогает |
|---|---|---|
| M1 | `chapter.html`, `chapter.css` | всё остальное |
| M2 | `attention-demo.js`, `attention-demo.css`, `attention-demo.preview.html` | всё остальное |
| M3 | `steps-demo.js`, `steps-demo.css`, `steps-demo.preview.html` | всё остальное |
| M4 | `lab-demo.js`, `lab-demo.css`, `lab-demo.preview.html` | всё остальное |
| M5 | `index.html`, `index.css` | всё остальное |

| M6 | `shortcuts.js`, `shortcuts.css`, `shortcuts.preview.html` | всё остальное |

`tokens.css`, `shoot.py`, этот файл: только оркестратор.

## Ревизия R (после отзыва пользователя)

### Стиль
- Тёплая палитра и шрифты уже в `tokens.css`: фон «бумага», Literata (`--font-serif`) для H1–H3 и заголовков карточек/виджетов, Inter для текста, JetBrains Mono для кода. Более насыщенные цвета сущностей.

### Раскладка
- Все широкие блоки (демо, карточки шагов, лаб) **центрируются по оси страницы**, а не прижимаются к колонке текста. Ширина `min(var(--wide-width), 100vw - 48px)`. Колонка текста тоже на центральной оси; оглавление и заметки на полях живут по бокам и не сдвигают центр.

### Изоляция стилей
- Стили прозы главы (`h2`, `h3`, `p`, `ul`, `code` и т.д.) применяются только внутри `.prose` и не проникают в виджеты: виджеты стоят в `<figure class="fig-wide">`, а селекторы прозы исключают их (`.prose > p`, `:where(.prose) :not(figure *)` или аналог).
- Каждый виджет со своей стороны задаёт явные `margin`, `padding`, `font`, `list-style`, `background` для своих элементов и не полагается на стили страницы.

### Шорткаты
Общий модуль `shortcuts.js` + `shortcuts.css` (подключают `chapter.html` и `index.html`).
- `mod` = `⌘` на macOS, `Ctrl` на Windows/Linux. Платформа: `navigator.userAgentData?.platform ?? navigator.platform`.
- Любой `<kbd data-kbd="mod+k">` модуль сам перерисовывает в нужную нотацию (`⌘K` или `Ctrl K`).
- Модуль не знает о внутренностях страницы: действует через атрибуты.

| Клавиши | Действие | Цель (атрибут) |
|---|---|---|
| `mod+K`, `/` | поиск | фокус `[data-search]` |
| `?` | окно со списком шорткатов | своё модальное окно модуля, `Esc` закрывает |
| `T` | сменить тему | клик `[data-theme-toggle]` |
| `L` | открыть панель уровней | клик `[data-levels-toggle]` |
| `[` / `]` | предыдущая / следующая глава | `a[data-prev]` / `a[data-next]` |
| `J` / `K` | следующий / предыдущий раздел | скролл к следующему/предыдущему `section[id]` |
| `N` | заметка к выделению | клик `[data-note-btn]` |
| `M` | отметить пройденным | клик `[data-mark-done]` |
| `G` затем `H` | на главную | `a[data-home]` |
| `mod+Enter` | запустить лаб | обрабатывает `lab-demo.js` (в редакторе) |
| `mod+S` | сохранить черновик лаба | `lab-demo.js`, `preventDefault` |
| `mod+Shift+Backspace` | сбросить лаб к стартовому коду | `lab-demo.js`, с подтверждением |
| `Esc` | выйти из редактора / закрыть панель | все |

- Однобуквенные шорткаты не срабатывают при фокусе в `input`, `textarea`, `[contenteditable]`.
- На кнопках и в подсказках (`title`) показывается их шорткат.

## Скриншоты

`uv run --with playwright python docs/mockups/shoot.py <file.html>` из корня репозитория → `docs/mockups/shots/<file>-light.png` и `-dark.png`. Посмотри свои скриншоты (инструмент Read умеет читать PNG) и исправь явные дефекты до отчёта.
