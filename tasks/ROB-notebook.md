# Выжимка ноутбука лабораторной №1 (формулы, код, выводы ячеек)

Для пакетов ROB*. Ячейки подряд: markdown, code и OUT. Служебный файл, удаляется после слияния главы.

--- cell 0 markdown
# Лабораторная работа № 1
## Робастные оценки масштаба и положения

Рассматривается модель
$$
X_i=\mu+\sigma U_i,
$$
где распределение ошибок задаётся смесью
$$
F_U=(1-\varepsilon)F_{\text{usual}}+\varepsilon F_{\text{outlier}}.
$$

В работе сравниваются робастные оценки масштаба MAD, IQR и M-scale, а затем M-оценки параметра положения. Все теоретические результаты дополнительно проверяются на моделируемых выборках.

Распределение $U$ нормируется так, чтобы $\mathbb E U=0$ и $\operatorname{Var}(U)=1$. Поэтому $\sigma$ в этой модели совпадает со стандартным отклонением $X_i$.
--- cell 1 markdown
## 1. Выбор распределения

Возьмём
$$
W\sim (1-\varepsilon)N(0,1)+\varepsilon(2T_3),
\qquad \varepsilon=0.05,
$$
где $T_3$ имеет распределение Стьюдента с тремя степенями свободы. Обе компоненты симметричны, но вторая имеет тяжёлые хвосты.

Так как $\operatorname{Var}(T_3)=3$, то
$$
C^2=\operatorname{Var}(W)=0.95\cdot1+0.05\cdot 2^2\cdot3=1.55.
$$
Положим $U=W/C$. Тогда
$$
F_{\text{usual}}=N\!\left(0,\frac1{C^2}\right),
\qquad
F_{\text{outlier}}=\text{распределение величины }\frac2C T_3,
$$
и $\operatorname{Var}(U)=1$.

В экспериментах используем $\mu=2$ и $\sigma=3$. Эти значения нужны только для наглядности и численной проверки
--- cell 2 code
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats, optimize, integrate
from IPython.display import display

SEED = 142
EPS = 0.05
DF = 3
OUTLIER_RAW_SCALE = 2.0

MU = 2.0
SIGMA = 3.0

# Нормировка Var(U)=1
C2 = (1 - EPS) * 1.0 + EPS * OUTLIER_RAW_SCALE**2 * DF / (DF - 2)
C = np.sqrt(C2)
USUAL_SD = 1.0 / C
OUTLIER_SCALE = OUTLIER_RAW_SCALE / C


def mix_pdf(x):
    x = np.asarray(x)
    return ((1 - EPS) * stats.norm.pdf(x, scale=USUAL_SD)
            + EPS * stats.t.pdf(x / OUTLIER_SCALE, df=DF) / OUTLIER_SCALE)


def mix_cdf(x):
    x = np.asarray(x)
    return ((1 - EPS) * stats.norm.cdf(x, scale=USUAL_SD)
            + EPS * stats.t.cdf(x / OUTLIER_SCALE, df=DF))


def sample_u(n, rng):
    u = rng.normal(loc=0.0, scale=USUAL_SD, size=n)
    is_outlier = rng.random(n) < EPS
    u[is_outlier] = rng.standard_t(DF, size=is_outlier.sum()) * OUTLIER_SCALE
    return u


def sample_x(n, rng, mu=MU, sigma=SIGMA):
    return mu + sigma * sample_u(n, rng)


model_table = pd.DataFrame({
    "quantity": ["epsilon", "C^2 = Var(W)", "sd usual component", "scale of t_3 outlier", "Var(U)"],
    "value": [EPS, C2, USUAL_SD, OUTLIER_SCALE,
              (1-EPS)*USUAL_SD**2 + EPS*OUTLIER_SCALE**2*DF/(DF-2)]
})
display(model_table.round(6))

def style_axes(ax, title, xlabel, ylabel, legend_cols=1):
    """Единое оформление осей; масштабы и эталоны задаются в графике."""
    ax.set(title=title, xlabel=xlabel, ylabel=ylabel)
    ax.set_axisbelow(True)
    ax.grid(True, which="major", alpha=0.25, linewidth=0.7)
    ax.spines[["top", "right"]].set_visible(False)
    handles, labels = ax.get_legend_handles_labels()
    if handles:
        ax.legend(handles, labels, ncol=legend_cols, fontsize=9)

OUT-DATA:                quantity     value
0               epsilon  0.050000
1          C^2 = Var(W)  1.550000
2    sd usual component  0.803219
3  scale of t_3 outlier  1.606439
4                Var(U)  1.000000
--- cell 3 code
# Насколько тяжелее хвосты, чем у N(0,1)?
ks = np.array([2.0, 3.0, 5.0])
tail_mix = 2 * (1 - mix_cdf(ks))
tail_norm = 2 * (1 - stats.norm.cdf(ks))

tail_table = pd.DataFrame({
    "k": ks,
    "P_mix(|U| > k)": tail_mix,
    "P_N(0,1)(|Z| > k)": tail_norm,
    "ratio": tail_mix / tail_norm
})
display(tail_table.round({
    "k": 1,
    "P_mix(|U| > k)": 8,
    "P_N(0,1)(|Z| > k)": 8,
    "ratio": 1,
}))

