# Волна V: вертикальный срез (DL Theory → dl/attention)

Цель среза: одна тема, одна глава, один лаб, оба слайдера, поиск, заметки, прогресс, деплой на Pages. Эталон вида: `docs/mockups/` (`chapter.html`, `index.html` и виджеты). Контракты: `src/lib/contracts/**` и `docs/CONTRACTS.md` — **не менять**; не хватает поля или типа: остановись и опиши в отчёте.

## Общие правила для всех пакетов

- Работай только в своём worktree (путь в задании), абсолютные пути. Сначала `npm ci`.
- Прочитай: `CLAUDE.md`, `docs/CONTRACTS.md`, свой раздел ниже, `docs/design-system.md` (для UI), нужные файлы `src/lib/contracts/*.ts` и заглушку своего компонента (её пропсы — контракт, сохраняй их).
- Владеешь только перечисленными файлами. Запрещено: `package.json`, lock-файлы, корневые конфиги (`vite.config.ts`, `tsconfig.json`, `eslint.config.js`, …), `src/routes/+layout.*`, `src/app.*`, `src/lib/contracts/**`, `docs/**`, `CLAUDE.md`, чужие компоненты. Нужна зависимость или правка конфига: опиши в отчёте, не делай.
- Svelte 5 (runes: `$props`, `$state`, `$derived`, `$effect`), TypeScript strict, импорты через `$lib/...`. Цвета только через токены (`var(--…)` или Tailwind-классы `bg-surface`, `text-muted`, …). Обе темы (`[data-theme='dark']` на `<html>`). `prefers-reduced-motion`.
- Тесты Vitest только на ключевую логику (`*.test.ts` рядом с модулем). Для IndexedDB есть `fake-indexeddb` (`import 'fake-indexeddb/auto'`).
- Критерий приёмки для всех: `npm run check` зелёный в твоём worktree. Плюс критерии пакета.
- Бюджет ~100k токенов; правило частичного результата из CLAUDE.md.
- Коммит: ровно сообщение из своего раздела, без Co-Authored-By и упоминаний агентов/ИИ/моделей.
- Отчёт по `tasks/REPORT-TEMPLATE.md`, до 200 слов.

---

## V1. mdsvex-конвейер — `feat(content): mdsvex pipeline plugins`

Владеешь: `src/lib/content/mdsvex/**`.
Сделай remark-плагины (mdsvex 0.12 использует старый unified/remark; проверь, что получает плагин, на реальном прогоне `mdsvex.compile`) и экспортируй их массивом из `src/lib/content/mdsvex/index.ts` (`remarkPlugins`, `rehypePlugins`), оркестратор подключит их в `vite.config.ts`:
1. **Формулы**: `$…$` и `$$…$$` → HTML KaTeX на этапе сборки (`katex.renderToString`, `throwOnError: false`, `trust: true` для `\htmlClass`). Результат вставляется как HTML-узел; **экранируй `{` `}`** (`&#123;` `&#125;`), иначе Svelte воспримет их как выражения. Display-формулы оборачивай в `<div class="math-display">`.
2. **Id блоков**: `{#block-id}` в конце абзаца/заголовка/пункта списка → атрибут `id` + `data-block` на элементе, маркер удаляется из текста. Для display-формулы: строка `{#id}` сразу после `$$` → id на `div.math-display`. Неверный формат id (не kebab-case) → ошибка сборки с понятным сообщением (файл, строка).
3. **Автоимпорт компонентов**: если в `.svx` встречаются `<Level`, `<Variant`, `<Term`, `<Ref`, `<DemoLink`, `<Figure`, `<Callout`, `<Aside`, `<StepCards`, `<Quiz`, `<Cite`, `<CodeLab`, `<AttentionDemo` — добавь в `<script>` импорты из `$lib/components/...` (существующий `<script>` дополнить, не дублировать).
Тесты: компиляция маленьких `.svx`-строк через `mdsvex.compile` с плагинами: формула с `{}`, id на абзаце/заголовке/формуле, ошибка неверного id, автоимпорт.

## V2. Реестры и проверка контента — `feat(content): registry generation and content checks`

