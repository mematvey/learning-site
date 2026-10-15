# I1. Интеграция вертикального среза

- Дорожка: platform. Роль: интеграция (Sonnet, effort medium). Пакет последовательный: владеет общими файлами.
- Состояние: все пакеты V1–V17 слиты в main, `npm run check` зелёный (173 теста), `npm run build` падает: mdsvex-плагины не подключены.

## Цель

Собрать срез в работающий сайт: `npm run build` проходит, `npm run preview` показывает главную и главу `dl/attention` со всеми механизмами (уровни с «Применить», демо, шаги, лаб с запуском Pyodide, заметки, прогресс, поиск, шорткаты, тема). Код фич не переписывать: только подключение, стыки и мелкие правки несовпадений. Если стык требует существенной переделки модуля, опиши в отчёте (оркестратор выдаст отдельный пакет).

## Контекст

`CLAUDE.md`, `docs/CONTRACTS.md`, `docs/ARCHITECTURE.md` (3, 4), `tasks/slice-wave.md` (что делал каждый пакет). Эталон вида: `docs/mockups/chapter.html`, `index.html`.

## Известные стыки (из отчётов пакетов)

1. `vite.config.ts`: подключить `remarkPlugins`/`rehypePlugins` из `src/lib/content/mdsvex/index.ts`; `server.fs.allow` для `content/`, `labs/`, `data/`; vitest `include` дополнить `content/**/*.test.ts`, `scripts/**/*.test.ts`.
2. `package.json` скрипты: `gen` (`node scripts/gen-registry.ts`), `check:content` (`node scripts/check-content.ts`), `predev`/`prebuild`/`pretest` (или в начале `check`) — генерация реестров; `check` включает `check:content`; `lab:check` (`uv run python scripts/lab_check.py`). Проверь, что `src/generated/` создаётся до svelte-check/vitest/сборки (в т.ч. в CI `.github/workflows/deploy.yml`: добавить шаги `uv run pytest`, `uv run python scripts/lab_check.py`).
3. `src/app.html`: inline-скрипт `THEME_INIT_SCRIPT` из `src/lib/theme/theme.ts` (без мигания темы).
4. `src/routes/+layout.svelte`: `SiteHeader` (V4a) с `SearchDialog` (V4c, проп/сниппет `search`), `ThemeToggle` с сохранением темы через `$lib/theme`, `installShortcuts` (V4b) + `<ShortcutsHelp>`; `/` и mod+K должны открывать диалог поиска (click по `[data-search]`). На странице главы в шапке `LevelPopover` (V3) и крошки, `data-topic` на `<html>`. Реши, где живёт шапка (layout или ChapterPage), чтобы не было двух шапок; ChapterPage (V5) сейчас переключает тему локально — убери дублирование.
5. Страница главы (`src/routes/[topic]/[slug]`, `ChapterPage`): перейти на `$lib/content/registry` (V2) вместо прямого glob по `src/generated`; `provideLevels()` с сохранением в `ProgressStore`; `trackChapter` (V13); кнопка «Отметить пройденным» → прогресс; `NotesLayer` (V15) со `createNotesStore` (V14), `anchorFromSelection`, `resolveAnchor`, подсветкой; `data-pagefind-filter="level:…"`/`data-pagefind-body` по требованиям V4c; `data-demo="attention"` на контейнере демо для прокрутки `DemoLink`; `Toc` с `activeId`.
6. `CodeLab` (V11) ↔ раннер (V10): экспорт `labRunner` из `$lib/labs`; прогресс/черновики через `ProgressStore`; харнесс V10 и тесты лаба V12 (`report_array`, `assert_close`) — сверить имена хелперов, при расхождении поправить тесты лаба или харнесс так, чтобы эталон проходил в браузере. Лаб грузится через glob `labs/*/` (проверь `?raw` для `.py` и `lab.yaml`).
7. Главная (V16): `openProgressStore()` — привести к фактическому API `$lib/progress` (V13); реестры через `$lib/content/registry`; ссылки на главы через типизированный маршрут.
8. Контракты: добавь в `src/lib/contracts/component-props.ts` аддитивные пропсы, которые пакеты ввели локально (`CodeLabProps.progress?`, `CodeLabProps.runner?`, `SiteHeaderProps.search?`, `BarChartProps` — `expected?` не добавлять сейчас); селектор блока в JSDoc `AnchorFromSelection` — `[data-block]`; обнови `docs/CONTRACTS.md` таблицу.
9. Контент: `content/dl/attention/index.svx` должен собираться (V17 писал до пайплайна V1): исправь разметку под фактический пайплайн (например, `{#id}` внутри HTML-тегов не обрабатывается в markdown-узлах — переписать абзац markdown-ом или поставить `id` атрибутом). `npm run check:content` зелёный на реальном контенте.
10. `svelte-check` 9 предупреждений — посмотри, убери то, что тривиально.

## Владеемые файлы

Всё перечисленное выше, включая корневые конфиги, `package.json`/lock, `src/app.html`, `src/routes/**`, `.github/workflows/**`, `src/lib/contracts/component-props.ts`, `docs/CONTRACTS.md`, точечные правки в модулях на стыках. Не трогать `CLAUDE.md`, `docs/*` кроме CONTRACTS.md, `docs/mockups/**`.

## Критерии приёмки (выполнить и приложить результат)

- `npm run check` зелёный; `uv run ruff check .`; `uv run pytest -q`; `uv run python scripts/lab_check.py`.
- `npm run build` проходит (с `BASE_PATH=/learning-site` тоже); Pagefind индексирует главу.
- `npm run preview` + короткий Playwright-скрипт (в scratchpad, `uv run --with playwright python ...` или `npx playwright` если браузеры есть): главная и `/dl/attention/` открываются без ошибок в консоли; после смены уровня и «Применить» видимый текст меняется; кнопка «Запустить» в лабе возвращает результат (Pyodide грузится с CDN — дождись до 120 с); скриншоты обеих тем главной и главы сохранить в `test-results/integration/` и посмотреть их инструментом Read, явные поломки вёрстки исправить.

## Бюджет

~150k токенов. Не укладываешься: приоритет 1–3, 9, 5, 4, 6, 7, 8, 10; верни partial с точным списком несделанного.

## Коммит

Можно несколькими коммитами, сообщения в стиле `feat(integration): …` / `fix(integration): …`. Без Co-Authored-By и упоминаний агентов/ИИ/моделей.
