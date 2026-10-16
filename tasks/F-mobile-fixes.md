# Волна F: правки по design-qa (мобильная ширина и лаб)

Скриншоты проверки: `C:\Users\memel\AppData\Local\Temp\claude\c--Users-memel-repos-learning-site\a2938a53-ecf5-429f-9e69-e07dbfc09a93\scratchpad\qa\shots\` (и `slices/`). Правила: `docs/design-system.md` §5, §7, §9, §11. Проверка у всех: `npm run check`, `npm run build`, свои скриншоты через Playwright против статики `uv run python -m http.server <порт> --directory build` (порт уникальный, сервер погаси в конце), ширины 390 и 1440, обе темы; смотри Read'ом.

## F1. Демо внимания на мобильной ширине — `fix(demos): responsive attention demo`
Владеешь: `src/lib/components/demos/AttentionDemo.svelte`, `src/lib/demos/**`.
- 390px: горизонтальный скролл (scrollWidth 412) из-за панели управления (`ad-ctl`, `ad-d`): панель переносится в столбец, слайдер на всю ширину.
- Чипы токенов слипаются, подписи дуг 7–8px: при узкой ширине — подписи 12px, меньше токенов в ряд не допускается, поэтому дуги рисуются по реальной ширине (без масштабирования viewBox), подписи весов показывать только у 3 сильнейших дуг.
- Тепловая карта: значения вылезают из ячеек, заголовки обрезаны. При ширине < 560px — ячейки без чисел (цвет + подсказка по тапу), заголовки столбцов повёрнуты или сокращены до 3 букв с `title`; таблица-альтернатива уже есть в «Описании».
- Критерий: на 390 `document.documentElement.scrollWidth === 390`.

## F2. Шапка, поповер уровня, поиск на мобильной — `fix(shell): mobile header, level popover, search scrim`
Владеешь: `src/lib/components/SiteHeader.svelte`, `LevelPopover.svelte`, `SearchDialog.svelte`.
- Поповер уровня на 390: в экране с полями 16px (не x=0), подписи положений не налезают (переносятся в две строки или показывается только активная подпись под слайдером).
- Поле поиска на 390 сжато до ~55px: на мобиле в шапке иконка-кнопка поиска (тот же `data-search`), крошки скрываются.
- Скрим диалога поиска в тёмной теме «грязный» серо-оливковый: использовать `color-mix(in srgb, var(--bg) 70%, transparent)` + `backdrop-filter: blur(4px)`.

## F3. Лаб — `fix(labs): primary button, long lines, diff table`
Владеешь: `src/lib/components/CodeLab.svelte`, `LabResultPanel.svelte`, `src/lib/components/lab/**`.
- «Запустить» — основная кнопка цвета `--topic` (как в макете), не `--accent`.
- Длинные строки обрезаются справа: горизонтальная прокрутка внутри редактора (CodeMirror `scroller`), рамка не растягивается.
- В раскрытом упавшем тесте таблица «ожидалось / получено / |Δ|» (как в `docs/mockups/lab-demo.*`), если в `TestResult` есть `expected`/`actual` массивы; иначе текст как сейчас.