Владеешь: `scripts/gen-registry.ts`, `scripts/check-content.ts`, `scripts/lib/**`, `src/lib/content/registry.ts`, тесты к ним.
- `gen-registry.ts` (запуск `node scripts/gen-registry.ts`, Node 24 исполняет TS): сканирует `content/*/topic.yaml`, `content/*/*/index.svx` (frontmatter через `yaml`), `labs/*/lab.yaml`, `data/glossary/*.yaml`, `data/aliases.yaml`; валидирует схемами контрактов; извлекает разделы (`## ` заголовки с `{#id}`) и id блоков; пишет `src/generated/*.json` по `GENERATED_FILES` (схемы из `registry.ts`), включая граф пререквизитов.
- `check-content.ts`: схемы; уникальность id глав/блоков; формат block id; пререквизиты существуют и без циклов; лабы из frontmatter существуют; правило уровней: `<Term id>` внутри слоя уровня N не ссылается на термин, определённый (`defined_in`/`level` в глоссарии) только на более глубоком уровне. Ошибки: `file:line: сообщение`, код выхода 1.
- `src/lib/content/registry.ts`: типизированный доступ к сгенерированным json (`getTopics`, `getChapter(id)`, `getChaptersByTopic`, `getLab(id)`, `getGlossary`, `getPrereqGraph`, `resolveChapterId` с алиасами).
Пока контента нет: сделай тестовые фикстуры в `scripts/__fixtures__/` (мини-дерево content/labs/data) и тесты на них. Скрипты принимают корень через аргумент `--root`.

## V3. Уровни — `feat(levels): level state, Level/Variant, LevelPopover`

Владеешь: `src/lib/levels/**`, `src/lib/components/Level.svelte`, `Variant.svelte`, `LevelPopover.svelte`.
- Стор уровней на runes: `applied` и `draft`, `apply()`, `dirty`; синхронизация с URL (`?c=&d=` через `levelsToQuery`/`levelsFromUrl`, `replaceState` из `$app/navigation`) и с сохранёнными настройками (принимает `ProgressStore`-подобный объект через параметр; без него localStorage-фолбэк в try/catch). Провайдер `LEVELS_CONTEXT` (функция `provideLevels()`).
- `Level`/`Variant`: всё рендерится при сборке (для поиска), видимость по `applied` через атрибут `hidden` + `data-level-*`; плавное появление (CSS, без анимации при reduced-motion). Бейдж «⚙ Железо» для `d≥3`. `Variant` группы: ровно один видим.
- `LevelPopover` как в макете (кнопка «Уровень: Основа · Идея ▾» в шапке, поповер со слайдерами, подписи положений, «Применить» появляется при `dirty`, `Esc`/клик вне закрывают, `data-levels-toggle` на кнопке).
Тесты: стор (apply/dirty/URL), видимость Variant-группы.

## V4a. Шапка, тема, оглавление — `feat(shell): header, theme, toc`

Владеешь: `src/lib/components/SiteHeader.svelte`, `ThemeToggle.svelte`, `Toc.svelte`, `src/lib/theme/theme.ts` (+ тест).
- Тема: `light|dark|system`, атрибут `data-theme` на `<html>`, сохранение (localStorage в try/catch), без мигания (экспортируй строку inline-скрипта `THEME_INIT_SCRIPT` для `app.html`, оркестратор вставит). Тема топика: `data-topic`.
- `SiteHeader` по макету `chapter.html`/`index.html`: логотип (`data-home`, ссылка на base `/`), крошки, слот/проп для поиска (рендерь `<SearchDialog />` из `$lib/components/SearchDialog.svelte` — его пишет V4c; до слияния создай у себя **не нужно**: используй `{#snippet}`-проп `search`), слот уровня (`levels` snippet), `ThemeToggle` (`data-theme-toggle`). Липкая, тонкая; полоса прогресса чтения цвета `--topic`.
- `Toc`: липкое оглавление, подсветка текущего раздела (IntersectionObserver).

## V4b. Шорткаты — `feat(shell): keyboard shortcuts`

Владеешь: `src/lib/shortcuts/**`, `src/lib/components/KbdHint.svelte`, `ShortcutsHelp.svelte`.
Порт `docs/mockups/shortcuts.js|css` на TS/Svelte: таблица из `docs/mockups/CONTRACT.md` («Шорткаты»), `formatKbd`, платформа, действия через атрибуты (`data-search`, `data-theme-toggle`, `data-levels-toggle`, `data-prev/next`, `data-note-btn`, `data-mark-done`, `data-home`, `J/K` по `section[id]`, `G H`), не в полях ввода, тост. `installShortcuts(): () => void` (возвращает uninstall). `ShortcutsHelp` — модальное окно по `?` с переключателем macOS/Windows. Тесты: `formatKbd`, игнор в input, последовательность G→H.

## V4c. Поиск — `feat(search): pagefind dialog`

