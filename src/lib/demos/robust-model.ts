/**
 * Contaminated model for the robust-estimation lab:
 *   U = (1 - eps) * N(0, usualSd^2) + eps * outlierScale * T_df,
 * scaled so that Var(U) = 1 (C^2 = (1-eps) + eps * s^2 * df/(df-2), usualSd = 1/C,
 * outlierScale = s/C). Pure numerics: no DOM, no imports from robust-core.
 */

export interface MixtureParams {
	eps: number;
	df: number;
	outlierRawScale: number;
}

export interface Mixture {
	params: MixtureParams;
	c2: number;
	usualSd: number;
	outlierScale: number;
	pdf(x: number): number;
	cdf(x: number): number;
	quantile(p: number): number;
	sample(n: number, rng: () => number): Float64Array;
	sampleX(n: number, rng: () => number, mu: number, sigma: number): Float64Array;
	/** E f(U) by deterministic adaptive Gauss-Kronrod quadrature on [-L, L]; tail mass beyond L is < 1e-11. */
	expect(f: (u: number) => number): number;
	/** P(|U| > k) */
	tailProb(k: number): number;
}

const DEFAULTS: MixtureParams = { eps: 0.05, df: 3, outlierRawScale: 2 };
const FPMIN = 1e-300;
const TAIL_TARGET = 1e-11;
const SQRT2 = Math.SQRT2;

/* ---------- special functions ---------- */

