# Волна W1: первые главы DL Theory и Classic ML

Эталон главы: `content/dl/attention/index.svx` (разметка, уровни, `{#id}`, Figure, Quiz, Cite), лаб `labs/dl-attention-numpy/`, демо `src/lib/components/demos/AttentionDemo.svelte` + `src/lib/demos/attention.ts`. Правила: `CLAUDE.md`, `docs/CONTENT-GUIDE.md`, `docs/design-system.md`, `docs/CONTRACTS.md`, процедуры `.claude/skills/new-chapter/SKILL.md`, `.claude/skills/new-lab/SKILL.md`.

## Общие правила

- Только свой worktree (путь в задании), абсолютные пути. Сначала `npm ci`. Windows, Git Bash, Python через `uv`.
- Владеешь только файлами своего пакета (ниже). Запрещено: `package.json`/lock, корневые конфиги, `src/routes/**`, `src/lib/contracts/**`, `docs/**`, `CLAUDE.md`, чужие главы/лабы/демо, `data/glossary/dl.yaml`.
- Критерии для всех: `npm run check` (включает проверку контента) и `npm run build` зелёные. Плюс критерии пакета.
- Бюджет ~120k токенов; правило частичного результата из CLAUDE.md.
- Коммит: ровно сообщение из пакета, без Co-Authored-By и упоминаний агентов/ИИ/моделей. Отчёт по `tasks/REPORT-TEMPLATE.md`, до 200 слов.

### Пакет «текст главы» (content-writer)
Владеешь: `content/<topic>/<slug>/index.svx`, `data/glossary/<topic>-<slug>.yaml`.
- Скелет: идея (1–2 предложения) → интуиция → математика → код → частые ошибки → проверь себя. Уровни: `Variant c="1"`/`c="2-4"` (каждая ось без дыр), `Level c={3}` (вывод/доказательство), `Level d={2}` (реализация: сложность, численная устойчивость, эквивалент в библиотеке с источником kind=doc), `Level d={3}` (железо/производительность — только с источником).
- Демо главы вставляй как `<Figure id=… alt=… caption=… notice=…><ИмяDemo /></Figure>` (имя из пакета демо; компонент подключится сам, `<script>` не нужен). Лаб: `<CodeLab lab="<lab-id>" />`. Можно использовать графики `LineChart`, `BarChart`, `Heatmap` (пропсы — `src/lib/contracts/component-props.ts`).
- Глоссарий: свой файл; **перед добавлением термина** проверь `grep -r "id:" data/glossary` — существующие id переиспользуй (не дублируй), новые добавляй только к себе. В `notice` у Figure не пиши «Что заметить:» (метку ставит компонент).
- `prereqs` — только существующие главы (список: `ls content/*/`), плюс главы этой же волны, указанные в пакете. Источники с `id`, `kind`, `url`, `accessed`.
- Для Classic ML: раздел «Вопросы на собеседовании» — не меньше 4 `<Quiz kind="interview">` с развёрнутым ответом.

### Пакет «лаб» (lab-author)
Владеешь: `labs/<lab-id>/**`, `tests/labs/test_<lab_id>.py` (необязательно).
- `lab.yaml` по схеме `Lab` (runtime `pyodide`, `packages: [numpy]`), `starter.py`, `solution.py`, `tests_visible.py` (3–5), `tests_hidden.py` (4–8). Тесты сравнивают массивы через `assert_close(actual, expected, ...)` из харнесса (`src/lib/labs/harness.py`), чтобы панель результата показала таблицу «ожидалось/получено». Для графика — `report_series(...)` (кривая обучения/лосса, где уместно).
- Критерии: `uv run python scripts/lab_check.py <lab-id>` (эталон проходит, старт падает), `uv run ruff check .`.

### Пакет «демо» (component-dev)
Владеешь: `src/lib/components/demos/<Имя>.svelte`, `src/lib/demos/<slug>.ts` (+ `.test.ts`).
- Логика (чистые функции) в `src/lib/demos/<slug>.ts` с тестами Vitest; компонент — по образцу `AttentionDemo`: регистрируется в `DEMOS_CONTEXT` под именем `<slug>` (`set(patch)` для `DemoLink`), реагирует на `HIGHLIGHT_CONTEXT`, токены, обе темы, `prefers-reduced-motion`, SVG по реальной ширине (ResizeObserver), текст 12–13px, без горизонтального скролла на 390px. Пропс `initial?` (частичное состояние). Без собственной подписи «Рис. N» (её даёт `Figure`).
- Критерии: юнит-тесты логики; визуальная проверка через **временный** маршрут `src/routes/preview-<slug>/+page.svelte` (только твой компонент на странице с `data-topic`), `npm run build`, раздача `uv run python -m http.server <уникальный порт> --bind 127.0.0.1 --directory build`, Playwright-скриншоты 390 и 1440 обеих тем (тема: `document.documentElement.dataset.theme='dark'`), посмотри Read'ом, исправь. **Удали временный маршрут до коммита.** Сервер гаси по своему PID.

---

## Главы

