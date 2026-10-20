# Волна ROB: экспериментальная глава `stats/robust-estimation`

Глава «Робастные оценки и M-оценки» в топике `stats`, в отдельном **экспериментальном списке** (не входит в основной порядок глав, прогресс и prev/next). Источник: лабораторная и ноутбук студента (`tasks/ROB-notebook.md` — выжимка всех формул, кодов и чисел ноутбука; читай её первой). Модель: `X = μ + σU`, `U ~ (1-ε)·N(0,1/C²) + ε·(2/C)·T₃`, ε=0.05, нормировка Var(U)=1 (C²=1.55).

## Общие правила
- Только свой worktree (путь в задании), абсолютные пути; сначала `npm ci`, если нет `node_modules`. Windows, Git Bash, Python через `uv`. **Каждую команду с явным `cd <worktree> &&`.**
- Владеешь только файлами пакета. Запрещено: `package.json`/lock, корневые конфиги, `docs/**`, `tasks/**`, `.claude/**`, чужие файлы.
- Стек и стиль: как у соседних файлов (TypeScript strict, табы, одинарные кавычки). Код и комментарии на английском, подписи в UI на русском. Только токены дизайн-системы (`docs/design-system.md`), обе темы, 390px без горизонтального скролла, `prefers-reduced-motion`, клавиатура.
- Критерии для всех: `npm run check`, затем `npm run build`. Бюджет ~120k токенов. Коммит: ровно сообщение из пакета, без `Co-Authored-By` и упоминаний агентов/ИИ/моделей. Отчёт по `tasks/REPORT-TEMPLATE.md`, до 200 слов.

## Контракт модулей (общий для пакетов)

`src/lib/demos/robust-core.ts` (ROB1a), все функции чистые, без DOM:

```ts
export type PsiKind = 'huber' | 'bisquare';
export type RhoKind = 'bisquare' | 'clipped'; // clipped: min((u/c)^2, 1)
export const PHI75: number; // Φ^{-1}(0.75) = 0.67449
export function normalPdf(x: number): number; export function normalCdf(x: number): number; export function normalQuantile(p: number): number;
export function psi(kind: PsiKind, u: number, c: number): number;
export function dpsi(kind: PsiKind, u: number, c: number): number;
export function weight(kind: PsiKind, u: number, c: number): number; // psi(u)/u, 1 at u=0
export function rho(kind: RhoKind, u: number, c: number): number;
export function drho(kind: RhoKind, u: number, c: number): number;
export function mean(x: ArrayLike<number>): number; export function sd(x: ArrayLike<number>): number; // ddof=1
export function median(x: ArrayLike<number>): number;
export function quantile(x: ArrayLike<number>, p: number): number; // numpy 'linear'
export function madRaw(x): number; export function iqrRaw(x): number;
export function madn(x): number; // madRaw/PHI75
export function iqrn(x): number; // iqrRaw/(2*PHI75)
export function mScale(x: ArrayLike<number>, o: { kind: RhoKind; c: number; b: number; center?: number }): number; // mean rho((x-center)/s)=b, center=median by default, bracketed root search
export interface IrlsStep { mu: number; weights: number[] }
export function locationIrls(x: ArrayLike<number>, scale: number, o: { kind: PsiKind; c: number; start?: number; tol?: number; maxIter?: number }): { mu: number; iterations: number; trace: IrlsStep[] }; // trace[0] = start point with its weights; start default median
export function jointM(x: ArrayLike<number>, o: { psi: { kind: PsiKind; c: number }; rho: { kind: RhoKind; c: number; b: number } }): { mu: number; sigma: number; iterations: number; trace: { mu: number; sigma: number }[] }; // alternate location step / scale step from (median, mScale)
```

`src/lib/demos/robust-model.ts` (ROB1b), без импорта из `robust-core` (ψ/ρ передаются колбэками):