Владеешь: `src/lib/search/**`, `src/lib/components/SearchDialog.svelte` (новый).
Модальный поиск по Pagefind: кнопка-поле в шапке (`data-search`, `KbdHint mod+k` — импортируй `KbdHint`, его пишет V4b; пропсы по контракту), диалог, ленивый `import(/* @vite-ignore */ \`${base}/pagefind/pagefind.js\`)`, debounce, результаты с заголовком, отрывком (подсветка `<mark>`), меткой уровня (`data-pagefind-filter`/meta — опиши в отчёте, какие атрибуты нужны на страницах), навигация стрелками, `Enter`, `Esc`. В dev, где индекса нет, — сообщение «Поиск доступен после сборки». Тест: debounce/форматирование результата.

## V5. Страница главы и проза — `feat(chapter): chapter route, prose, figure, callout, aside, cite`

Владеешь: `src/routes/[topic]/[slug]/**`, `src/lib/components/ChapterPage.svelte` (новый), `src/lib/styles/prose.css` (новый), `Figure.svelte`, `Callout.svelte`, `Aside.svelte`, `Cite.svelte`.
- Маршрут: `+page.ts` грузит главу `import.meta.glob('/content/*/*/index.svx')` по `params`, метаданные из `$lib/content/registry` (пишет V2; используй функции по описанию V2 — если файла ещё нет, импортируй напрямую `src/generated/chapters.json` через тот же модуль-обёртку, которую создашь у себя в `+page.ts`; оркестратор сведёт), `entries()` для prerender из списка глав.
- `ChapterPage`: раскладка из макета (центральная ось, колонка текста, `figure.fig-wide` симметрично по центру, оглавление слева, поле заметок справа — слот `margin`), заголовок, мета-строка, чипы пререквизитов, кнопка «Отметить пройденным» (`data-mark-done`, проп-колбэк), подвал (источники из frontmatter, пред/след глава `data-prev/next`). Провайдеры контекстов `CHAPTER_CONTEXT`, `HIGHLIGHT_CONTEXT` (+ зеркало `data-hl` на body), `DEMOS_CONTEXT`. Уровни: вызови `provideLevels()` из `$lib/levels` (V3) — если модуля ещё нет, импортируй и оставь; оркестратор сведёт.
- `prose.css`: стили прозы только внутри `.prose`, не проникают в `figure` (как в `docs/mockups/chapter.css`). KaTeX css импортируй в `prose.css` (`katex/dist/katex.min.css`).
- `Figure` (номер из контекста, подпись, «Что заметить», текстовая альтернатива в `<details>`, `id` → `data-figure-id`), `Callout`, `Aside`, `Cite` (номер источника, ссылка на список).

## V6. Инлайн-компоненты — `feat(chapter): term, ref, demo link, quiz`

Владеешь: `Term.svelte`, `Ref.svelte`, `DemoLink.svelte`, `Quiz.svelte`.
`Term`: подчёркнутый пунктиром термин, подсказка с определением из `CHAPTER_CONTEXT.glossary` (наведение и фокус, доступно с клавиатуры). `Ref`: слово с цветом сущности (`ENTITY_COLOR_VAR`), наведение ставит `HIGHLIGHT_CONTEXT.set(e)`. `DemoLink`: ссылка, `DEMOS_CONTEXT.set(demo, state)` + прокрутка к демо. `Quiz`: вопрос, «Показать ответ» (`children` — ответ), `kind="interview"` с бейджем «Собеседование», без оценок. Для тестов/превью сам создай контексты-заглушки в тесте.

## V7. Графики — `feat(charts): line, bar, heatmap, matrix diagram`

Владеешь: `src/lib/components/charts/**`, `src/lib/charts/**`.
Обёртки над D3 (scale, axis, shape) на токенах; SVG рисуется по реальной ширине контейнера (ResizeObserver), текст 12–13px при любой ширине; `title`/`desc` в `<svg>` (a11y); обе темы; Heatmap со шкалой `--seq-0 → --seq-1`, числа в ячейках с контрастным цветом; BarChart с вариантом «ожидаемые (пунктир) vs ваши» (как в лабе макета). Тесты: функции масштабов/цвета текста по яркости.

## V8. Демо внимания — `feat(demos): attention demo`

Владеешь: `src/lib/components/demos/AttentionDemo.svelte`, `src/lib/demos/attention.ts` (+ тест).
Порт `docs/mockups/attention-demo.*`: токены-чипы, дуги, тепловая карта (свой SVG, не зависеть от V7), переключатель масштаба, слайдер d, KaTeX-формула (`katex.render`), панель «три сильнейших ключа», подпись и текстовая альтернатива. Регистрируется в `DEMOS_CONTEXT` как `attention` (`set(patch)`), реагирует на `HIGHLIGHT_CONTEXT.hl`. Математика в `attention.ts` (seeded PRNG, softmax по строке, масштаб): тесты (строки суммируются в 1, без масштаба при большом d максимум > 0.9).

