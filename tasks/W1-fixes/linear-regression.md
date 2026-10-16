# Правки classic-ml/linear-regression (по проверке verifier)

Владеешь: `content/classic-ml/linear-regression/index.svx`, `data/glossary/classic-ml-linear-regression.yaml`.

1. [high] `sources` numpylstsq ссылается на `supports: [impl-lstsq]`, блока нет: добавить `{#impl-lstsq}` к абзацу про lstsq (~стр. 150).
2. [high] Вопрос `iv-ridge-lasso`: «L1-штраф имеет угол в точке ноль» неверно — углы ромба на осях (±t, 0), (0, ±t): «угол на оси, где часть весов равна нулю».
3. [medium] `iv-r2-mse`: SSE и SST не введены; R² = 1 − MSE/Var(y) — ввести словами и поправить формулировку.
4. [medium] Все `Quiz kind="interview"` вне `<Level>` видны на c=1, но используют матричную нотацию и MSE: обернуть раздел в `<Level c={2}>` и дать для c=1 короткий `Variant c="1"` с 1–2 словесными вопросами (или выразить вопросы словами).
5. [low] Английские термины при первом упоминании: mean squared error, normal equation, coefficient of determination.
6. [low] Пример `lstsq(X, y)` без столбца единиц — добавить или пояснить.
7. [low] В ridge смешаны w и θ — одно обозначение.
