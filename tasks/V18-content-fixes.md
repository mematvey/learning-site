# V18. Правки главы dl/attention по проверке verifier

- Роль: content-writer (Haiku, medium). Зависит от: I1 слит.
- Владеешь: `content/dl/attention/index.svx`, `data/glossary/dl.yaml`, `labs/dl-attention-numpy/tests_visible.py` (только п. 5).
- Правила: `docs/CONTENT-GUIDE.md`, `CLAUDE.md` (оси уровней).

## Находки (исправить все)

1. [high] Раздел «Математика» и `StepCards` вне `Level`/`Variant`, видны на c=1, но используют n, d, d_v, Q, K, V, √d, S, α_ij, softmax (d вводится только в `Variant c="2-4"`). Сделать: базовый текст на c=1 словами («размерность ключей», «строки — токены»); формулы и `StepCards` — в `Level c={2}`, плюс `Variant c="1"` со словесной версией шагов.
2. [medium] Число «около 67 млн» и «обычно записывается в HBM» (блок `hw-scores`) не подкреплены: добавить `hw-scores` в `supports` источника Dao et al. 2022 (Algorithm 0 пишет S в HBM); число оставить как арифметику 8192² ≈ 6.7·10⁷.
3. [medium] «как показано в оригинальной работе … softmax почти превращается в one-hot»: в Vaswani §3.2.1 (сноска 4) речь о дисперсии d_k и о том, что softmax попадает в область очень малых градиентов. Перефразировать точно.
4. [medium] `Level d={2}`: добавить сложность O(n²d) по времени и O(n²) по памяти, эквивалент в библиотеке (`torch.nn.functional.scaled_dot_product_attention`); привести формы к лабу: Q ∈ (n, d), K ∈ (m, d), V ∈ (m, d_v).
5. [medium] «Тесты проверяют … маску», а видимые тесты маску не проверяют. Добавить видимый тест маски в `tests_visible.py` (простой causal-случай; эталон должен проходить, старт — падать; проверь `uv run python scripts/lab_check.py` и `uv run pytest -q tests/labs`).
6. [low] «маска добавляется к оценкам» (текст и глоссарий): написать «запрещённые позиции получают −∞ до softmax».
7. [low] FlashAttention: running max и сумма экспонент ведутся по строкам по мере прохода тайлов, а не «для каждого тайла». Уточнить.
8. [low] Раздел «Идея» — 1–2 предложения (сейчас три абзаца); лишнее перенести в «Интуицию».

## Критерии приёмки

`npm run check` (включает `check:content`), `npm run build`, `uv run python scripts/lab_check.py`, `uv run pytest -q tests/labs`. Id существующих блоков не менять (на них ссылаются `supports`); новые блоки — новые id.

## Коммит

`content(dl/attention): fix level consistency and sourcing` — без Co-Authored-By и упоминаний агентов/ИИ/моделей.