## V9. Пошаговые карточки — `feat(chapter): step cards`

Владеешь: `src/lib/components/StepCards.svelte`, `src/lib/components/steps/**`.
Порт `docs/mockups/steps-demo.*` как общий компонент: `steps` (заголовок, текст, формула TeX, какие элементы схемы подсвечены), схема матриц attention как вложенный компонент `steps/AttentionMatrices.svelte`, клавиши ←/→ при фокусе, точки, `onStep`.

## V10. Раннер лабов — `feat(labs): pyodide worker runner`

Владеешь: `src/lib/labs/**` (кроме UI).
`LabRunner` по контракту: Web Worker (`new Worker(new URL('./worker.ts', import.meta.url), {type:'module'})`), Pyodide из npm-пакета `pyodide` (indexURL с jsDelivr той же версии, что в `node_modules/pyodide/package.json`), загрузка numpy, без сети для кода пользователя (по возможности: отключить `pyodide.http`/`js.fetch` в пространстве пользователя), таймаут → `terminate()` + новый воркер, `LabResult` со статусом `timeout`. Python-харнесс `harness.py` (импорт `?raw`): выполняет код пользователя, затем тесты (функции `test_*`), ловит исключения, собирает `expected/actual/diff/location`, `metrics`/`series` из специальных хелперов (`report_series(name, xs, ys)`), stdout. Протокол сообщений — `WorkerRequest/WorkerResponse` из контрактов. Тесты Vitest: логика таймаута и сборки `LabResult` с мок-воркером (сам Pyodide в тестах не грузить).

## V11. UI лаба — `feat(labs): code lab and result panel`

Владеешь: `src/lib/components/CodeLab.svelte`, `LabResultPanel.svelte`, `src/lib/components/lab/**`.
Порт `docs/mockups/lab-demo.*`: CodeMirror 6 (`@codemirror/lang-python`, тема на токенах обеих тем), шапка, «Сбросить», «▶ Запустить», `KbdHint` (пишет V4b; пропсы по контракту), шорткаты `mod+Enter`, `mod+S`, `mod+Shift+Backspace` (с подтверждением), `Esc`; черновик (через проп/колбэк `ProgressStore`-подобного объекта, по контракту; предупреждение при изменённом `starterHash`); строка статуса. Раннер — через проп `runner?: LabRunner`; по умолчанию ленивый импорт `$lib/labs` (V10). `LabResultPanel`: сводка, список тестов, раскрытый первый упавший с таблицей ожидалось/получено и местом, график (простой SVG внутри панели, не зависеть от V7), время. Изоляция стилей от прозы.

## V12. Лаб `dl-attention-numpy` — `content(labs): attention numpy lab`

Владеешь: `labs/dl-attention-numpy/**`, `scripts/lab_check.py`, `tests/labs/test_lab_check.py`.
По `docs/CONTENT-GUIDE.md`, `.claude/skills/new-lab/SKILL.md` и схеме `Lab` (`src/lib/contracts/lab.ts`): `lab.yaml`, `starter.py` (функция `attention(Q, K, V, mask=None)` с TODO на масштаб и маску), `solution.py`, `tests_visible.py`, `tests_hidden.py` (форма, строки весов = 1, масштаб, маска, численная устойчивость), визуализатор весов. `scripts/lab_check.py` (`uv run python scripts/lab_check.py [lab-id]`): эталон проходит все тесты, стартовый код падает хотя бы на одном; код выхода. Критерии: `uv run ruff check .`, `uv run pytest tests/labs`, `uv run python scripts/lab_check.py`.

## V13. Прогресс — `feat(progress): indexeddb progress store`

Владеешь: `src/lib/progress/**`.
`ProgressStore` по контракту на `idb`: главы (посещена, разделы, позиция, отмечена пройденной), лабы (пройден, черновик + `starterHash`), настройки (уровни, тема); `subscribe`; миграции по `schemaVersion`; `readOnly` при более новой схеме; экспорт/импорт JSON (`merge|replace`). Хелпер `trackChapter(id)` (IntersectionObserver по `section[id]`, дебаунс записи позиции). Тесты на `fake-indexeddb`: CRUD, миграция, экспорт→импорт.

