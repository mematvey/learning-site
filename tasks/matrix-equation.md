# Пакет: matrix-equation

## id

`matrix-equation` (ветка `task/matrix-equation`, worktree `.worktrees/matrix-equation`).

## Дорожка

`platform` (компонент в `src/lib/components/charts/`).

## Роль и модель

- Роль: `component-dev`.
- Модель: `haiku`.
- Effort: `medium`.

## Цель

Статичный SVG-компонент `MatrixEquation`: рисует цепочку «матрица ○ матрица = матрица» с числами в ячейках, подсвеченными строками, столбцами и ячейками, подписями размерностей и знаками операций. Нужен для пошаговых картинок вычисления внимания, слоёв, градиентов (Рис. N с подписью и «Что заметить»).

## Контекст и ссылки

- Читать в этом порядке: `CLAUDE.md`, `docs/design-system.md`, `docs/CONTENT-GUIDE.md` (раздел 7: интерактив и рисунки), `src/lib/components/charts/MatrixDiagram.svelte` и `Heatmap.svelte` (соседи: структура, `ChartFrame`, токены цветов, обзор данных таблицей для доступности), `src/lib/components/steps/AttentionMatrices.svelte`, `src/lib/contracts/component-props.ts` (`ChartBase`, `EntityId`, `MatrixDiagramProps`).
- Компоненты из `src/lib/components/charts/` подключаются в главы автоматически по имени файла (`src/lib/content/mdsvex/auto-import.ts`), регистрировать ничего не надо.
- Цвета: только токены дизайн-системы (в том числе `ENTITY_COLOR_VAR`, `catVar`, `seqFill` из `$lib/charts/colors`), никаких hex. Обе темы (светлая и тёмная). Ширина 375 px: рисунок масштабируется или прокручивается внутри `ChartFrame`, страница не получает горизонтальной прокрутки.

## Контракты и интерфейсы

Добавить в `src/lib/contracts/component-props.ts` (после `MatrixDiagramProps`):

```ts
/** One matrix with numeric cells in a MatrixEquation row. */
export interface EquationMatrix {
	kind: 'matrix';
	id: string;
	/** Short name drawn above the matrix, e.g. "Q" or "Kᵀ". Plain text, no TeX. */
	label: string;
	/** Row-major values. */
	values: number[][];
	/** Printed under the matrix, e.g. "n × d = 4 × 3". */
	dim?: string;
	rowLabels?: string[];
	colLabels?: string[];
	/** Entity colour (as in MatrixDiagram); otherwise a neutral categorical colour. */
	entity?: EntityId;
	/** Zero-based indices of rows / columns drawn highlighted. */
	highlightRows?: number[];
	highlightCols?: number[];
	/** Zero-based [row, col] cells drawn with a strong outline. */
	highlightCells?: Array<[number, number]>;
	/** Dim the whole matrix (it takes no part in this step). */
	dimmed?: boolean;
}

/** An operator glyph between matrices: "×", "=", "÷ √d", "softmax". */
export interface EquationOp {
	kind: 'op';
	text: string;
}

export interface MatrixEquationProps extends ChartBase {
	items: Array<EquationMatrix | EquationOp>;
	/** Digits after the decimal point in cells; default 2. Integers are printed without a fraction. */
	decimals?: number;
}
```

Файл `src/lib/components/charts/MatrixEquation.svelte`: `let { title, desc, height, items, decimals = 2 }: MatrixEquationProps = $props();` Размер ячейки зависит от доступной ширины (число колонок всех матриц плюс отступы) в пределах MIN 18 и MAX 40 SVG-единиц; значения в ячейках моноширинным шрифтом из дизайн-системы; цвет текста по контрасту к заливке. Подсвеченные строки и столбцы: заливка насыщеннее, остальное в цвете матрицы с низкой непрозрачностью; `highlightCells`: рамка 2 px. Подпись `dim` под матрицей, `label` над ней, знаки операций по центру по вертикали между матрицами.

Чистая логика в `src/lib/charts/matrixEquation.ts` (без Svelte): `formatCell(value, decimals)`, `layoutItems(items, availableWidth)` → координаты, размер ячейки, общая высота; `cellState(matrix, r, c)` → `'cell' | 'row' | 'col' | 'both' | 'focus'`. Тест `src/lib/charts/matrixEquation.test.ts` (Vitest): формат чисел (целые без дробной части, отрицательные, округление), раскладка не выходит за ширину и не меньше MIN, состояния ячеек.