```ts
export interface MixtureParams { eps: number; df: number; outlierRawScale: number } // defaults 0.05, 3, 2
export interface Mixture {
  params: MixtureParams; c2: number; usualSd: number; outlierScale: number; // c2 = (1-eps)+eps*s^2*df/(df-2); usualSd=1/C; outlierScale=s/C
  pdf(x: number): number; cdf(x: number): number; quantile(p: number): number;
  sample(n: number, rng: () => number): Float64Array; // U with Var=1
  sampleX(n: number, rng: () => number, mu: number, sigma: number): Float64Array;
  expect(f: (u: number) => number): number; // E f(U) by deterministic numerical integration, abs. error < 1e-6 for bounded f
  tailProb(k: number): number; // P(|U|>k)
}
export function makeMixture(p?: Partial<MixtureParams>): Mixture; // require df>2, 0<=eps<1
export function locationFactor(m: Mixture, psi: (u:number)=>number, dpsi: (u:number)=>number): number; // E psi^2 / (E psi')^2  (V_mu)
export function scaleFactor(m: Mixture, rho: (u:number)=>number, drho: (u:number)=>number, b?: number): number; // Var(rho(U)) / (E[U rho'(U)])^2 (V_sigma); b default E rho(U)
export function medianFactor(m: Mixture): number; // 1/(4 f(0)^2)
export function madLimitRatio(m: Mixture): number; // q_F(0.75)/Phi^{-1}(0.75): plim MADN/sigma (= plim IQRN/sigma)
export function scaleLimitRatio(m: Mixture, rho: (u:number)=>number, b: number): number; // s* solving E rho(U/s*) = b
```

Имена демо (props: необязательный `initial`, как у `BootstrapDemo`) — файлы в `src/lib/components/demos/`: `ScaleEstimatorsDemo`, `MixtureCalibrationDemo`, `PsiFunctionsDemo`, `IrlsDemo`, `LocationEfficiencyDemo`, `JointEstimationDemo`. Рисование: свой SVG, как в `BootstrapDemo.svelte`/`ConcentrationDemo.svelte` (оцени, что использовать из `src/lib/components/charts`, `src/lib/charts/*`).

Числа для тестов (из ноутбука, допуск 1e-4, если не сказано иное): C²=1.55, usualSd=0.803219, outlierScale=1.606439; q_F(0.75)=0.558580; `madLimitRatio`=0.828151; `tailProb`: k=2 → 0.027213, k=3 → 0.008111, k=5 → 0.002639; bisquare ρ c=1.54764: E_N ρ(Z)=0.500001 (допуск 1e-5), E_F ρ(U)=0.426796; `scaleLimitRatio` (rho bisquare 1.54764, b=0.500001)=0.829914; `locationFactor`: Huber c=1.5 → 0.724450, Huber 0.8 → 0.769102, bisquare 4.685 → 0.716601, bisquare 2.0 → 1.073196; `medianFactor`=1.07037; `scaleFactor`: bisquare c=1.54764 → 0.812193; clipped c=2 → 0.635925 (b_F=0.173965).

---

## EXP1. Экспериментальный список — `feat(content): experimental chapters list on topic page`
Дорожка platform. Владеешь: `src/lib/contracts/chapter.ts`, `src/lib/contracts/registry.ts`, `src/lib/contracts/topic.ts` (только если нужно), `scripts/lib/build.ts` и соседние файлы `scripts/lib/*` по необходимости, их тесты, `src/routes/[topic]/+page.svelte`, `src/routes/[topic]/+page.ts`, `src/lib/components/TopicChapterList.svelte`, `src/lib/content/**` (только если нужно). Запрещено: `content/**`, `data/**`.
- Во frontmatter главы необязательное поле `experimental: boolean` (по умолчанию false).
- Экспериментальные главы **не входят** в `chapterIds` темы, `index/prev/next` основной последовательности, подсчёт «пройдено X из Y» и сброс/сводки основной серии. Они хранятся отдельно (`experimentalIds` в записи темы, `experimental: true` в записи главы; prev/next у них `null`). Основная нумерация глав не меняется.
- Сама глава остаётся доступной по своему адресу, поиск и граф пререквизитов её видят. На графе предпочтительно отметить её штриховым узлом, если это дёшево; если нет — оставить как есть и написать в отчёте.
- Страница топика: под списком «Главы» (после основного списка, перед «Картой глав») отдельный раздел «Эксперименты» (`h2`, id `experiments-title`) с пояснением одним предложением («Материалы вне основной программы: могут быть неполными или необязательными»), список в том же компоненте `TopicChapterList` без сквозной нумерации с основным (номера не нужны, вместо них метка «эксп.»). Раздел виден только если есть экспериментальные главы. Статусы чтения и «Прочитана» работают как у обычных.
- Тесты: Vitest на сборку реестра (экспериментальная глава не попадает в `chapterIds` и не сдвигает `index/prev/next` соседей, а попадает в `experimentalIds`). Для проверки создай временную фикстуру в тестовой папке, не в `content/`.
- Критерии: `npm run check`, `npm run build`. Проверка вручную: на временной главе в worktree (удалить до коммита) страница `/stats/` показывает раздел «Эксперименты».