### dl/softmax — «Softmax и температура»
- lab-id `dl-softmax`; демо `SoftmaxDemo`.
- Текст: логиты → вероятности; температура; инвариантность к сдвигу; вычитание максимума (устойчивость); log-softmax и logsumexp; связь с кросс-энтропией и градиент `p − y`. d=3: стоимость exp, слияние с редукцией (online softmax — сослаться на главу attention, источник Milakov & Gimelshein 2018 arXiv:1805.02867).
- Демо: 5 логитов-ползунков, температура (0.1–5), столбцы вероятностей, переключатель «наивный / устойчивый» с большими логитами (переполнение → NaN в наивном).
- Лаб: реализовать `softmax(x, axis=-1)` устойчиво и `log_softmax`, тесты на большие логиты, сумму = 1, совпадение с эталоном, инвариантность к сдвигу.

### dl/multi-head-attention — «Multi-head attention»
- prereqs: `dl/attention`. lab-id `dl-multi-head-attention`; демо `MultiHeadDemo`.
- Текст: зачем несколько голов; разбиение d_model на h голов по d_k = d_model/h; проекции W_Q, W_K, W_V, W_O; конкатенация; число параметров; сравнение стоимости с одной головой той же ширины. d=2: reshape/transpose в NumPy, `torch.nn.MultiheadAttention` (источник docs). d=3: KV-кэш при генерации, multi-query/grouped-query attention (источники: Shazeer 2019 arXiv:1911.02150, Ainslie et al. 2023 arXiv:2305.13245).
- Демо: 4 головы, у каждой своя тепловая карта весов для одного предложения; выбор головы подсвечивает её; ползунок h (1, 2, 4, 8) показывает d_k и форму тензоров.
- Лаб: `split_heads`, `merge_heads`, `multi_head_attention(X, W_q, W_k, W_v, W_o, h)`; тесты форм, совпадение с эталоном, h=1 совпадает с одноголовым вниманием.

### dl/layer-norm — «Residual и LayerNorm»
- prereqs: `dl/multi-head-attention`. lab-id `dl-layer-norm`; демо `LayerNormDemo`.
- Текст: остаточные связи и градиент «по прямой»; LayerNorm (среднее/дисперсия по признакам, γ, β, ε); отличие от BatchNorm; Pre-LN vs Post-LN и устойчивость обучения (источник Xiong et al. 2020 arXiv:2002.04745); RMSNorm (Zhang & Sennrich 2019 arXiv:1910.07467). d=2: численная устойчивость, `torch.nn.LayerNorm`. d=3: слияние ядер (нормализация как редукция по строке).
- Демо: гистограмма активаций одного токена до/после нормализации; ползунки γ и β; переключатель LayerNorm / RMSNorm.
- Лаб: `layer_norm(x, gamma, beta, eps)`, `rms_norm`; тесты среднего≈0/дисперсии≈1 по последней оси, γ/β, ε при постоянном входе.

### classic-ml/linear-regression — «Линейная регрессия»
- lab-id `classic-ml-linear-regression`; демо `LinearRegressionDemo`.
- Текст: модель, MSE, нормальное уравнение, градиентный спуск, геометрия (проекция на столбцы X), регуляризация L2 (ridge) и L1 (lasso) — интуиция, допущения (линейность, гомоскедастичность, независимость ошибок), R². d=2: решение через `lstsq`/QR вместо обращения матрицы, масштабирование признаков, `sklearn.linear_model.LinearRegression`/`Ridge` (docs).
- Демо: точки на плоскости (перетаскивание точек, добавление кликом), прямая МНК, остатки отрезками, ползунок λ для ridge, кривая лосса градиентного спуска (шаг обучения).
- Лаб: `fit_normal_equation`, `fit_gradient_descent` (с `report_series` лосса), `fit_ridge`; тесты совпадения с `np.linalg.lstsq`, сходимость GD, сжатие весов ridge при росте λ.

### classic-ml/logistic-regression — «Логистическая регрессия»
- prereqs: `classic-ml/linear-regression`, `dl/softmax`. lab-id `classic-ml-logistic-regression`; демо `LogisticRegressionDemo`.
- Текст: сигмоида, log-loss (вывод из правдоподобия), градиент `Xᵀ(p − y)/n`, выпуклость, порог и разделяющая граница, регуляризация, мультиклассовая (softmax-регрессия). d=2: устойчивое вычисление log-loss (logsumexp/`log1p`), `sklearn.linear_model.LogisticRegression` (docs).
- Демо: два класса точек на плоскости, линия границы и подложка вероятностей; ползунки весов/смещения или кнопка «шаг GD»; порог классификации и матрица ошибок рядом.
- Лаб: `sigmoid` (устойчивая), `log_loss`, `fit_logreg_gd` (с `report_series` лосса), `predict_proba`; тесты на большие логиты, совпадение градиента с численным, точность на разделимых данных.

### classic-ml/bias-variance — «Смещение и разброс»
- prereqs: `classic-ml/linear-regression`. lab-id `classic-ml-bias-variance`; демо `BiasVarianceDemo`.
- Текст: разложение ожидаемой ошибки на bias² + variance + шум (вывод на c=3), недо/переобучение, кривые обучения и валидации, сложность модели (степень полинома), регуляризация как управление разбросом, связь с кросс-валидацией; «двойной спуск» на d=3 с источником (Belkin et al. 2019 arXiv:1812.11118).
- Демо: истинная функция sin, несколько выборок с шумом, полиномиальные подгонки степени k (ползунок 1–15): облако подгонок, средняя подгонка, график bias²/variance/суммы от k.
- Лаб: `polynomial_features`, `fit_poly`, `bias_variance_estimate(degree, n_trials, …)` (с `report_series` по степеням); тесты: variance растёт со степенью, bias² падает, сумма≈ средняя MSE (с допуском).
