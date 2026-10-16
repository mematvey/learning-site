# Линтер контента: проверка supports и Cite

Владеешь: `scripts/lib/**`, `scripts/check-content.ts`, `src/lib/content/content-tools.test.ts`, `scripts/__fixtures__/**`.

`npm run check:content` не ловит: (а) `sources[].supports` ссылается на id блока, которого нет в главе; (б) источник с `supports`, но без `<Cite id>` в тексте (предупреждение, не ошибка); (в) TeX или `{`/`}` в атрибутах компонентов (`q=`, `caption=`, `notice=`, `alt=`) — ошибка с `file:line`. Добавь эти проверки и тесты на фикстурах (позитив/негатив).
Внимание: после добавления реальный контент может начать падать — это ожидаемо, главы чинят параллельные пакеты. Проверь `npm run check:content` и перечисли в отчёте все находки по реальному контенту, но контент не правь.
Коммит: `feat(content): check source supports, citations and tex in attributes`.