Доступность: `ChartFrame` рендерит таблицу-альтернативу; передать в неё построчно значения каждой матрицы (заголовок: имя матрицы и размерность). Использовать тот же приём, что в `MatrixDiagram`/`Heatmap`.

Пример использования в главе (должен работать без доп. импортов):

```svx
<MatrixEquation
  title="Оценки: S = Q Kᵀ"
  desc="Матрица Q 4×3 умножается на Kᵀ 3×4 и даёт S 4×4; подсвечены строка 2 матрицы Q, столбец 3 матрицы Kᵀ и их произведение в ячейке (2,3)."
  items={[
    { kind: 'matrix', id: 'Q', label: 'Q', values: [[1,0,1],[0,1,1],[1,1,0],[0,0,1]], dim: '4 × 3', entity: 'q', highlightRows: [1] },
    { kind: 'op', text: '×' },
    { kind: 'matrix', id: 'Kt', label: 'Kᵀ', values: [[1,0,1,0],[0,1,1,0],[1,1,0,1]], dim: '3 × 4', entity: 'k', highlightCols: [2] },
    { kind: 'op', text: '=' },
    { kind: 'matrix', id: 'S', label: 'S', values: [[2,1,1,1],[1,2,1,1],[1,1,2,0],[1,1,0,1]], dim: '4 × 4', highlightCells: [[1,2]] }
  ]}
/>
```

(Допустимо до 3 пар «матрица–знак» в строке; при ширине 375 px лишнее переносится на вторую строку или рисунок масштабируется.)

## Владеемые файлы

Абсолютный путь worktree: `C:\Users\memel\repos\learning-site\.worktrees\matrix-equation` (Git Bash: `/c/Users/memel/repos/learning-site/.worktrees/matrix-equation`).

- `src/lib/components/charts/MatrixEquation.svelte`
- `src/lib/charts/matrixEquation.ts`
- `src/lib/charts/matrixEquation.test.ts`
- `src/lib/contracts/component-props.ts` (только добавление интерфейсов выше)

## Запрещённые файлы

Всё остальное: `package.json`, lock-файл, конфиги, `src/routes/+layout.*`, CI, `CLAUDE.md`, `docs/*`, `tasks/*`, `.claude/*`, реестры, существующие компоненты (`MatrixDiagram`, `Heatmap`, `StepCards`, `AttentionMatrices`), `content/*`.

## Шаги

1. Прочитать соседей и дизайн-систему, зафиксировать токены цветов и шрифтов.
2. Написать чистую логику и тест, добиться зелёного Vitest.
3. Написать компонент, использовать `ChartFrame`.
4. Временно (не коммитить) вставить пример из «Контрактов» в тестовую страницу или проверить компиляцию через `npm run build`; убрать временные файлы.
5. Проверки (см. ниже) и коммит.

## Критерии приёмки (командами)

```
cd /c/Users/memel/repos/learning-site/.worktrees/matrix-equation && npx vitest run src/lib/charts/matrixEquation.test.ts   # все тесты зелёные
cd /c/Users/memel/repos/learning-site/.worktrees/matrix-equation && npm run check   # 0 ошибок svelte-check, eslint, prettier, content, vitest
cd /c/Users/memel/repos/learning-site/.worktrees/matrix-equation && npm run build   # сборка успешна
git -C /c/Users/memel/repos/learning-site/.worktrees/matrix-equation diff --name-only main   # только владеемые файлы
grep -nE '#[0-9a-fA-F]{3,8}\b' src/lib/components/charts/MatrixEquation.svelte   # пусто: нет hex-цветов
```

В worktree нет `node_modules`: он подключён junction-ссылкой на основной репозиторий; ничего в `node_modules` не менять и не удалять.

## Бюджет

- Токены: до ~100–140k.
- Строки: до ~400 изменённых, 4 файла.
- Правило частичного результата: упёрся в бюджет с большим остатком работы, остановиться и вернуть `partial` с перечнем готового.

## Примеры для копирования

- `src/lib/components/charts/MatrixDiagram.svelte` — структура компонента, `ChartFrame`, цвета сущностей.
- `src/lib/components/charts/Heatmap.svelte` — подпись значений в ячейках, цвет текста, тема.

## Точное сообщение коммита

```
feat(charts): add static MatrixEquation figure
```

Без `Co-Authored-By`, без упоминаний агентов, ИИ, Claude и моделей.

## Зависимости

- Ждёт: нет.
- Блокирует: главы `dl/attention`, `dl/multi-head-attention`, `dl/layer-norm` (углубление).
- Общие файлы (трогает только оркестратор): нет.

## Заявка

Не используется (одна сессия).
