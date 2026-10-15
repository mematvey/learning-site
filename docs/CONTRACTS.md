# Контракты

Справочник по `src/lib/contracts/`. Код там главный; этот файл только карта. Схемы Zod 4, типы выводятся из них (`z.infer`). Всё экспортируется из `src/lib/contracts/index.ts`.

Источник содержания: `docs/ARCHITECTURE.md` разделы 3–8. Где они расходятся с пакетом C1, действует пакет (см. «Отличия от ARCHITECTURE»).

## Правила изменения

- Контракты меняет только architect или оркестратор. Исполнители читают их и не правят.
- Любое изменение формата данных: поднять версию (`*_SCHEMA_VERSION`), добавить миграцию `vN -> vN+1` (`Migration` в `interfaces.ts`) и тест на фикстуре.
- Фикстуры в `src/lib/contracts/fixtures/` обновляются вместе со схемой; `contracts.test.ts` должен остаться зелёным.
- Добавление необязательного поля версию не поднимает. Удаление, переименование, ужесточение: поднимает.
- Регистр ключей: файлы, которые пишет автор или Python (frontmatter, `topic.yaml`, `lab.yaml`, `LabResult`, бенчмарки), в `snake_case`. Записи, которые пишет браузер (заметки, прогресс, настройки, экспорт), в `camelCase`.

## Схемы данных

| Сущность | Файл | Где живёт | Версия |
|---|---|---|---|
| `TopicId`, `ChapterId`, `LabId`, `BlockId`, `TermId`, `Ulid`, `IsoDateTime` | `ids.ts` | везде | нет |
| Уровни: оси, диапазоны, URL | `levels.ts` | `?c=&d=`, `Level`, `Variant` | нет |
| `Topic` | `topic.ts` | `content/<topic>/topic.yaml` | `CONTENT_SCHEMA_VERSION` |
| `ChapterFrontmatter`, `Source`, `Concept` | `chapter.ts` | frontmatter `index.svx` | `CONTENT_SCHEMA_VERSION` |
| `GlossaryEntry`, `GlossaryFile` | `glossary.ts` | `data/glossary/*.yaml` (список записей) | `CONTENT_SCHEMA_VERSION` |
| `AliasesFile`, `resolveAlias` | `aliases.ts` | `data/aliases.yaml` (`старый: новый`) | нет |
| `Lab`, `LabVisualizer` | `lab.ts` | `labs/<lab-id>/lab.yaml` | `CONTENT_SCHEMA_VERSION` |
| `LabResult`, `TestResult`, `LabResultSummary` | `lab-result.ts` | Worker, импорт из Colab/Kaggle | `LAB_RESULT_SCHEMA_VERSION` |
| `Note`, `NoteAnchor` | `notes.ts` | IndexedDB, `user-data/notes/**` | `NOTE_SCHEMA_VERSION` |
| `ChapterProgress`, `LabProgress`, `Settings`, `ProgressExport` | `progress.ts` | IndexedDB, `user-data/progress/**`, экспорт JSON | `PROGRESS_SCHEMA_VERSION` |
| `Benchmark` | `benchmarks.ts` | `data/benchmarks/*.json` | `BENCHMARK_SCHEMA_VERSION` |
| Реестры: `TopicsRegistry`, `ChaptersRegistry`, `LabsRegistry`, `GlossaryRegistry`, `PrereqGraphData`, `AliasesRegistry` | `registry.ts` | `src/generated/*.json` (имена в `GENERATED_FILES`) | пересоздаются при сборке |

Что проверяют схемы сверх типов: `id` главы начинается с `<topic>/`; у лаба поля зависят от `runtime`; `LabResult` со статусом `error`/`timeout` требует `error`, `pass` не допускает упавших тестов, длина `data` равна произведению `shape`; бенчмарку нужны `series` или `table`.

## Уровни (`levels.ts`)

- Оси: `c` 1–4 (Интуиция, Основа, Формально, Исследователь), `d` 1–3 (Идея, Реализация, Железо). По умолчанию `{c: 2, d: 1}`.
- `parseRange("2-4", "c")` даёт `{min, max}` или `null`; `formatRange` обратная; `inRange(range, n)`.
- `isLevelVisible({c, d}, state)` видимость аддитивного слоя (И по осям). `coversAxis(ranges, axis)` проверка группы `Variant`.
- `levelsFromUrl(query | URLSearchParams | URL)` возвращает только корректные оси; `levelsToQuery(state)` даёт `c=2&d=3`; `resolveLevels(url, saved)` порядок URL, прогресс, умолчание.

## Интерфейсы модулей (`interfaces.ts`)

| Интерфейс | Назначение |
|---|---|
| `ProgressStore` | чтение, `update(patch)`, `list`, `export`/`import(mode)`, `subscribe`, флаг `readOnly` для более новой схемы |
| `Migration` | шаг миграции `from -> to` над неизвестной записью |
| `NotesStore` | CRUD заметок, `listByChapter`, `subscribe` |
| `SyncAdapter` | токен, `sync()` (pull, затем push), статус; без токена `disabled` |
| `LabRunner` | `run(bundle, code, opts) -> Promise<LabResult>`, `terminate()`; ошибки кода пользователя это `LabResult`, не исключения |
| `WorkerRequest` / `WorkerResponse` | Zod-схемы сообщений Worker: `init`, `run` / `ready`, `stage`, `stdout`, `result`, `fatal` |
| `AnchorFromSelection`, `ResolveAnchor` | якорь по выделению; разрешение `found` / `shifted` / `orphaned` (поведение в JSDoc) |

## Контексты Svelte (`context.ts`)