xx = np.linspace(-5, 5, 1500)
fig, axes = plt.subplots(1, 2, figsize=(12, 4.8), constrained_layout=True)
for ax in axes:
    ax.plot(xx, mix_pdf(xx), label="Смесь $F_U$")
    ax.plot(xx, stats.norm.pdf(xx), linestyle="--", label="$N(0,1)$")
axes[1].set_yscale("log")
style_axes(axes[0], "Плотность U: центральная часть",
           r"$u=(x-\mu)/\sigma$", r"Плотность $f_U(u)$")
style_axes(axes[1], "Та же плотность: хвосты в логарифмической шкале",
           r"$u=(x-\mu)/\sigma$", r"Плотность $f_U(u)$ (лог. шкала)")
plt.show()

OUT-DATA:      k  P_mix(|U| > k)  P_N(0,1)(|Z| > k)   ratio
0  2.0        0.027213       4.550026e-02     0.6
1  3.0        0.008111       2.699800e-03     3.0
2  5.0        0.002639       5.700000e-07  4603.1
OUT-DATA: <Figure size 1200x480 with 2 Axes>
--- cell 4 markdown
### Что видно по выбранной модели

В таблице вероятность $|U|>2$ у смеси меньше нормальной, а при порогах 3 и 5 - больше (отношения около 0.6, 3.0 и 4603.1 соответственно). Для $X$ эти пороги означают расстояния $2\sigma$, $3\sigma$ и $5\sigma$ от $\mu$.

На левом графике видна компактная центральная часть; на правом показана та же плотность в логарифмической шкале, позволяющей различить хвосты. Ордината здесь - плотность, а не хвостовая вероятность из таблицы.

Такая модель удобна для проверки робастных оценок: основная масса наблюдений компактна, но иногда появляются очень большие значения.
--- cell 5 markdown
## 2. Оценки масштаба

### 2.1. Определения

Пусть $m_n$ - выборочная медиана, а $q_p$ - выборочная квантиль уровня $p$. Рассмотрим
$$
\operatorname{MADN}=\frac{\operatorname{med}|X_i-m_n|}{\Phi^{-1}(0.75)},
\qquad
\operatorname{IQRN}=\frac{q_{0.75}-q_{0.25}}{2\Phi^{-1}(0.75)}.
$$
Обе нормировки стандартны для нормального распределения, но для выбранной смеси их состоятельность нужно проверить отдельно.

В качестве третьей оценки возьмём M-scale с функцией Tukey bisquare
$$
\rho_c(u)=
\begin{cases}
1-\left(1-(u/c)^2\right)^3, & |u|<c,\\
1, & |u|\ge c.
\end{cases}
$$
Масштаб $s$ находится из уравнения
$$
\frac1n\sum_{i=1}^n\rho_c\!\left(\frac{X_i-m_n}{s}\right)=b.
$$
Для bisquare M-scale берём $c=1.54764$ - это $c$ дает $\mathbb E p_c(Z) = 0.5$ для $N(0,1)$.

### 2.2. Сдвиг и изменение масштаба

Для всех трёх оценок должно выполняться
$$
S(aX_1+d,\ldots,aX_n+d)=|a|S(X_1,\ldots,X_n).
$$
Для MAD и IQR это следует непосредственно из определения. Для M-scale центр должен быть оценкой положения, обладающей такими свойствами; здесь используется медиана. Поскольку $\rho$ чётная, знак $a$ на решение не влияет.
--- cell 6 markdown
### 2.3. Состоятельность

Для симметричного непрерывного распределения $F$ с медианой 0
$$
\operatorname{med}|U|=q_F(0.75),
\qquad
q_F(0.75)-q_F(0.25)=2q_F(0.75).
$$
Поэтому для $X=\mu+\sigma U$
$$
\operatorname{MADN},\operatorname{IQRN}
\xrightarrow{p}
\sigma\frac{q_F(0.75)}{\Phi^{-1}(0.75)}.
$$
В выбранной смеси этот предел не равен $\sigma$. Исправленные оценки имеют вид
$$
\operatorname{MAD}_F=\frac{\operatorname{med}|X_i-m_n|}{q_F(0.75)},
\qquad
\operatorname{IQR}_F=\frac{q_{0.75}-q_{0.25}}{2q_F(0.75)}.
$$

Для M-scale при нормальной константе $b_N=\mathbb E\rho_c(Z)$ предел равен $s_*\sigma$, где
$$
\mathbb E_F\rho_c(U/s_*)=b_N.
$$
Чтобы оценка была состоятельной для нашей смеси, положим
$$
b_F=\mathbb E_F\rho_c(U).
$$
Тогда уравнение $\mathbb E\rho(\frac{X - \mu}{s}) = b$ имеет решение $s=\sigma$
--- cell 7 code
# Численная интеграция ожиданий относительно смеси

def mix_expect(func):
    part_n = integrate.quad(
        lambda z: func(z) * stats.norm.pdf(z, scale=USUAL_SD),
        -np.inf, np.inf, limit=250, epsabs=1e-10, epsrel=1e-9
    )[0]
    part_t = integrate.quad(
        lambda z: func(z) * stats.t.pdf(z / OUTLIER_SCALE, DF) / OUTLIER_SCALE,
        -np.inf, np.inf, limit=250, epsabs=1e-10, epsrel=1e-9
    )[0]
    return (1 - EPS) * part_n + EPS * part_t