## ROB1a. Ядро оценок — `feat(demos): robust estimators core (MAD, IQR, M-scale, IRLS)`
Дорожка stats. Владеешь: `src/lib/demos/robust-core.ts`, `src/lib/demos/robust-core.test.ts`. Контракт выше. Используй `mulberry32` из `$lib/prob/rng` только в тестах.
- Реализуй весь контракт. `normalQuantile`: Acklam либо Wichura AS241, ошибка < 1e-9; `normalCdf` через erf с точностью ~1e-7+ (сверь с таблицей: Φ(1.96)=0.9750021).
- `mScale`: монотонное по s уравнение, надёжный поиск корня (bracket + бисекция/Brent); если медиана |x−center| = 0, взять sd; при вырожденных данных вернуть 0.
- `locationIrls`: веса `weight(kind,u,c)`; bisquare с весом 0 вне |u|≥c; остановка по `tol` (по умолчанию 1e-10·max(scale,1)), `maxIter` 200; `trace` содержит все итерации (для демо).
- Тесты: сдвиг/масштаб `S(aX+d)=|a|S(X)` для madn, iqrn, mScale (a<0 тоже); на N(0,1) большой выборки (seed) madn≈1, iqrn≈1, mScale с b=0.500001, c=1.54764 ≈ 1 (допуск 0.05); psi/dpsi/rho/drho согласованы численной производной; locationIrls на `[1,2,3,4,100]` с huber c=1.5 даёт mu между 2 и 4, а с bisquare c=4.685 из медианы — близко к 3; IRLS не расходится на константной выборке; значения `normalQuantile(0.75)=0.67449`.