| Ключ | Тип | Кто задаёт |
|---|---|---|
| `LEVELS_CONTEXT` | `LevelsContext` (`applied`, `draft`, `setDraft`, `apply`, `dirty`) | страница главы |
| `HIGHLIGHT_CONTEXT` | `HighlightContext` (`hl`, `set`); зеркалится в `data-hl` на `<body>` | страница главы |
| `DEMOS_CONTEXT` | `DemosContext` (`register(name, handle)`, `set(name, patch)`) | страница главы; демо регистрируются сами |
| `CHAPTER_CONTEXT` | `ChapterContext` (`id`, `topic`, `sources`, `glossary`, `figureNumber`) | страница главы |

Сущности: `q`, `k`, `v`, `e4`–`e6`; цвета `--cat-1..6` (`ENTITY_COLOR_VAR`). Состояние демо внимания: `AttentionDemoState {scaled, query, d}`.

## Компоненты

Пропсы описаны в `src/lib/contracts/component-props.ts`, заглушки в `src/lib/components/**` (`<div data-stub="Name">`). Колбэки это пропсы `onXxx`.

| Компонент | Файл | Ключевые пропсы |
|---|---|---|
| `Level` | `components/Level.svelte` | `c?`, `d?`, `children` |
| `Variant` | `components/Variant.svelte` | `c?: "n" \| "a-b"`, `d?`, `group?` |
| `Term` | `components/Term.svelte` | `id` |
| `Ref` | `components/Ref.svelte` | `e: EntityId` |
| `DemoLink` | `components/DemoLink.svelte` | `demo`, `state` |
| `Figure` | `components/Figure.svelte` | `id`, `alt`, `caption`, `notice?`, `wide?` |
| `Callout` | `components/Callout.svelte` | `kind: warn \| note \| tip`, `title?` |
| `Aside` | `components/Aside.svelte` | `title`, `open?` |
| `StepCards` | `components/StepCards.svelte` | `steps`, `demo?`, `initial?`, `onStep?` |
| `Quiz` | `components/Quiz.svelte` | `id`, `q`, `kind?: self \| interview`, `level?` |
| `Cite` | `components/Cite.svelte` | `id` |
| `CodeLab` | `components/CodeLab.svelte` | `lab`, `mode?`, `onResult?`, `progress?`, `runner?` |
| `LabResultPanel` | `components/LabResultPanel.svelte` | `result: LabResult`, `visualizers?` |
| `LevelPopover` | `components/LevelPopover.svelte` | `applied`, `onApply`, `open?` |
| `TopicCard` | `components/TopicCard.svelte` | `topic`, `title`, `description`, `chapterCount`, `chapters`, `progress`, `mapHref` |
| `TopicTabs` | `components/TopicTabs.svelte` | `topics`, `active`, `onSelect` |
| `ContinueCard` | `components/ContinueCard.svelte` | `topic`, `chapterId`, `title`, `progress`, `lab?`, `href` |
| `PrereqGraph` | `components/PrereqGraph.svelte` | `graph`, `focus?`, `topic?`, `done?`, `onSelect?` |
| `MarginNote` | `components/MarginNote.svelte` | `note`, `resolution`, `layerHidden?`, `onSelect?`, `onShowLayer?`, `onDelete?` |
| `SelectionNoteButton` | `components/SelectionNoteButton.svelte` | `rect \| null`, `onClick` |
| `KbdHint` | `components/KbdHint.svelte` | `keys` (`mod+k`) |
| `ShortcutsHelp` | `components/ShortcutsHelp.svelte` | `open`, `onClose` |
| `ThemeToggle` | `components/ThemeToggle.svelte` | `theme`, `onToggle` |
| `SiteHeader` | `components/SiteHeader.svelte` | `topic?`, `crumbs?`, `theme`, `onToggleTheme`, `levels?`, `search?` |
| `Toc` | `components/Toc.svelte` | `items`, `activeId?` |
| `LineChart` | `components/charts/LineChart.svelte` | `title`, `desc`, `series`, `xLabel`, `yLabel` |
| `BarChart` | `components/charts/BarChart.svelte` | `title`, `desc`, `bars`, `orientation?` |
| `Heatmap` | `components/charts/Heatmap.svelte` | `title`, `desc`, `matrix`, `showValues?`, `domain?` |
| `MatrixDiagram` | `components/charts/MatrixDiagram.svelte` | `title`, `desc`, `matrices`, `highlight?` |
| `AttentionDemo` | `components/demos/AttentionDemo.svelte` | `initial?: Partial<AttentionDemoState>` |

## Отличия от ARCHITECTURE

| Место | ARCHITECTURE | Контракт |
|---|---|---|
| `status` главы | `draft \| review \| ready` | `draft \| review \| published` |
| `runtime` лаба | `python \| js` | `pyodide \| js \| simulator \| external-notebook` |
| Статусы `LabResult` и тестов | `passed \| failed` | `pass \| fail` (+ `error`, `timeout`, `skipped`) |
| `sources` | `{title, url, note?, accessed}` | с обязательными `id`, `kind` (для `Cite`), `accessed` необязателен в схеме (требует линтер для чисел) |
| `concepts` | в гиде список id, в ARCH объекты | объекты `{id, title}` |
| Ключи заметок и прогресса | `snake_case` | `camelCase`, `schemaVersion` |
| Якорь заметки | `block_id`, `selector.exact` | плоский `blockId`, `exact`, `prefix`, `suffix` |

Оркестратору: привести ARCHITECTURE 5.1–5.5 и CONTENT-GUIDE §3 к этим значениям.

## Проверка

`npm run check` (svelte-check, ESLint, Prettier, Vitest). Тест контрактов: `npx vitest run src/lib/contracts`.