def rho_bisquare(u, c):
    arr = np.asarray(u, dtype=float)
    z = arr / c
    out = np.ones_like(arr)
    mask = np.abs(z) < 1
    out[mask] = 1 - (1 - z[mask]**2)**3
    return float(out) if out.ndim == 0 else out


Q_N = stats.norm.ppf(0.75)
Q_F = optimize.brentq(lambda z: mix_cdf(z) - 0.75, 0.0, 10.0) #

C_SCALE = 1.54764
B_N = integrate.quad(
    lambda z: rho_bisquare(z, C_SCALE) * stats.norm.pdf(z),
    -np.inf, np.inf, limit=250
)[0]
B_F = mix_expect(lambda z: rho_bisquare(z, C_SCALE))

# Предел M-scale при ошибочной (нормальной) калибровке b_N
S_STAR_NORMAL_CAL = optimize.brentq(
    lambda s: mix_expect(lambda z: rho_bisquare(z / s, C_SCALE)) - B_N,
    0.05, 5.0
)

calibration_table = pd.DataFrame({
    "quantity": [
        "Phi^{-1}(0.75)", "q_F(0.75)",
        "limit MADN/sigma = limit IQRN/sigma",
        "b_N for bisquare M-scale", "b_F for mixture",
        "limit normal-calibrated M-scale / sigma"
    ],
    "value": [Q_N, Q_F, Q_F / Q_N, B_N, B_F, S_STAR_NORMAL_CAL]
})
display(calibration_table.round(8))
OUT-DATA:                                   quantity     value
0                           Phi^{-1}(0.75)  0.674490
1                                q_F(0.75)  0.558580
2      limit MADN/sigma = limit IQRN/sigma  0.828151
3                 b_N for bisquare M-scale  0.500001
4                          b_F for mixture  0.426796
5  limit normal-calibrated M-scale / sigma  0.829914
--- cell 8 code
# Реализация оценок масштаба

def mad_raw(x):
    x = np.asarray(x)
    med = np.median(x)
    return np.median(np.abs(x - med))


def iqr_raw(x):
    q1, q3 = np.quantile(x, [0.25, 0.75])
    return q3 - q1


def m_scale(x, c=C_SCALE, b=B_F, center=None):
    """
    M-scale: mean rho((x-center)/s)=b. rho монотонна по |u|,
    поэтому корень по s единственен в типичных выборках.
    """
    x = np.asarray(x, dtype=float)
    if center is None:
        center = np.median(x)
    r = np.abs(x - center)
    base = np.median(r)
    if base <= 1e-14:
        base = np.std(x)
    if base <= 1e-14:
        return 0.0

    f = lambda s: np.mean(rho_bisquare(r / s, c)) - b
    return optimize.brentq(f, base * 1e-5, base * 1e5, maxiter=200)


def all_scale_estimators(x):
    return {
        "MADN": mad_raw(x) / Q_N,
        "MAD calibrated": mad_raw(x) / Q_F,
        "IQRN": iqr_raw(x) / (2 * Q_N),
        "IQR calibrated": iqr_raw(x) / (2 * Q_F),
        "M-scale normal b": m_scale(x, c=C_SCALE, b=B_N),
        "M-scale calibrated": m_scale(x, c=C_SCALE, b=B_F),
    }
--- cell 9 code
# Численная проверка свойств S(aX+b)=|a|S(X)
rng = np.random.default_rng(SEED)
x0 = sample_x(300, rng)
a, shift = -2.3, 4.7
y0 = a * x0 + shift

s_x = all_scale_estimators(x0)
s_y = all_scale_estimators(y0)

eq_rows = []
for name in s_x:
    lhs = s_y[name]
    rhs = abs(a) * s_x[name]
    eq_rows.append((name, lhs, rhs, abs(lhs-rhs)))

eq_table = pd.DataFrame(eq_rows, columns=["estimator", "S(aX+b)", "|a|S(X)", "absolute error"])
eq_table["absolute error"] = eq_table["absolute error"].map(lambda value: f"{value:.2e}")
display(eq_table.round({"S(aX+b)": 8, "|a|S(X)": 8}))
OUT-DATA:             estimator   S(aX+b)   |a|S(X) absolute error
0                MADN  6.204938  6.204938       0.00e+00
1      MAD calibrated  7.492516  7.492516       0.00e+00
2                IQRN  6.168059  6.168059       8.88e-16
3      IQR calibrated  7.447985  7.447985       8.88e-16
4    M-scale normal b  6.043969  6.043969       8.88e-16
5  M-scale calibrated  7.314912  7.314912       8.88e-16
--- cell 10 markdown
Разница между левой и правой частями находится на уровне численной погрешности, то есть свойство подтверждается
--- cell 11 code
# Монте-Карло: состоятельность оценок масштаба
R_SCALE = 400
N_GRID = [50, 100, 300, 1000]
rng = np.random.default_rng(SEED + 1)

records = []
for n in N_GRID:
    storage = {name: [] for name in all_scale_estimators(sample_x(30, rng)).keys()}
    for _ in range(R_SCALE):
        x = sample_x(n, rng)
        est = all_scale_estimators(x)
        for name, value in est.items():
            storage[name].append(value)

    for name, values in storage.items():
        values = np.asarray(values)
        records.append({
            "n": n,
            "estimator": name,
            "mean": values.mean(),
            "bias": values.mean() - SIGMA,
            "sd": values.std(ddof=1),
            "rmse": np.sqrt(np.mean((values - SIGMA)**2))
        })

