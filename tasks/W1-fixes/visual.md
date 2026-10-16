# Визуальные правки по design-qa

Владеешь: `src/lib/styles/prose.css`, `src/lib/components/ChapterPage.svelte` (только список источников), `src/lib/components/demos/LogisticRegressionDemo.svelte` (только контейнер формулы).

1. [high] На 390px display-формулы (`.math-display`) и формулы в демо обрезаются справа: горизонтальный скролл внутри блока формулы (`overflow-x: auto`, без скролла страницы), тонкий скроллбар, отступ снизу; в `LogisticRegressionDemo` — то же для контейнера KaTeX.
2. [medium] Список источников: длинные URL рвутся посреди слова — показывать ссылку текстом домена/пути с `overflow-wrap: anywhere` только для URL, либо выводить название источника ссылкой, а URL мелко серым с переносом по `/`.
Критерии: `npm run check`, `npm run build`; скриншоты `/classic-ml/logistic-regression/` и `/classic-ml/linear-regression/` на 390 и 1440 обеих тем (статика `uv run python -m http.server <порт> --bind 127.0.0.1 --directory build`, ждать `html[data-hydrated="true"]`), scrollWidth на 390 = 390.
Коммит: `fix(chapter): scrollable formulas and wrapped source urls`.