## ROB1b. Модель смеси и асимптотика — `feat(demos): contaminated mixture model and asymptotic variance factors`
Дорожка stats. Владеешь: `src/lib/demos/robust-model.ts`, `src/lib/demos/robust-model.test.ts`. Контракт выше; `mulberry32` из `$lib/prob/rng`; ничего не импортируй из `robust-core`.
- Student-t: pdf через lgamma, cdf через регуляризованную неполную бета-функцию (или квадратуру); `quantile` — бисекция по `cdf`. Нормальная часть: свои pdf/cdf (erf).
- `expect`: детерминированная квадратура (например, подстановка x=s·tan θ или кусочный Гаусс–Лежандр на [-L,L] с остатком хвоста); ограниченные f должны давать < 1e-6 по сравнению с точным значением, подбери узлы сам, время одного вызова < 20 мс.
- `sample`: Бернулли(eps) выбирает компоненту; t-выборка через `Z/√(χ²_df/df)` (df целое — сумма квадратов нормалей; для нецелого — гамма-генератор или ограничься целым и валидируй в `makeMixture`). Нормальные — Box–Muller из переданного rng.
- Тесты: все числа из раздела «Числа для тестов»; эмпирическая дисперсия `sample(200000)` ≈ 1 (допуск 0.03); `cdf(quantile(p))≈p`; симметрия `cdf(x)+cdf(−x)=1`; eps=0 даёт чистую нормаль (`locationFactor` для ψ(u)=u,ψ'=1 равен 1).

## ROB2a. Демо про масштаб — `feat(demos): scale estimators and mixture calibration demos`
Ждёт слияния ROB1a, ROB1b. Владеешь: `src/lib/components/demos/ScaleEstimatorsDemo.svelte`, `MixtureCalibrationDemo.svelte` (+ вспомогательные `src/lib/components/demos/robust/*` если нужно). Логику не пишешь — только вызываешь `robust-core`/`robust-model`.
- **ScaleEstimatorsDemo**: числовая ось с ~21 точкой из N(0,1) (фиксированный seed, кнопка «Новая выборка»). Точки можно перетаскивать мышью/пальцем (pointer events) и двигать клавиатурой (фокус, стрелки). Кнопка «Добавить выброс» добавляет точку далеко справа (ещё пара). Таблица/полосы значений: стандартное отклонение, MAD, MADN, IQRN, M-scale (bisquare, c=1.54764, b=0.5), пересчитываются на лету; истинное σ=1 как линия. Подпись «что видно»: SD уезжает при одном выбросе, MADN почти не двигается. Ползунок «доля выбросов» 0–50% (замена k точек на 50-кратный сдвиг) с графиком «значение оценки против доли выбросов»: SD растёт сразу, MADN держится до ~50% (точка пробоя).
- **MixtureCalibrationDemo** (раздел 1–2.3 ноутбука): ползунки ε (0–0.3, по умолчанию 0.05) и df (3,4,5…); график плотности смеси против N(0,1) с переключателем «линейная/лог. шкала» (виден тяжёлый хвост); таблица P(|U|>k) для k=2,3,5 с отношением к нормальному; блок «Нормировка»: `q_F(0.75)` против `Φ⁻¹(0.75)`, предел MADN/σ = `madLimitRatio` (при ε=0.05 → 0.828), предел M-scale с нормальной калибровкой; кнопка «Эксперимент»: Монте-Карло R=200 повторов для n ∈ {50,100,300,1000} (порциями, UI не блокируется, прогресс) — линия среднего MADN (нормальная константа) и «MAD calibrated» (делим на q_F) против n, горизонтальные линии σ и предела. σ=3 как в ноутбуке (μ=2).
- Критерии: `npm run check`, `npm run build`; временный маршрут для скриншотов создать и удалить до коммита; скриншоты двух тем и 390px приложить путями в отчёте.

## ROB2b. Демо про ψ и IRLS — `feat(demos): psi functions and IRLS demos`
Ждёт слияния ROB1a. Владеешь: `PsiFunctionsDemo.svelte`, `IrlsDemo.svelte` в `src/lib/components/demos/` (+ `robust/*`).
- **PsiFunctionsDemo**: три синхронных графика для выбранной функции (Huber, bisquare, для масштаба ещё clipped quadratic): ρ(u), ψ(u)=ρ' (influence function) и вес w(u)=ψ(u)/u на u∈[−8,8]; переключатель семейства и ползунок c (подписи c=1.345 и 4.685 как «стандартные 95% эффективности при нормали»; c=1.5 из ноутбука отметить). Для сравнения тонкой линией ψ(u)=u («среднее») и sign(u) («медиана»). Подпись под графиком словами: Huber ограничивает влияние, bisquare обнуляет.
- **IrlsDemo**: выборка (~15 точек, часть выбросов), редактируемая перетаскиванием точек; пошаговое выполнение «Шаг», «Сходимость», «Сброс»: на оси точки с радиусом/прозрачностью по весу w_i, текущая μ_k вертикальной линией, список μ_0…μ_k и таблица весов; выбор ψ (Huber c=1.5 / bisquare c=4.685), масштаб σ̂ = M-scale (bisquare); выбор старта: «медиана» / «среднее» / «вручную» (ползунок). Показать, что bisquare из плохого старта может застрять в другом решении (на подготовленном наборе с двумя кластерами) и пометить «поэтому стартуем с медианы».
- Критерии как в ROB2a.

## ROB2c. Демо про эффективность и совместное оценивание — `feat(demos): location efficiency and joint estimation demos`
Ждёт слияния ROB1a, ROB1b. Владеешь: `LocationEfficiencyDemo.svelte`, `JointEstimationDemo.svelte` в `src/lib/components/demos/` (+ `robust/*`).
- **LocationEfficiencyDemo** (раздел 3 ноутбука): график `V_μ(c)` (асимптотический фактор дисперсии положения) для Huber и bisquare по сетке c, на модели смеси с ползунком ε (0–0.3), горизонтальная линия среднего (V=1) и медианы (`medianFactor`); отметки минимумов; таблица значений при ε=0.05 (должна совпасть с ноутбуком: Huber 1.5 → 0.7245; bisquare 4.685 → 0.7166). Кнопка «Проверить симуляцией»: R=300 повторов при n=500, σ̂ = M-scale (bisquare, калибровка b_F из модели), эмпирическое n·Var/σ² для Mean/Median/Huber 1.5/Bisquare 4.685 рядом с теоретическим (порциями, прогресс). Вычисление `V_μ(c)` на сетке кешировать, пересчёт при смене ε не должен подвешивать UI (<200 мс или порциями).
- **JointEstimationDemo** (раздел 4–5): выборка из смеси (n=300, seed, «Новая выборка»), таблица 4 комбинаций ψ∈{Huber 1.5, Bisquare 4.685} × ρ_scale∈{Bisquare 1.54764, Clipped quadratic 2} с найденными μ̂ и σ̂ (b калибруется по модели, `expect`), анимация чередования шагов «μ-шаг / σ-шаг» для выбранной комбинации (trace из `jointM`): график μ_k, σ_k по итерациям. Ниже табличка асимптотик `V_σ` (bisquare 0.812; clipped 0.636) и слова: «меньше V — оценка точнее; вывод верен для этой смеси и этих c».
- Критерии как в ROB2a.

## ROB3. Текст главы — `content(stats/robust-estimation): add chapter with notebook walkthrough`
Роль content-writer, Sonnet допустим (большой текст), дорожка stats. Ждёт только ROB-notebook.md, может работать параллельно с ROB1/ROB2 (сборка главы проходит после слияния демо). Владеешь: `content/stats/robust-estimation/index.svx`, `data/glossary/stats-robust-estimation.yaml`. **Не** добавляй главу в `content/stats/topic.yaml`.
- Прочитай `docs/CONTENT-GUIDE.md` целиком, соседнюю главу `content/stats/bootstrap-permutation/index.svx` (формат, `Level`/`Variant`, `Cite`, `Figure`, `Quiz`, `Callout`, id блоков), `docs/design-system.md` по необходимости.
- Frontmatter: `id: stats/robust-estimation`, `title: Робастные оценки и M-оценки`, `topic: stats`, `experimental: true`, `status: draft`, `prereqs: [stats/estimation-testing, stats/mle-fisher]`, `minutes` ~35, `labs: []`, `concepts` и `keywords` по смыслу; источники: Huber 1964 (Robust Estimation of a Location Parameter), Maronna–Martin–Yohai–Salibián-Barrera «Robust Statistics: Theory and Methods (with R)» 2nd ed. 2019, Huber–Ronchetti «Robust Statistics» 2nd ed. 2009, Hampel 1974 (The Influence Curve and Its Role in Robust Estimation), Beaton–Tukey 1974 (bisquare) — URL с DOI, только те, в которых уверен; `accessed: 2026-10-20`. Не выдумывай номера страниц и цитаты. Факты из ноутбука — это «наши расчёты в лабораторной», а не источник.
- Задача читателя: **понять суть и концепции**, а не получить конспект теории (формулы минимально, словами объясняя, что они говорят). Тон дружелюбный, но без воды. Структура по скелету гида; разделы-содержание:
  1. Идея: среднее ломается от одного выброса; робастность = ограниченное влияние. Понятия: выброс, функция влияния (influence function), точка пробоя (breakdown point), эффективность при нормальности.
  2. Интуиция: «голосование с ограниченным весом» — среднее есть решение Σ(x−μ)=0, M-оценка заменяет x−μ на ограниченную ψ; вес наблюдения w=ψ(u)/u; IRLS как «пересчитывай веса и средневзвешенное». Демо `<ScaleEstimatorsDemo />` (в разделе про масштаб), `<PsiFunctionsDemo />`, `<IrlsDemo />` — каждое в `<Figure id caption alt>` с «Что заметить».
  3. Масштаб: MAD, MADN (константа 1/Φ⁻¹(0.75)=1.4826), IQRN, зачем делить на σ, свойства сдвига/масштаба `S(aX+d)=|a|S(X)`, M-оценка масштаба (bisquare ρ, уравнение mean ρ(·/s)=b, выбор b). Почему «нормальная» нормировка работает только при нормальных данных (несостоятельность: MADN→0.828σ), как калибровать под модель (делить на q_F(0.75), брать b_F=E_Fρ(U)).
  4. M-оценка положения: ψ Хубера и Tukey bisquare, выпуклость и локальные минимумы (старт из медианы), асимптотическая дисперсия `σ²/n · Eψ²/(Eψ')²` словами и формулой, эффективность, выбор c (1.345 и 4.685 — 95% эффективность при нормали; в смеси ноутбука оптимумы c≈1.5 и ≈4.685). Демо `<LocationEfficiencyDemo />`.
  5. Совместное оценивание μ и σ: система двух уравнений, почему в симметричной модели оценки асимптотически ортогональны (σ̂ не добавляет слагаемого первого порядка в Avar(μ̂)), clipped quadratic ρ как альтернатива. Демо `<JointEstimationDemo />`; демо `<MixtureCalibrationDemo />` в разделе «Разбор нашей лабораторной».
  6. **Разбор нашей лабораторной** (раздел `## Разбор лабораторной {#lab-walkthrough}`): по шагам ноутбука (модель: смесь N и 2·T₃ при ε=0.05 с нормировкой Var=1; сравнение MADN/IQRN/M-scale; сдвиг/масштаб; MC-состоятельность; калибровка; выбор ψ; IRLS; MC для V_μ; совместное оценивание; выбор clipped quadratic) — что делали, зачем, что получилось, **с числами из `tasks/ROB-notebook.md`** (таблицы: хвосты, калибровочная, MC-средние при n=50…1000, V_μ по сетке c, MC vs теория, V_σ; итог выбора: bisquare(4.685) для μ и clipped quadratic(2) для σ; Huber(1.5) как простая альтернатива). Фрагменты кода из ноутбука приводи короткими блоками ` ```python ` (IRLS, M-scale; не более ~25 строк на блок; адаптируй, но не меняй смысл), к ним пояснения. Честно отметить ограничения: выводы про лучший ρ_scale справедливы для этой смеси и этих c; согласие теории и MC приближённое (эмпирическое V_μ≈0.689 при теории 0.717–0.724 в совместном эксперименте). Не упоминай имена студентов и ссылку на чат; пиши «наша лабораторная».
  7. Частые ошибки (в т.ч. «MADN без калибровки на тяжёлых хвостах», «bisquare со старта из среднего», «робастная ≠ всегда лучше: при чистой нормали теряем эффективность», «c подбирают по эффективности, но не по выбросам»), Когда применять (таблица), Проверь себя (3–4 `Quiz`), Источники.
- Уровни по гиду: c=1 — слова и картинки без формул; c=2 — основные определения и одна ключевая формула; c=3 — полная нотация и вывод; c=4 — варианты, пробой, ограничения (брекдаун M-оценок положения 50% при монотонном ψ и известном σ; Hampel; S-/MM-оценки как продолжение — коротко, с оговоркой, что вне ноутбука). d=2 — код (блоки из ноутбука). `Variant`/`Level` как в соседних главах, «вниз по уровням» без ссылок на более глубокие термины.
- Глоссарий: новые термины главы (робастность, выброс — уже есть `outlier`, проверь; функция влияния, точка пробоя, M-оценка, MAD, ψ-функция, вес наблюдения, IRLS, масштаб (scale), эффективность) в `data/glossary/stats-robust-estimation.yaml` по формату `data/glossary/stats-estimation-testing.yaml`, `chapter: stats/robust-estimation`. Не дублируй id, которые уже есть в других файлах глоссария (проверь `grep`). `concepts` во frontmatter — только свои термины.
- Критерии: `npm run check` (ошибки контент-линтера — исправить), `npm run build` проходит только после слияния демо (если демо-файлов нет в worktree, сборку не запускай, а `npm run check` без неё; напиши это в отчёте). Все `{#id}` kebab-case и уникальны; каждый `supports` указывает на существующий блок.