scale_mc = pd.DataFrame(records)
display(scale_mc.round({
    "mean": 4, "bias": 4, "sd": 4, "rmse": 4,
}))
OUT-DATA:        n           estimator    mean    bias      sd    rmse
0     50                MADN  2.4542 -0.5458  0.4287  0.6937
1     50      MAD calibrated  2.9634 -0.0366  0.5176  0.5183
2     50                IQRN  2.4329 -0.5671  0.4082  0.6984
3     50      IQR calibrated  2.9377 -0.0623  0.4929  0.4962
4     50    M-scale normal b  2.4532 -0.5468  0.3595  0.6541
5     50  M-scale calibrated  2.9652 -0.0348  0.3995  0.4005
6    100                MADN  2.4583 -0.5417  0.2898  0.6142
7    100      MAD calibrated  2.9685 -0.0315  0.3500  0.3510
8    100                IQRN  2.4433 -0.5567  0.2903  0.6277
9    100      IQR calibrated  2.9503 -0.0497  0.3506  0.3536
10   100    M-scale normal b  2.4597 -0.5403  0.2406  0.5914
11   100  M-scale calibrated  2.9716 -0.0284  0.2649  0.2661
12   300                MADN  2.4798 -0.5202  0.1657  0.5459
13   300      MAD calibrated  2.9944 -0.0056  0.2000  0.1999
14   300                IQRN  2.4734 -0.5266  0.1660  0.5521
15   300      IQR calibrated  2.9866 -0.0134  0.2004  0.2006
16   300    M-scale normal b  2.4801 -0.5199  0.1390  0.5381
17   300  M-scale calibrated  2.9893 -0.0107  0.1534  0.1536
18  1000                MADN  2.4860 -0.5140  0.0952  0.5228
19  1000      MAD calibrated  3.0018  0.0018  0.1150  0.1148
20  1000                IQRN  2.4847 -0.5153  0.0929  0.5236
21  1000      IQR calibrated  3.0003  0.0003  0.1122  0.1121
22  1000    M-scale normal b  2.4916 -0.5084  0.0785  0.5144
23  1000  M-scale calibrated  3.0027  0.0027  0.0866  0.0866
--- cell 12 code
# Средние берутся непосредственно из таблицы scale_mc, без дополнительной нормировки
fig, ax = plt.subplots(figsize=(11, 6), constrained_layout=True)
styles = {
    "MADN": ("C0", "--", "o"), "MAD calibrated": ("C0", "-", "o"),
    "IQRN": ("C1", "--", "s"), "IQR calibrated": ("C1", "-", "s"),
    "M-scale normal b": ("C2", "--", "^"), "M-scale calibrated": ("C2", "-", "^"),
}
for name, grp in scale_mc.groupby("estimator"):
    color, linestyle, marker = styles[name]
    ax.plot(grp["n"], grp["mean"], color=color, linestyle=linestyle,
            marker=marker, label=name)
ax.axhline(SIGMA, color="black", linestyle=":", linewidth=1.5,
           label=fr"Истинный масштаб $\sigma={SIGMA:g}$")
ax.axhline(SIGMA * Q_F / Q_N, color="C0", linestyle=":", linewidth=1.3,
           label=r"Предел MADN, IQRN: $\sigma q_F(0.75)/q_N(0.75)$")
ax.axhline(SIGMA * S_STAR_NORMAL_CAL, color="C2", linestyle="-.", linewidth=1.3,
           label=r"Предел M-scale с $b_N$: $\sigma s_*$")
ax.set_xscale("log")
ax.set_xticks(N_GRID, labels=[str(n) for n in N_GRID])
style_axes(ax, f"Средние оценки масштаба: {R_SCALE} повторов для каждого n",
           "Объём выборки n (логарифмическая шкала)",
           "Средняя оценка масштаба (в единицах X)")
ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.19), ncol=2, fontsize=9)
plt.show()

OUT-DATA: <Figure size 1100x600 with 1 Axes>
--- cell 13 markdown
### Выбор оценки масштаба

Из таблицы и графика видно следующее:

- MADN и IQRN с нормальными константами сходятся не к $\sigma$, а примерно к $0.828\sigma$;
- M-scale с нормальной калибровкой имеет почти такой же неверный предел, около $0.830\sigma$;
- после калибровки по $F_U$ средние оценки приближаются к $\sigma$, а SD и RMSE уменьшаются при росте n; это согласуется с теоретической состоятельностью;
- в данном эксперименте калиброванная bisquare M-scale даёт наименьший RMSE.

Дальше используем калиброванную bisquare M-scale с $c=1.54764$ и $b=b_F$.
--- cell 14 markdown
## 3. M-оценки параметра положения

При фиксированном масштабе M-оценка положения решает уравнение
$$
\sum_{i=1}^n\psi\!\left(\frac{X_i-\hat\mu}{\hat\sigma}\right)=0.
$$
Сравним две функции.

Для оценки Хубера
$$
\psi_c(u)=
\begin{cases}
-c,&u<-c,\\
u,&|u|\le c,\\
c,&u>c.
\end{cases}
$$
Большие остатки ограничиваются по модулю, а задача остаётся выпуклой.

