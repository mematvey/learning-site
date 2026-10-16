# Правки dl/multi-head-attention (по проверке verifier)

Владеешь: `content/dl/multi-head-attention/index.svx`, `data/glossary/dl-multi-head-attention.yaml`.

1. [high] Базовый текст (c=1, ~стр. 92) вводит $X$: словами «входная матрица, строка на токен»; $X$ ввести в `Level c={2}` (math-shapes).
2. [medium] KV-кэш: «размер растёт с числом голов» противоречит формуле 2·n·d_model: размер растёт с длиной последовательности и шириной модели, при фиксированной ширине от h не зависит.
3. [medium] math-cost цитирует vaswani2017 за собственный вывод: сформулировать как вывод из O(n²·d) (таблица 1), поправить `supports`.
4. [medium] 5% предобучения — рецепт uptraining из MQA (arXiv 2305.13245); разделить это и утверждение о качестве GQA.
5. [medium] Источник pytorchmha: версия документации в title/venue.
6. [medium] Индекс головы i конфликтует с i = запрос в главе attention: для головы другой индекс (t или h-индекс j… выбери и используй единообразно).
7. [medium] Две display-формулы подряд без слов (math-head, math-concat): фраза между ними.
8. [low] shazeer2019 `supports` включает hw-kv-cache, но в блоке нет `<Cite>`: добавить Cite.
9. [low] Глоссарий: `term` у multi-query-attention и grouped-query-attention на русском (английский — в `term_en`).
10. [low] Содержательные абзацы без `{#id}` (~стр. 116, 129, 131): добавить id.
11. [low] Первое упоминание scaled dot-product — с английским термином.
