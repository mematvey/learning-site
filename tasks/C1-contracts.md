# C1. Контракты

- Дорожка: platform. Роль: architect (Sonnet, effort medium).
- Зависит от: C0 (каркас) слит в main.

## Цель

Зафиксировать интерфейсы до параллельной работы: Zod-схемы данных, TypeScript-интерфейсы модулей, API Svelte-компонентов (заглушки), форматы файлов. Субагенты Haiku будут писать код против этих контрактов, не видя друг друга, поэтому контракты должны быть однозначными и самодостаточными.

## Контекст

Прочитать: `CLAUDE.md`, `docs/ARCHITECTURE.md` (главный источник: разделы 3–8), `docs/CONTENT-GUIDE.md`, `docs/design-system.md` (раздел «Компоненты»), `docs/DECISIONS.md`, `docs/mockups/CONTRACT.md`. Вид и поведение: `docs/mockups/*.html|js`.

Решения оркестратора по открытым вопросам ARCHITECTURE/CONTENT-GUIDE (принять как данность):
- Лабы в корне: `labs/<lab-id>/`.
- Принять: `content/<topic>/topic.yaml`, `data/aliases.yaml`, `data/glossary/*.yaml`, `data/benchmarks/*.json`, поле `status` во frontmatter (`draft | review | published`).
- `{#block-id}` ставится в конце строки абзаца/заголовка/пункта списка; для display-формулы `$$…$$` — на следующей строке сразу после закрывающих `$$` отдельной строкой `{#id}`. Для рисунков проп `id`.
- Компоненты в `.svx`: `Level`, `Variant`, `Term`, `Ref`, `DemoLink`, `Figure`, `Callout`, `Aside`, `StepCards`, `Quiz` (`kind="self" | "interview"`), `Cite`, `CodeLab`.
- Генерируемые файлы в `src/generated/` (в .gitignore).

## Что создать (владеемые файлы)

1. `src/lib/contracts/` — Zod-схемы + выведенные типы, по файлу на сущность, с `index.ts`:
   - `ids.ts`: `TopicId`, `ChapterId` (`<topic>/<slug>`), `LabId`, `BlockId` (kebab-case) — regex-схемы.
   - `levels.ts`: оси, диапазоны (c 1–4, d 1–3), подписи положений (рус.), `LevelState`, парсинг/сериализация диапазонов `"2-4"`, `"1"`, функции-сигнатуры (без реализации допустимо, но лучше маленькие чистые реализации: `parseRange`, `inRange`, `levelsFromUrl`, `levelsToQuery`).
   - `topic.ts` (`topic.yaml`), `chapter.ts` (frontmatter), `glossary.ts`, `aliases.ts`, `registry.ts` (формат сгенерированных реестров: topics, chapters, labs, glossary, prereq graph).
   - `lab.ts` (`lab.yaml`, runtimes `pyodide | js | simulator | external-notebook`), `lab-result.ts` (`LabResult`, тесты, diff, metrics, series, arrays, duration, stdout/stderr, статус `pass | fail | error | timeout`).
   - `notes.ts` (якорь в духе W3C: `blockId`, `exact`, `prefix`, `suffix`, `figureId?`, `element?`; заметка; статус `open | answered`; ulid; `schemaVersion`).
   - `progress.ts` (прогресс по главам/лабам, черновики с `starterHash`, уровни, `schemaVersion`, экспорт-формат JSON).
   - `benchmarks.ts`.
2. `src/lib/contracts/interfaces.ts` — интерфейсы модулей (без реализации):
   - `ProgressStore` (get/set/subscribe, экспорт/импорт, миграции), `NotesStore`, `SyncAdapter`;
   - `LabRunner` (`run(lab, code, opts{timeoutMs}) → Promise<LabResult>`, `terminate()`), протокол сообщений Web Worker (`WorkerRequest`/`WorkerResponse` как Zod-схемы);
   - `anchorFromSelection`, `resolveAnchor` (сигнатуры + описание поведения в JSDoc: найден / сдвинут / осиротел).
3. Заглушки Svelte-компонентов в `src/lib/components/**` с точными пропсами (Svelte 5 `$props()` с типами), JSDoc-комментарием назначения и минимальной разметкой-заглушкой (`<div data-stub="Name">`), чтобы всё компилировалось: всё из списка выше плюс `LevelPopover`, `TopicCard`, `TopicTabs`, `ContinueCard`, `PrereqGraph`, `MarginNote`, `SelectionNoteButton`, `KbdHint`, `ShortcutsHelp`, `ThemeToggle`, `SiteHeader`, `Toc`, `LabResultPanel`, `charts/{LineChart,BarChart,Heatmap,MatrixDiagram}` и демо `demos/AttentionDemo`. События/колбэки, контексты (`setContext` ключи для уровней, подсветки сущностей `hl`, демо-состояний) описать в `src/lib/contracts/context.ts`.
4. Фикстуры-примеры, валидируемые схемами: `src/lib/contracts/fixtures/` — frontmatter `dl/attention`, `topic.yaml` для `dl`, `lab.yaml` для `dl-attention-numpy`, `LabResult` (2 из 4), заметка, прогресс.
5. `src/lib/contracts/contracts.test.ts` — Vitest: все фикстуры проходят схемы; 3–5 негативных примеров (неверный id, неверный диапазон уровня) отклоняются; `parseRange`/`inRange`/URL-функции.
6. `docs/CONTRACTS.md` — короткий справочник (≤ 200 строк): где какая схема, правила изменения контрактов (меняет только architect/оркестратор, версия схемы + миграция), таблица компонентов → файл → ключевые пропсы.

## Запрещено

`package.json` и lock-файлы (если не хватает зависимости — остановиться и написать в отчёте), конфиги в корне, `src/routes/**`, `docs/*` кроме `docs/CONTRACTS.md`, `CLAUDE.md`.

## Критерии приёмки

- `npm run check` зелёный (svelte-check, eslint, prettier, vitest).
- `npm run build` проходит.
- В компонентах-заглушках нет логики, только типы пропсов и разметка-заглушка.

## Бюджет

~140k токенов. Если не укладываешься: приоритет 1, 2, 4, 5, затем 3, затем 6; верни partial.

## Коммит

Сообщение ровно: `feat(contracts): data schemas, module interfaces, component stubs`. Без Co-Authored-By и упоминаний агентов/ИИ/моделей.