const LANCZOS = [
	676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999385,
	12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Log-gamma, Lanczos approximation (g = 7), relative accuracy ~1e-15. */
function lgamma(z: number): number {
	if (z < 0.5) {
		return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
	}
	const zz = z - 1;
	let x = 0.99999999999980993;
	for (let i = 0; i < LANCZOS.length; i++) {
		x += (LANCZOS[i] ?? 0) / (zz + i + 1);
	}
	const t = zz + 7.5;
	return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized lower incomplete gamma P(a, x) by series (x < a + 1). */
function gammaPSeries(a: number, x: number): number {
	let ap = a;
	let sum = 1 / a;
	let del = sum;
	for (let n = 0; n < 1000; n++) {
		ap += 1;
		del *= x / ap;
		sum += del;
		if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
	}
	return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

/** Regularized upper incomplete gamma Q(a, x) by continued fraction (x >= a + 1). */
function gammaQCf(a: number, x: number): number {
	let b = x + 1 - a;
	let c = 1 / FPMIN;
	let d = 1 / b;
	let h = d;
	for (let i = 1; i < 1000; i++) {
		const an = -i * (i - a);
		b += 2;
		d = an * d + b;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = b + an / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-16) break;
	}
	return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

function gammaQ(a: number, x: number): number {
	if (x <= 0) return 1;
	return x < a + 1 ? 1 - gammaPSeries(a, x) : gammaQCf(a, x);
}

/** erfc(w) for w >= 0, via Q(1/2, w^2). */
function erfcPos(w: number): number {
	return gammaQ(0.5, w * w);
}

/** Standard normal CDF, accurate in both tails. */
function normalCdf(x: number): number {
	const z = x / SQRT2;
	return z >= 0 ? 1 - 0.5 * erfcPos(z) : 0.5 * erfcPos(-z);
}

/** Continued fraction for the regularized incomplete beta function (modified Lentz). */
function betaCf(a: number, b: number, x: number): number {
	const qab = a + b;
	const qap = a + 1;
	const qam = a - 1;
	let c = 1;
	let d = 1 - (qab * x) / qap;
	if (Math.abs(d) < FPMIN) d = FPMIN;
	d = 1 / d;
	let h = d;
	for (let m = 1; m <= 1000; m++) {
		const m2 = 2 * m;
		let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = 1 + aa / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		h *= d * c;
		aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = 1 + aa / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-16) break;
	}
	return h;
}

/** Regularized incomplete beta I_x(a, b). */
function betaI(a: number, b: number, x: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	const bt = Math.exp(
		lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x),
	);
	if (x < (a + 1) / (a + b + 2)) return (bt * betaCf(a, b, x)) / a;
	return 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

/** P(|T| > t) for Student-t with df degrees of freedom, t >= 0. */
function tTwoSided(t: number, df: number): number {
	return betaI(df / 2, 0.5, df / (df + t * t));
}

function tCdf(t: number, df: number): number {
	const tail = 0.5 * tTwoSided(t, df);
	return t >= 0 ? 1 - tail : tail;
}

function tPdfStd(z: number, df: number, k: number): number {
	return k * Math.pow(1 + (z * z) / df, -(df + 1) / 2);
}

/* ---------- random draws ---------- */

function normalDraw(rng: () => number): number {
	const u1 = Math.max(rng(), 1e-300);
	const u2 = rng();
	return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Marsaglia-Tsang gamma sampler, shape >= 1, scale 1. */
function gammaDraw(shape: number, rng: () => number): number {
	const d = shape - 1 / 3;
	const c = 1 / Math.sqrt(9 * d);
	for (;;) {
		let x: number;
		let v: number;
		do {
			x = normalDraw(rng);
			v = 1 + c * x;
		} while (v <= 0);
		v = v * v * v;
		const u = rng();
		if (u < 1 - 0.0331 * x ** 4) return d * v;
		if (Math.log(Math.max(u, 1e-300)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
	}
}

/** Student-t draw: Z / sqrt(chi2_df / df), chi2_df = 2 * Gamma(df/2). */
function tDraw(df: number, rng: () => number): number {
	const z = normalDraw(rng);
	const chi2 = 2 * gammaDraw(df / 2, rng);
	return z / Math.sqrt(chi2 / df);
}

/* ---------- adaptive quadrature ---------- */

// Gauss-Kronrod 15-point rule (QUADPACK G7/K15). Kronrod nodes xgk[0..6] (pairs), xgk[7] = 0.
const XGK = [
	0.991455371120813, 0.949107912342759, 0.864864423359769, 0.741531185599394, 0.586087235467691,
	0.405845151377397, 0.207784955007898, 0,
];
const WGK = [
	0.0229353220105292, 0.0630920926299785, 0.10479001032225, 0.140653259715526, 0.169004726639268,
	0.190350578064785, 0.204432940075299, 0.209482141084728,
];
// Gauss 7-point weights for nodes xgk[1], xgk[3], xgk[5] and the centre.
const WG = [0.12948496616887, 0.279705391489277, 0.381830050505119, 0.417959183673469];

interface Segment {
	a: number;
	b: number;
	value: number;
	err: number;
}

function gk15(g: (x: number) => number, a: number, b: number): Segment {
	const c = (a + b) / 2;
	const h = (b - a) / 2;
	const fc = g(c);
	let resK = (WGK[7] ?? 0) * fc;
	let resG = (WG[3] ?? 0) * fc;
	for (let j = 0; j < 7; j++) {
		const x = XGK[j] ?? 0;
		const f = g(c - h * x) + g(c + h * x);
		resK += (WGK[j] ?? 0) * f;
		if (j % 2 === 1) resG += (WG[(j - 1) / 2] ?? 0) * f;
	}
	return { a, b, value: h * resK, err: Math.abs(h * (resK - resG)) };
}

/** Globally adaptive integration over consecutive intervals `points`, abs. tolerance `tol`. */
function integrate(g: (x: number) => number, points: number[], tol: number): number {
	const segs: Segment[] = [];
	for (let i = 0; i + 1 < points.length; i++) {
		segs.push(gk15(g, points[i] ?? 0, points[i + 1] ?? 0));
	}
	let total = 0;
	let errSum = 0;
	for (const s of segs) {
		total += s.value;
		errSum += s.err;
	}
	for (let iter = 0; iter < 4000 && errSum > tol; iter++) {
		let worst = 0;
		for (let i = 1; i < segs.length; i++) {
			if ((segs[i]?.err ?? 0) > (segs[worst]?.err ?? 0)) worst = i;
		}
		const s = segs[worst];
		if (!s) break;
		const mid = (s.a + s.b) / 2;
		if (mid <= s.a || mid >= s.b) break; // interval too small to split
		const left = gk15(g, s.a, mid);
		const right = gk15(g, mid, s.b);
		total += left.value + right.value - s.value;
		errSum += left.err + right.err - s.err;
		segs[worst] = left;
		segs.push(right);
	}
	return total;
}

/* ---------- model ---------- */

function validate(p: MixtureParams): void {
	if (!Number.isFinite(p.df) || p.df <= 2) {
		throw new RangeError(`df must be finite and > 2, got ${p.df}`);
	}
	if (!Number.isFinite(p.eps) || p.eps < 0 || p.eps >= 1) {
		throw new RangeError(`eps must be in [0, 1), got ${p.eps}`);
	}
	if (!Number.isFinite(p.outlierRawScale) || p.outlierRawScale <= 0) {
		throw new RangeError(`outlierRawScale must be > 0, got ${p.outlierRawScale}`);
	}
}

export function makeMixture(partial?: Partial<MixtureParams>): Mixture {
	const params: MixtureParams = { ...DEFAULTS, ...partial };
	validate(params);
	const { eps, df, outlierRawScale: s } = params;

	const c2 = 1 - eps + (eps * s * s * df) / (df - 2);
	const C = Math.sqrt(c2);
	const usualSd = 1 / C;
	const outlierScale = s / C;

	const tConst = Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI);
	const normConst = 1 / Math.sqrt(2 * Math.PI);

	const pdf = (x: number): number => {
		const z = x / usualSd;
		const normPart = ((1 - eps) * normConst * Math.exp(-0.5 * z * z)) / usualSd;
		const tPart = eps > 0 ? (eps * tPdfStd(x / outlierScale, df, tConst)) / outlierScale : 0;
		return normPart + tPart;
	};

	const cdf = (x: number): number =>
		(1 - eps) * normalCdf(x / usualSd) + eps * tCdf(x / outlierScale, df);

	const tailProb = (k: number): number => {
		const a = Math.abs(k);
		const normTail = erfcPos(a / usualSd / SQRT2);
		return (1 - eps) * normTail + eps * tTwoSided(a / outlierScale, df);
	};

	const quantile = (p: number): number => {
		if (p <= 0) return -Infinity;
		if (p >= 1) return Infinity;
		let lo = -1;
		let hi = 1;
		while (cdf(lo) > p) lo *= 2;
		while (cdf(hi) < p) hi *= 2;
		for (let i = 0; i < 200; i++) {
			const mid = (lo + hi) / 2;
			if (cdf(mid) < p) lo = mid;
			else hi = mid;
			if (hi - lo < 1e-14 * Math.max(1, Math.abs(mid))) break;
		}
		return (lo + hi) / 2;
	};

	// Integration range: beyond L the mixture tail mass is below TAIL_TARGET.
	let L = 1;
	while (tailProb(L) > TAIL_TARGET) L *= 2;
	let loL = 0;
	let hiL = L;
	for (let i = 0; i < 200; i++) {
		const mid = (loL + hiL) / 2;
		if (tailProb(mid) > TAIL_TARGET) loL = mid;
		else hiL = mid;
	}
	L = hiL;

	const pos: number[] = [0];
	let x = 0;
	while (x < L) {
		x = Math.min(L, x < 8 ? x + 0.5 : x * 1.5);
		pos.push(x);
	}
	const points = [
		...pos
			.slice()
			.reverse()
			.map((v) => -v),
		...pos.slice(1),
	];

	const expect = (f: (u: number) => number): number =>
		integrate((u) => pdf(u) * f(u), points, 1e-11);

	const sample = (n: number, rng: () => number): Float64Array => {
		const out = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			out[i] = rng() < eps ? outlierScale * tDraw(df, rng) : usualSd * normalDraw(rng);
		}
		return out;
	};

	const sampleX = (n: number, rng: () => number, mu: number, sigma: number): Float64Array => {
		const u = sample(n, rng);
		for (let i = 0; i < n; i++) u[i] = mu + sigma * (u[i] ?? 0);
		return u;
	};

	return {
		params,
		c2,
		usualSd,
		outlierScale,
		pdf,
		cdf,
		quantile,
		sample,
		sampleX,
		expect,
		tailProb,
	};
}

/* ---------- derived factors ---------- */

/** Phi^{-1}(p) by bisection on the normal CDF (used for the normal constants). */
function normalQuantile(p: number): number {
	let lo = -10;
	let hi = 10;
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (normalCdf(mid) < p) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** V_mu = E psi^2 / (E psi')^2: asymptotic variance factor of a location M-estimator (sigma known). */
export function locationFactor(
	m: Mixture,
	psi: (u: number) => number,
	dpsi: (u: number) => number,
): number {
	const e2 = m.expect((u) => psi(u) * psi(u));
	const ed = m.expect(dpsi);
	return e2 / (ed * ed);
}

/** Asymptotic variance factor of the sample median: 1 / (4 f(0)^2). */
export function medianFactor(m: Mixture): number {
	const f0 = m.pdf(0);
	return 1 / (4 * f0 * f0);
}

/** plim MADN / sigma = q_F(0.75) / Phi^{-1}(0.75) (equal to the IQRN limit by symmetry). */
export function madLimitRatio(m: Mixture): number {
	return m.quantile(0.75) / normalQuantile(0.75);
}

/**
 * V_sigma = Var(rho(U)) / (E[U rho'(U)])^2 for a scale M-estimator.
 * Var is taken around b (default E rho(U)): E[(rho(U) - b)^2] with b = E rho(U) is the variance.
 */
export function scaleFactor(
	m: Mixture,
	rho: (u: number) => number,
	drho: (u: number) => number,
	b?: number,
): number {
	const center = b ?? m.expect(rho);
	const v = m.expect((u) => (rho(u) - center) * (rho(u) - center));
	const d = m.expect((u) => u * drho(u));
	return v / (d * d);
}

/** Scale s* solving E rho(U / s) = b (plim of the M-scale under the model). */
export function scaleLimitRatio(m: Mixture, rho: (u: number) => number, b: number): number {
	const g = (s: number): number => m.expect((u) => rho(u / s)) - b;
	let lo = 1e-3;
	let hi = 1e3;
	for (let i = 0; i < 100; i++) {
		const mid = (lo + hi) / 2;
		// g is decreasing in s: larger scale -> smaller rho arguments.
		if (g(mid) > 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}