Для Tukey bisquare
$$
\psi_c(u)=u\left(1-(u/c)^2\right)^2\mathbf 1\{|u|<c\}.
$$
Очень большие остатки получают нулевой вес. Эта функция сильнее защищает от выбросов, но может иметь несколько локальных решений, поэтому в алгоритме стартуем из медианы.

Если $\hat\sigma\xrightarrow{p}\sigma$, то
$$
\operatorname{Avar}(\hat\mu)
=\frac{\sigma^2}{n}
\frac{\mathbb E\psi^2(U)}{\left(\mathbb E\psi'(U)\right)^2}.
$$
В симметричной модели оценивание масштаба не добавляет слагаемого первого порядка: $\mathbb E[U\psi'(U)]=0$.
--- cell 15 code
# psi и производные

def psi_huber(u, c):
    return np.clip(u, -c, c)


def dpsi_huber(u, c):
    arr = np.asarray(u)
    out = (np.abs(arr) < c).astype(float)
    return float(out) if out.ndim == 0 else out


def psi_bisquare(u, c):
    arr = np.asarray(u, dtype=float)
    z = arr / c
    out = np.zeros_like(arr)
    mask = np.abs(z) < 1
    out[mask] = arr[mask] * (1 - z[mask]**2)**2
    return float(out) if out.ndim == 0 else out


def dpsi_bisquare(u, c):
    arr = np.asarray(u, dtype=float)
    z = arr / c
    out = np.zeros_like(arr)
    mask = np.abs(z) < 1
    out[mask] = (1 - z[mask]**2) * (1 - 5*z[mask]**2)
    return float(out) if out.ndim == 0 else out


def location_asymptotic_factor(kind, c):
    if kind == "Huber":
        e_psi2 = mix_expect(lambda z: psi_huber(z, c)**2)
        e_dpsi = mix_expect(lambda z: dpsi_huber(z, c))
    elif kind == "Bisquare":
        e_psi2 = mix_expect(lambda z: psi_bisquare(z, c)**2)
        e_dpsi = mix_expect(lambda z: dpsi_bisquare(z, c))
    else:
        raise ValueError(kind)
    return e_psi2 / e_dpsi**2


huber_cs = [0.8, 1.0, 1.2, 1.345, 1.5, 2.0, 3.0]
bisq_cs = [2.0, 2.5, 3.0, 3.5, 4.0, 4.685, 6.0]

loc_rows = []
for c in huber_cs:
    loc_rows.append(("Huber", c, location_asymptotic_factor("Huber", c)))
for c in bisq_cs:
    loc_rows.append(("Bisquare", c, location_asymptotic_factor("Bisquare", c)))

loc_av = pd.DataFrame(loc_rows, columns=["psi", "c", "V_mu"])
loc_av["efficiency_vs_mean"] = 1.0 / loc_av["V_mu"]
display(loc_av.round({"c": 3, "V_mu": 6, "efficiency_vs_mean": 3}))
OUT-DATA:          psi      c      V_mu  efficiency_vs_mean
0      Huber  0.800  0.769102               1.300
1      Huber  1.000  0.744303               1.344
2      Huber  1.200  0.730590               1.369
3      Huber  1.345  0.725863               1.378
4      Huber  1.500  0.724450               1.380
5      Huber  2.000  0.735337               1.360
6      Huber  3.000  0.776571               1.288
7   Bisquare  2.000  1.073196               0.932
8   Bisquare  2.500  0.865092               1.156
9   Bisquare  3.000  0.779247               1.283
10  Bisquare  3.500  0.741459               1.349
11  Bisquare  4.000  0.724620               1.380
12  Bisquare  4.685  0.716601               1.395
13  Bisquare  6.000  0.719511               1.390
--- cell 16 code
fig, ax = plt.subplots(figsize=(9, 5), constrained_layout=True)
for kind, grp in loc_av.groupby("psi"):
    ax.plot(grp["c"], grp["V_mu"], marker="o", label=kind)
ax.axhline(1.0, color="black", linestyle="--",
           label=r"Выборочное среднее: $V_\mu=1$")
style_axes(ax, "Фактор асимптотической дисперсии положения: заданная сетка c",
           "Параметр c (для стандартизованных остатков, безразмерный)",
           r"$V_\mu \approx n\,\mathrm{Avar}(\hat\mu)/\sigma^2$ (безразмерный)")
plt.show()

OUT-DATA: <Figure size 900x500 with 1 Axes>
--- cell 17 markdown
На выбранной сетке минимум для Хубера достигается около $c=1.5$, а для bisquare - около $c=4.685$. Значение $V_\mu<1$ не является ошибкой: среднее эффективно при нормальном распределении, а здесь распределение имеет другую форму

Немного меньшую дисперсию даёт bisquare с $c=4.685$, поэтому его и выберем. Хубер с $c=1.5$ остаётся почти столь же эффективной и более простой альтернативой
--- cell 18 code
# IRLS для M-оценки положения при фиксированном масштабе

def m_location_irls(x, scale, kind="Huber", c=1.5, start=None, tol=1e-10, maxiter=200):
    x = np.asarray(x, dtype=float)
    m = np.median(x) if start is None else float(start)

    for _ in range(maxiter):
        u = (x - m) / scale
        if kind == "Huber":
            w = np.ones_like(u)
            mask = np.abs(u) > 1e-14
            w[mask] = psi_huber(u[mask], c) / u[mask]
        elif kind == "Bisquare":
            z = u / c
            w = np.zeros_like(u)
            mask = np.abs(z) < 1
            w[mask] = (1 - z[mask]**2)**2
        else:
            raise ValueError(kind)

        sw = w.sum()
        if sw <= 1e-14:
            return m
        m_new = np.sum(w * x) / sw
        if abs(m_new - m) <= tol * max(scale, 1.0):
            return float(m_new)
        m = m_new
    return float(m)


# Monte-Carlo проверка асимптотических дисперсий с оценённым scale
R_LOC = 800
N_LOC = 500
rng = np.random.default_rng(SEED + 2)

loc_store = {"Mean": [], "Median": [], "Huber c=1.5": [], "Bisquare c=4.685": []}
for _ in range(R_LOC):
    x = sample_x(N_LOC, rng)
    s_hat = m_scale(x, c=C_SCALE, b=B_F)
    loc_store["Mean"].append(np.mean(x))
    loc_store["Median"].append(np.median(x))
    loc_store["Huber c=1.5"].append(m_location_irls(x, s_hat, "Huber", 1.5))
    loc_store["Bisquare c=4.685"].append(m_location_irls(x, s_hat, "Bisquare", 4.685))

# Теоретические факторы
f0 = mix_pdf(0.0)
theory_factor = {
    "Mean": 1.0,
    "Median": 1.0 / (4 * f0**2),
    "Huber c=1.5": location_asymptotic_factor("Huber", 1.5),
    "Bisquare c=4.685": location_asymptotic_factor("Bisquare", 4.685),
}

loc_mc_rows = []
for name, values in loc_store.items():
    values = np.asarray(values)
    loc_mc_rows.append({
        "estimator": name,
        "bias": values.mean() - MU,
        "rmse": np.sqrt(np.mean((values - MU)**2)),
        "empirical n*Var/sigma^2": N_LOC * values.var(ddof=1) / SIGMA**2,
        "theory factor": theory_factor[name]
    })

loc_mc = pd.DataFrame(loc_mc_rows)
display(loc_mc.round({
    "bias": 5, "rmse": 5,
    "empirical n*Var/sigma^2": 5, "theory factor": 5,
}))
OUT-DATA:           estimator     bias     rmse  empirical n*Var/sigma^2  theory factor
0              Mean -0.00295  0.13581                  1.02548        1.00000
1            Median -0.00134  0.14016                  1.09261        1.07037
2       Huber c=1.5 -0.00301  0.11511                  0.73651        0.72445
3  Bisquare c=4.685 -0.00350  0.11397                  0.72184        0.71660
--- cell 19 markdown
Эмпирические значения $n\operatorname{Var}(\hat\mu)/\sigma^2$ близки к теоретическим: для Huber 0.73651 против 0.72445, для bisquare 0.72184 против 0.71660. Расхождения совместимы с конечными n и числом повторов.

Для дальнейших расчётов выбираем Tukey bisquare с $c=4.685$.
--- cell 20 markdown
## 4. Одновременное оценивание $\mu$ и $\sigma$

Теперь решаем систему
$$
\begin{cases}
\displaystyle \frac1n\sum_{i=1}^n
\psi\!\left(\frac{X_i-\mu}{\sigma}\right)=0,\\[1.2ex]
\displaystyle \frac1n\sum_{i=1}^n
\rho_s\!\left(\frac{X_i-\mu}{\sigma}\right)-b_s=0.
\end{cases}
$$
Для каждой функции масштаба берём $b_s=\mathbb E_F\rho_s(U)$, чтобы истинное $\sigma$ было решением уравнения $\mathbb E\rho_с(\frac{X - \mu}{s}) = b$

В симметричной модели location- и scale-уравнения асимптотически ортогональны: нечётные смешанные ожидания равны нулю. Поэтому
$$
\operatorname{Avar}(\hat\mu)\approx\frac{\sigma^2V_\mu}{n},
\qquad
V_\mu=\frac{\mathbb E\psi^2(U)}{(\mathbb E\psi'(U))^2},
$$
$$
\operatorname{Avar}(\hat\sigma)\approx\frac{\sigma^2V_\sigma}{n},
\qquad
V_\sigma=\frac{\operatorname{Var}(\rho_s(U))}
{(\mathbb E[U\rho_s'(U)])^2}.
$$
--- cell 21 markdown
## 5. Сравнение функций $\psi$ и $\rho_{\text{scale}}$

Для положения сравним Huber($1.5$) и Tukey bisquare($4.685$).

Для масштаба возьмём:

1. Tukey bisquare с $c=1.54764$;
2. clipped quadratic
$$
\rho_{c}(u)=\min\{(u/c)^2,1\}
$$
с $c=2$.

Обе функции масштаба калибруются по выбранному распределению $F_U$.
--- cell 22 code
# Производные scale-rho и альтернативная clipped-quadratic rho

def drho_bisquare(u, c):
    arr = np.asarray(u, dtype=float)
    z = arr / c
    out = np.zeros_like(arr)
    mask = np.abs(z) < 1
    out[mask] = 6 * arr[mask] / c**2 * (1 - z[mask]**2)**2
    return float(out) if out.ndim == 0 else out


def rho_clip(u, c):
    arr = np.asarray(u, dtype=float)
    out = np.minimum((arr / c)**2, 1.0)
    return float(out) if out.ndim == 0 else out


def drho_clip(u, c):
    arr = np.asarray(u, dtype=float)
    out = np.zeros_like(arr)
    mask = np.abs(arr) < c
    out[mask] = 2 * arr[mask] / c**2
    return float(out) if out.ndim == 0 else out


def scale_asymptotic_info(kind, c):
    if kind == "Bisquare":
        rho, drho = rho_bisquare, drho_bisquare
    elif kind == "Clipped quadratic":
        rho, drho = rho_clip, drho_clip
    else:
        raise ValueError(kind)

    b = mix_expect(lambda z: rho(z, c))
    var_rho = mix_expect(lambda z: (rho(z, c) - b)**2)
    denom = mix_expect(lambda z: z * drho(z, c))
    factor = var_rho / denom**2
    return b, factor


scale_options = [
    ("Bisquare", 1.54764),
    ("Clipped quadratic", 2.0),
]
scale_theory_rows = []
for kind, c in scale_options:
    b, factor = scale_asymptotic_info(kind, c)
    scale_theory_rows.append((kind, c, b, factor))

scale_theory = pd.DataFrame(scale_theory_rows, columns=["rho_scale", "c", "b_F", "V_sigma"])
display(scale_theory.round({"c": 5, "b_F": 6, "V_sigma": 6}))
OUT-DATA:            rho_scale        c       b_F   V_sigma
0           Bisquare  1.54764  0.426796  0.812193
1  Clipped quadratic  2.00000  0.173965  0.635925
--- cell 23 markdown
Для выбранной смеси clipped quadratic с $c=2$ имеет меньший фактор асимптотической дисперсии масштаба. Это вывод только для рассматриваемой модели и заданных значений $c$; при другой доле или форме выбросов результат может измениться.
--- cell 24 code
# Универсальный scale-root для совместного алгоритма

def scale_root_given_center(x, center, rho_kind, c, b):
    x = np.asarray(x, dtype=float)
    r = x - center
    base = np.median(np.abs(r))
    if base <= 1e-14:
        base = np.std(x)
    if base <= 1e-14:
        return 0.0

    if rho_kind == "Bisquare":
        rho = rho_bisquare
    elif rho_kind == "Clipped quadratic":
        rho = rho_clip
    else:
        raise ValueError(rho_kind)

    f = lambda s: np.mean(rho(r / s, c)) - b
    return optimize.brentq(f, base * 1e-5, base * 1e5, maxiter=200)


def joint_m_estimator(x, psi_kind, c_loc, rho_kind, c_scale, b_scale,
                      tol=1e-9, maxiter=100):
    """Чередуем location- и scale-шаги. Старт: медиана + робастный scale-root."""
    x = np.asarray(x, dtype=float)
    m = np.median(x)
    s = scale_root_given_center(x, m, rho_kind, c_scale, b_scale)

    for _ in range(maxiter):
        m_new = m_location_irls(x, s, psi_kind, c_loc, start=m, tol=tol)
        s_new = scale_root_given_center(x, m_new, rho_kind, c_scale, b_scale)

        loc_ok = abs(m_new - m) <= tol * max(s, 1.0)
        scale_ok = abs(s_new - s) <= tol * max(s, 1.0)
        m, s = m_new, s_new
        if loc_ok and scale_ok:
            break
    return float(m), float(s)


# Калибровки двух scale-rho
B_BISQ = scale_asymptotic_info("Bisquare", 1.54764)[0]
B_CLIP = scale_asymptotic_info("Clipped quadratic", 2.0)[0]

# Пример на одной выборке
rng = np.random.default_rng(SEED + 3)
x_demo = sample_x(300, rng)

combos = [
    ("Huber", 1.5, "Bisquare", 1.54764, B_BISQ),
    ("Bisquare", 4.685, "Bisquare", 1.54764, B_BISQ),
    ("Huber", 1.5, "Clipped quadratic", 2.0, B_CLIP),
    ("Bisquare", 4.685, "Clipped quadratic", 2.0, B_CLIP),
]

demo_rows = []
for psi_kind, c_loc, rho_kind, c_scale, b_scale in combos:
    m_hat, s_hat = joint_m_estimator(x_demo, psi_kind, c_loc, rho_kind, c_scale, b_scale)
    demo_rows.append((psi_kind, c_loc, rho_kind, c_scale, m_hat, s_hat))

demo = pd.DataFrame(demo_rows, columns=["psi", "c_loc", "rho_scale", "c_scale", "mu_hat", "sigma_hat"])
display(demo.round({"c_loc": 3, "c_scale": 5, "mu_hat": 4, "sigma_hat": 4}))
OUT-DATA:         psi  c_loc          rho_scale  c_scale  mu_hat  sigma_hat
0     Huber  1.500           Bisquare  1.54764  1.9508     3.0473
1  Bisquare  4.685           Bisquare  1.54764  1.9457     3.0477
2     Huber  1.500  Clipped quadratic  2.00000  1.9508     3.0689
3  Bisquare  4.685  Clipped quadratic  2.00000  1.9457     3.0689
--- cell 25 code
# Monte-Carlo для совместной оценки параметров: одни и те же выборки для всех комбинаций
R_JOINT = 1000
N_JOINT = 500
rng = np.random.default_rng(SEED + 4)

combo_names = []
for psi_kind, c_loc, rho_kind, c_scale, b_scale in combos:
    combo_names.append(f"{psi_kind}({c_loc:g}) + {rho_kind}({c_scale:g})")

joint_store = {name: {"mu": [], "sigma": []} for name in combo_names}

for _ in range(R_JOINT):
    x = sample_x(N_JOINT, rng)
    for name, (psi_kind, c_loc, rho_kind, c_scale, b_scale) in zip(combo_names, combos):
        m_hat, s_hat = joint_m_estimator(x, psi_kind, c_loc, rho_kind, c_scale, b_scale)
        joint_store[name]["mu"].append(m_hat)
        joint_store[name]["sigma"].append(s_hat)

joint_rows = []
for name, vals in joint_store.items():
    mu_vals = np.asarray(vals["mu"])
    s_vals = np.asarray(vals["sigma"])

    if name.startswith("Huber"):
        v_mu = location_asymptotic_factor("Huber", 1.5)
    else:
        v_mu = location_asymptotic_factor("Bisquare", 4.685)

    if "Clipped" in name:
        v_s = scale_asymptotic_info("Clipped quadratic", 2.0)[1]
    else:
        v_s = scale_asymptotic_info("Bisquare", 1.54764)[1]

    joint_rows.append({
        "combination": name,
        "bias_mu": mu_vals.mean() - MU,
        "rmse_mu": np.sqrt(np.mean((mu_vals - MU)**2)),
        "emp V_mu": N_JOINT * mu_vals.var(ddof=1) / SIGMA**2,
        "theory V_mu": v_mu,
        "bias_sigma": s_vals.mean() - SIGMA,
        "rmse_sigma": np.sqrt(np.mean((s_vals - SIGMA)**2)),
        "emp V_sigma": N_JOINT * s_vals.var(ddof=1) / SIGMA**2,
        "theory V_sigma": v_s,
    })

joint_mc = pd.DataFrame(joint_rows)
display(joint_mc.round({
    "bias_mu": 4, "rmse_mu": 4, "emp V_mu": 4, "theory V_mu": 4,
    "bias_sigma": 4, "rmse_sigma": 4, "emp V_sigma": 4, "theory V_sigma": 4,
}))
OUT-DATA:                               combination  bias_mu  rmse_mu  emp V_mu  \
0          Huber(1.5) + Bisquare(1.54764)   0.0068   0.1116    0.6897   
1     Bisquare(4.685) + Bisquare(1.54764)   0.0061   0.1115    0.6890   
2       Huber(1.5) + Clipped quadratic(2)   0.0068   0.1116    0.6899   
3  Bisquare(4.685) + Clipped quadratic(2)   0.0061   0.1115    0.6888   

   theory V_mu  bias_sigma  rmse_sigma  emp V_sigma  theory V_sigma  
0       0.7244      0.0028      0.1210       0.8132          0.8122  
1       0.7166      0.0023      0.1209       0.8126          0.8122  
2       0.7244      0.0043      0.1057       0.6206          0.6359  
3       0.7166      0.0042      0.1057       0.6206          0.6359  
--- cell 26 markdown
### Результат совместного оценивания

У всех четырёх комбинаций абсолютные смещения малы по сравнению с RMSE. Эмпирические нормированные дисперсии положения находятся около 0.689 при теоретических 0.717–0.724; для масштаба - около 0.813 против 0.812 у bisquare и 0.621 против 0.636 у clipped quadratic. Согласование приближённое.

В этой симуляции смена $\psi$ мало меняет RMSE положения, а clipped quadratic заметно снижает RMSE масштаба. При показанной точности RMSE положения совпадает для двух вариантов bisquare, а RMSE масштаба - для двух вариантов clipped quadratic. Выбор Tukey bisquare($4.685$) и clipped quadratic($2$) согласуется с теоретическими факторами среди рассмотренных настроек.
--- cell 27 markdown
## Вывод

1. Для смеси с $5\%$ тяжёлохвостых наблюдений обычные нормировки MADN и IQRN несостоятельны: обе оценки сходятся примерно к $0.828\sigma$. M-scale с нормальной калибровкой сходится примерно к $0.830\sigma$.
2. После калибровки по выбранному $F_U$ все три оценки масштаба становятся состоятельными. В симуляциях раздела 2 при каждом рассмотренном n наименьший RMSE показала откалиброванная bisquare M-scale.
3. Для оценки $\mu$ из рассмотренных узлов сетки наименьшую асимптотическую дисперсию дала Tukey bisquare с $c=4.685$: $V_\mu\approx0.717$.
4. При совместном оценивании $\mu$ и $\sigma$ теоретические и эмпирические дисперсии приближённо согласуются. Для масштаба clipped quadratic с $c=2$ оказалась эффективнее выбранной bisquare-настройки: $V_\sigma\approx0.636$ против $0.812$.

Таким образом, для этой модели разумный итоговый выбор - bisquare($4.685$) для положения и clipped quadratic($2$) для масштаба. Если важнее простота и выпуклость задачи оценивания положения при фиксированном масштабе, можно взять Huber($1.5$) с небольшим увеличением теоретического фактора дисперсии в этой модели.