## V14. Заметки: логика — `feat(notes): anchors and notes store`

Владеешь: `src/lib/notes/**` (без UI-компонентов).
`anchorFromSelection` (Selection → `NoteAnchor`: ближайший `[data-block]`, `exact`, `prefix`/`suffix` по 32 символа, `figureId` для выделения внутри `[data-figure-id]`), `resolveAnchor` (в своём блоке → `found`; иначе поиск по цитате с контекстом во всей главе → `shifted`; не нашли → `orphaned`), подсветка диапазона (`Range` → `<mark class="note-hl">` без поломки DOM, снятие). `NotesStore` на `idb` (ulid, CRUD, `listByChapter`, `subscribe`) + экспорт в формат файлов `user-data/notes/<topic>/<chapter>/<ulid>.json`. Тесты (jsdom): якорь и переякоривание при изменённом тексте, orphaned, store.

## V15. Заметки: UI — `feat(notes): margin notes UI`

Владеешь: `src/lib/components/MarginNote.svelte`, `SelectionNoteButton.svelte`, `src/lib/components/notes/**`.
По макету: плавающая кнопка «💬 Заметка» над выделением (`data-note-btn`), редактор заметки (текст, теги, статус), карточка на полях напротив блока, состояния `found/shifted/orphaned` (осиротевшие — список внизу поля с пометкой), «показать слой», если блок скрыт текущим уровнем. Логику якорей и хранилище бери из `$lib/notes` (V14) только через типы контрактов; связку делает `NotesLayer.svelte` (твой, в `components/notes/`) с пропом `store: NotesStore`.

## V16. Главная — `feat(home): home page`

Владеешь: `src/routes/+page.svelte`, `src/routes/+page.ts`, `TopicCard.svelte`, `TopicTabs.svelte`, `ContinueCard.svelte`, `PrereqGraph.svelte`.
Порт `docs/mockups/index.*`: герой (серифный H1, SVG-иллюстрация), «Продолжить» (из `ProgressStore` — через проп/загрузку на клиенте; если прогресса нет, карточку не показывать), сетка топиков, вкладки карты, граф пререквизитов (раскладка по слоям: топологическая сортировка → колонки, рёбра-кривые со стрелками), клавиши 1–5. Данные — из `$lib/content/registry` (V2).

## V17. Контент главы — `content(dl/attention): scaled dot-product attention`

Владеешь: `content/**`, `data/**`.
- `content/<topic>/topic.yaml` для всех 5 топиков (`dl`, `classic-ml`, `mlops`, `cs`, `compute`) по схеме `Topic`.
- `content/dl/attention/index.svx`: по `docs/CONTENT-GUIDE.md` и тексту `docs/mockups/chapter.html` (возьми его за основу и улучши): frontmatter по `ChapterFrontmatter` (prereqs пустые — других глав пока нет; `labs: [dl-attention-numpy]`), скелет разделов с `{#id}`, уровни (`Variant c="1"` / `c="2-4"`, `Level c={3}` вывод дисперсии, `Level d={2}` реализация в NumPy, `Level d={3}` FlashAttention с источником), `<AttentionDemo />` в `Figure`, `<StepCards steps={...}/>` в `Figure`, `<CodeLab lab="dl-attention-numpy" />`, `Callout warn`, `Aside`, `Quiz`, `Term`, `Ref e="q|k|v"`, `DemoLink demo="attention" state={{scaled:false}}`, `Cite`. Компоненты импортируются автоматически (V1), `<script>` с импортами не нужен.
- `data/glossary/dl.yaml`: термины главы (attention, softmax, query, key, value, scaled dot-product, causal mask, FlashAttention, HBM, SRAM) с уровнем определения.
- Факты (FlashAttention, иерархия памяти) — только с источниками в `sources`.
Критерий: frontmatter, `topic.yaml` и глоссарий валидируются схемами (напиши разовый скрипт в scratchpad или тест в `content/content.test.ts` — владеешь им — который парсит файлы и проверяет схемами).

## D1. Синхронизация документов — `docs: align architecture and content guide with contracts`

Владеешь: `docs/ARCHITECTURE.md` (разделы 5.1–5.5), `docs/CONTENT-GUIDE.md` (§3 и примеры разметки).
Приведи к `docs/CONTRACTS.md` («Отличия от ARCHITECTURE») и к реальным схемам `src/lib/contracts/*.ts`. Синтаксис `{#id}` после `$$` (отдельной строкой), `Quiz kind`, `Cite`. `npm ci` не нужен; критерий — сверка таблиц полей со схемами.
