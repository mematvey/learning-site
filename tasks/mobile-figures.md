# Пакет: mobile-figures

## id

`mobile-figures` (ветка `task/mobile-figures`, worktree `.worktrees/mobile-figures`).

## Дорожка

`platform` (компоненты `charts/*`), плюс точечные правки подписей в трёх главах DL.

## Роль и модель

- Роль: `component-dev`.
- Модель: `haiku`.
- Effort: `medium`.

## Цель

На ширине 375 px рисунки `MatrixEquation` читаются (значения в ячейках не мельче 11 px), страницы `dl/attention`, `dl/multi-head-attention`, `dl/layer-norm` не получают горизонтальной прокрутки (в том числе при раскрытии «Данные графика»), подписи осей графиков не накладываются. На 1280 px вид не ухудшается.

## Контекст и ссылки

- Читать: `CLAUDE.md`, `docs/design-system.md` (правила вёрстки, минимальный размер текста), `tasks/matrix-equation.md` (контракт `MatrixEquation`), `src/lib/components/charts/MatrixEquation.svelte`, `src/lib/charts/matrixEquation.ts`, `ChartFrame.svelte`, `BarChart.svelte`, `LineChart.svelte`.
- Результаты визуальной проверки (скриншоты на 375 и 1280 px, обе темы): `C:\Users\memel\AppData\Local\Temp\claude\c--Users-memel-repos-learning-site\8d54ca7b-e130-4c84-8594-8718fc6f8581\scratchpad\shots\` (Git Bash: `/c/Users/memel/AppData/Local/Temp/claude/c--Users-memel-repos-learning-site/8d54ca7b-e130-4c84-8594-8718fc6f8581/scratchpad/shots/`). Имена: `svg_mha_*_375_2.png`, `svg_layernorm_light_375_2.png`, `attention_light_375_full.png`, `svg_attention_light_375_2.png`, `svg_attention_light_375_3.png`, `stat_layernorm_разброс_dark_375.png`, `mha_light_1280_fig3.png`, `svg_mha_light_1280_2.png`, `stat_attention_дисперсия_light_375.png`.

## Находки, которые нужно исправить

1. **Блокер, `dl/multi-head-attention`, «Шаг 3», 375 px:** значения в ячейках 4,48 px.
2. **Блокер, `dl/layer-norm`, «Масштаб и сдвиг», 375 px:** 6,16 px, числа слипаются.
3. **Блокер, `dl/attention`, 375 px, обе темы:** горизонтальная прокрутка страницы, `scrollWidth` 489. Источник не найден. Найти элемент, который выходит за 375 px (в Playwright: перебрать элементы с `getBoundingClientRect().right > 375`), исправить причину (не прятать через `overflow-x: hidden` на `body`, это маскирует проблему).
4. **Важно, `dl/multi-head-attention` (425 px) и `dl/layer-norm` (437 px), 375 px:** при раскрытии «Данные графика» таблица даёт горизонтальную прокрутку страницы. Таблица должна прокручиваться внутри своего контейнера (`overflow-x: auto`).
5. **Важно, `dl/attention`, «Softmax по строкам» и «O = AV», 375 px:** 9 px, трёхзначные числа слипаются.
6. **Важно, `dl/layer-norm`, BarChart «Разброс строк до и после LayerNorm», 375 px:** подписи осей накладываются (укоротить подписи столбцов в разметке главы и/или поворачивать, переносить подписи в `BarChart`).
7. **Мелочь, `dl/multi-head-attention`, «Шаг 2»:** оператор `|` читается как черта (заменить на явный знак конкатенации, например `‖` или слово «склейка» в `text`).
8. **Мелочь, 1280 px:** знаки `softmax` и `÷ √2, softmax` касаются соседних матриц (добавить отступы по обе стороны оператора по ширине текста).
9. **Мелочь, LineChart «Дисперсия q·k», 375 px:** линии «эмп.» и «y = d» почти совпадают (разный стиль штриха или маркеры у эмпирической серии; не менять данные).

## Подход к находкам 1, 2, 5

Размер ячейки в SVG не должен падать ниже порога читаемости (значения не мельче 11 px при отображении). Если цепочка матриц не помещается по ширине, переносить её на несколько строк: после знака операции начинается новая строка (первая матрица новой строки отступает вправо под знак), либо внутри `ChartFrame` включать горизонтальную прокрутку самого рисунка (не страницы) с видимой подсказкой. Предпочтительный вариант: перенос на строки (`layoutItems` возвращает несколько рядов). Обновить тесты `matrixEquation.test.ts` (раскладка по рядам, порог размера). Не менять публичный контракт `MatrixEquationProps`.

## Владеемые файлы

Абсолютный путь worktree: `C:\Users\memel\repos\learning-site\.worktrees\mobile-figures` (Git Bash: `/c/Users/memel/repos/learning-site/.worktrees/mobile-figures`).

- `src/lib/components/charts/MatrixEquation.svelte`
- `src/lib/charts/matrixEquation.ts`
- `src/lib/charts/matrixEquation.test.ts`
- `src/lib/components/charts/ChartFrame.svelte`
- `src/lib/components/charts/BarChart.svelte`
- `src/lib/components/charts/LineChart.svelte`
- `content/dl/attention/index.svx`, `content/dl/multi-head-attention/index.svx`, `content/dl/layer-norm/index.svx` — только подписи и параметры рисунков (`title`, `desc`, `label`, `text`, подписи столбцов), не прозу и не формулы.

## Запрещённые файлы

Всё остальное, включая `package.json`, lock-файл, конфиги, `src/routes/+layout.*`, глобальные стили `src/app.css` или `src/styles/*` (если причина прокрутки в них, остановиться и вернуть находку оркестратору с точным селектором), CI, `CLAUDE.md`, `docs/*`, `tasks/*`, `.claude/*`.

## Шаги

1. Воспроизвести: собрать (`npm run build` без `BASE_PATH`), поднять `npx vite preview --port 4399 --strictPort` в фоне (записать PID), снять скриншоты Playwright (`uv run --with playwright python ...`; при необходимости `uv run --with playwright python -m playwright install chromium`) трёх страниц на 375 px, найти источник прокрутки.
2. Исправить по пунктам выше, обновить тесты.
3. Повторить скриншоты на 375 и 1280 px в обеих темах, измерить размеры шрифта значений в ячейках (`getComputedStyle`/`getBBox`), `document.documentElement.scrollWidth` (должен быть ≤ 375), проверить с раскрытой «Данные графика».
4. Остановить свой preview-процесс ТОЛЬКО по PID (никогда по имени процесса).

## Критерии приёмки (командами)

```
cd /c/Users/memel/repos/learning-site/.worktrees/mobile-figures && npx vitest run src/lib/charts   # зелёные
cd /c/Users/memel/repos/learning-site/.worktrees/mobile-figures && npm run build   # exit 0
cd /c/Users/memel/repos/learning-site/.worktrees/mobile-figures && npm run check:content && npx prettier --check src/lib content   # ок
git -C /c/Users/memel/repos/learning-site/.worktrees/mobile-figures diff --name-only main   # только владеемые файлы
```

Дополнительно, с приведением измеренных чисел: на 375 px `scrollWidth` каждой из трёх страниц ≤ 375 (в том числе с раскрытой «Данные графика»); минимальный размер шрифта значений в ячейках ≥ 11 px; на 1280 px значения как раньше (11–13 px).

Полный `npm run check` в worktree падает на `./$types` из-за общего `node_modules`: не запускать, оркестратор проверит в `main`. `node_modules` в worktree это junction: не менять и не удалять.

## Бюджет

- Токены: до ~140k.
- Строки: до ~400 изменённых.
- Правило частичного результата: упёрся в бюджет, вернуть `partial` с перечнем готового.

## Точное сообщение коммита

```
fix(charts): make matrix figures and chart tables readable on narrow screens
```

Без `Co-Authored-By`, без упоминаний агентов, ИИ, Claude и моделей.

## Зависимости

- Ждёт: нет. Блокирует: пуш глав `attention`, `multi-head-attention`, `layer-norm`.
- Общие файлы: нет.
