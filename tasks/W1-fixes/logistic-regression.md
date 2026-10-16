# Правки classic-ml/logistic-regression (по проверке verifier)

Владеешь: `content/classic-ml/logistic-regression/index.svx`, `data/glossary/classic-ml-logistic-regression.yaml`.

1. [high] Источник `numpylogaddexp`: `supports: [impl-logaddexp]` — блока нет; цитата в `impl-loss-form` → `supports: [impl-loss-form]`.
2. [high] `<Term id="regularization">` в `Level c={2}`: термин определён в `classic-ml/bias-variance` — добавить `classic-ml/bias-variance` в `prereqs` (цикла нет).
3. [medium] Граница решения описана как p = 0.5, а демо `LogisticRegressionDemo` рисует линию p = порог (есть слайдер порога): уточнить в тексте, `alt` рисунка и глоссарии (decision-boundary), что при пороге 0.5 граница — это p = 0.5, а при другом пороге сдвигается; упомянуть слайдер в подписи/тексте.
4. [low] H = (1/n) Xᵀ S X — для (w, b) нужен столбец единиц; уточнить.
5. [low] Глоссарий `convexity`: определить свойство выпуклости, а не только следствие.
6. [low] Английские термины при первом упоминании: cross-entropy, likelihood, convexity.
