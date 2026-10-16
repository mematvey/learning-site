# Волна S: хвосты вертикального среза

Общие правила как в `tasks/W1-wave.md` («Общие правила»).

## S1. Стабильные e2e — `test(e2e): wait for hydration, use real pagefind index`
Владеешь: `e2e/**`.
- `playwright.config.ts` (не менять) собирает и отдаёт статический `build/` через `uv run python -m http.server 4173 --bind 127.0.0.1 --directory build`; Pagefind доступен — убери подмену `/pagefind/*` через `page.route`.
- `+layout.svelte` ставит `html[data-hydrated="true"]` после гидрации. Хелпер `gotoReady(page, url)` = goto + ожидание маркера; использовать во всех спеках и после `reload`.
- Тесты падали нестабильно (home клавиша `2`, notes, progress, `?`) — действия до гидрации.
- Критерий: `npx playwright test --repeat-each=3` зелёный. Не убивай чужие процессы (только свои PID; никакого `taskkill /IM node.exe`). Если порт 4173 занят чужим процессом, сообщи в отчёте.

## S2. Лаб attention: таблица сравнения и PyTorch — `content(dl/attention): array comparisons in lab tests, library equivalent`
Владеешь: `labs/dl-attention-numpy/**`, `tests/labs/test_lab_check.py`, `content/dl/attention/index.svx` (только блок `Level d={2}` и frontmatter `sources`).
- Тесты лаба: сравнения массивов через `assert_close(actual, expected, ...)` из `src/lib/labs/harness.py`, чтобы `LabResult` содержал `expected`/`actual` и панель показала таблицу «ожидалось/получено/|Δ|». Скрытые тесты деталей не раскрывают (как сейчас).
- Глава: в `Level d={2}` строка про эквивалент `torch.nn.functional.scaled_dot_product_attention` с источником `kind: doc` (url документации PyTorch, `accessed`), в `supports` — id блока.
- Критерии: `uv run python scripts/lab_check.py dl-attention-numpy`, `uv run pytest -q tests/labs`, `npm run check`, `npm run build`.
