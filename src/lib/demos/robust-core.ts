/**
 * Robust estimators core: normal distribution helpers, psi/rho functions, scale estimators
 * (MAD, IQR, M-scale), location M-estimation by IRLS and joint location-scale M-estimation.
 * Pure functions, no DOM.
 */

export type PsiKind = 'huber' | 'bisquare';
export type RhoKind = 'bisquare' | 'clipped'; // clipped: min((u/c)^2, 1)

/** Φ^{-1}(0.75) */
export const PHI75 = 0.6744897501960817;

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const SQRT_PI = Math.sqrt(Math.PI);

export interface IrlsStep {
	mu: number;
	weights: number[];
}

export interface JointStep {
	mu: number;
	sigma: number;
}

/* ---------- normal distribution ---------- */

export function normalPdf(x: number): number {
	return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** erf(t) for 0 <= t < 3, positive series without cancellation. */
function erfSeries(t: number): number {
	const t2x2 = 2 * t * t;
	let term = t;
	let sum = t;
	for (let n = 1; n < 1000; n++) {
		term *= t2x2 / (2 * n + 1);
		sum += term;
		if (term <= 1e-17 * sum) break;
	}
	return (2 / SQRT_PI) * Math.exp(-t * t) * sum;
}

/** erfc(t) for t >= 0. Series for small t, continued fraction for large t. */
function erfcAbs(t: number): number {
	if (t < 3) return 1 - erfSeries(t);
	let g = t;
	for (let k = 120; k >= 1; k--) g = t + k / 2 / g;
	return Math.exp(-t * t) / (SQRT_PI * g);
}

export function normalCdf(x: number): number {
	const tail = 0.5 * erfcAbs(Math.abs(x) / Math.SQRT2);
	return x >= 0 ? 1 - tail : tail;
}

/**
 * Inverse normal CDF: Acklam rational approximation followed by one Halley step
 * against normalCdf (full double precision for 0 < p < 1).
 */
export function normalQuantile(p: number): number {
	if (!(p > 0 && p < 1)) throw new RangeError(`normalQuantile: p must be in (0,1), got ${p}`);
	const a = [
		-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
		-3.066479806614716e1, 2.506628277459239,
	];
	const b = [
		-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
		-1.328068155288572e1,
	];
	const c = [
		-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
		4.374664141464968, 2.938163982698783,
	];
	const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
	const pLow = 0.02425;
	const pHigh = 1 - pLow;
	let x: number;
	if (p < pLow) {
		const q = Math.sqrt(-2 * Math.log(p));
		x =
			(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
			((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
	} else if (p <= pHigh) {
		const q = p - 0.5;
		const r = q * q;
		x =
			((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
			(((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
	} else {
		const q = Math.sqrt(-2 * Math.log(1 - p));
		x = -(
			(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
			((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
		);
	}
	// One Halley refinement step.
	const e = normalCdf(x) - p;
	const u = e * SQRT_2PI * Math.exp((x * x) / 2);
	x = x - u / (1 + (x * u) / 2);
	return x;
}

/* ---------- psi / rho ---------- */

export function psi(kind: PsiKind, u: number, c: number): number {
	if (kind === 'huber') return Math.min(Math.max(u, -c), c);
	const z = u / c;
	if (Math.abs(z) >= 1) return 0;
	const t = 1 - z * z;
	return u * t * t;
}

export function dpsi(kind: PsiKind, u: number, c: number): number {
	if (kind === 'huber') return Math.abs(u) < c ? 1 : 0;
	const z = u / c;
	if (Math.abs(z) >= 1) return 0;
	return (1 - z * z) * (1 - 5 * z * z);
}

/** psi(u)/u with the limit 1 at u = 0. */
export function weight(kind: PsiKind, u: number, c: number): number {
	if (kind === 'huber') {
		const a = Math.abs(u);
		return a <= c ? 1 : c / a;
	}
	const z = u / c;
	if (Math.abs(z) >= 1) return 0;
	const t = 1 - z * z;
	return t * t;
}

export function rho(kind: RhoKind, u: number, c: number): number {
	const z = u / c;
	if (kind === 'clipped') return Math.min(z * z, 1);
	if (Math.abs(z) >= 1) return 1;
	const t = 1 - z * z;
	return 1 - t * t * t;
}

export function drho(kind: RhoKind, u: number, c: number): number {
	if (kind === 'clipped') return Math.abs(u) < c ? (2 * u) / (c * c) : 0;
	const z = u / c;
	if (Math.abs(z) >= 1) return 0;
	const t = 1 - z * z;
	return (6 * u * t * t) / (c * c);
}

/* ---------- sample statistics ---------- */

function assertNonEmpty(x: ArrayLike<number>, name: string): void {
	if (x.length === 0) throw new RangeError(`${name}: empty sample`);
}

export function mean(x: ArrayLike<number>): number {
	assertNonEmpty(x, 'mean');
	let s = 0;
	for (let i = 0; i < x.length; i++) s += x[i]!;
	return s / x.length;
}

/** Sample standard deviation with ddof = 1; 0 for a single observation. */
export function sd(x: ArrayLike<number>): number {
	assertNonEmpty(x, 'sd');
	const n = x.length;
	if (n < 2) return 0;
	const m = mean(x);
	let s = 0;
	for (let i = 0; i < n; i++) {
		const d = x[i]! - m;
		s += d * d;
	}
	return Math.sqrt(s / (n - 1));
}

function sortedCopy(x: ArrayLike<number>): Float64Array {
	return Float64Array.from(x).sort();
}

/** numpy 'linear' quantile on a sorted copy. */
function quantileSorted(s: Float64Array, p: number): number {
	const n = s.length;
	const h = (n - 1) * p;
	const lo = Math.floor(h);
	const hi = Math.min(lo + 1, n - 1);
	return s[lo]! + (h - lo) * (s[hi]! - s[lo]!);
}

export function quantile(x: ArrayLike<number>, p: number): number {
	assertNonEmpty(x, 'quantile');
	if (!(p >= 0 && p <= 1)) throw new RangeError(`quantile: p must be in [0,1], got ${p}`);
	return quantileSorted(sortedCopy(x), p);
}

export function median(x: ArrayLike<number>): number {
	return quantile(x, 0.5);
}

export function madRaw(x: ArrayLike<number>): number {
	const m = median(x);
	const dev = Float64Array.from(x, (v) => Math.abs(v - m));
	return median(dev);
}

export function iqrRaw(x: ArrayLike<number>): number {
	const s = sortedCopy(x);
	return quantileSorted(s, 0.75) - quantileSorted(s, 0.25);
}

/** Normal-consistent MAD: madRaw / Φ^{-1}(0.75). */
export function madn(x: ArrayLike<number>): number {
	return madRaw(x) / PHI75;
}

/** Normal-consistent IQR: iqrRaw / (2 Φ^{-1}(0.75)). */
export function iqrn(x: ArrayLike<number>): number {
	return iqrRaw(x) / (2 * PHI75);
}

/**
 * M-scale s solving mean(rho((x - center) / s)) = b.
 * Center defaults to the median. If the median absolute residual is 0, the sample sd is used;
 * for degenerate data the result is 0.
 */
export function mScale(
	x: ArrayLike<number>,
	o: { kind: RhoKind; c: number; b: number; center?: number },
): number {
	assertNonEmpty(x, 'mScale');
	const n = x.length;
	const center = o.center ?? median(x);
	const r = Float64Array.from(x, (v) => Math.abs(v - center));
	let base = median(r);
	if (base <= 1e-14) base = sd(x);
	if (base <= 1e-14) return 0;

	// f is non-increasing in s, since rho is non-decreasing in |u|.
	const f = (s: number): number => {
		let acc = 0;
		for (let i = 0; i < n; i++) acc += rho(o.kind, r[i]! / s, o.c);
		return acc / n - o.b;
	};

	let lo = base;
	let hi = base;
	for (let k = 0; k < 200 && f(hi) > 0; k++) hi *= 2;
	for (let k = 0; k < 200 && f(lo) < 0; k++) lo /= 2;
	if (f(lo) < 0) return 0;

	for (let k = 0; k < 400 && hi - lo > 1e-13 * hi; k++) {
		const mid = 0.5 * (lo + hi);
		if (f(mid) > 0) lo = mid;
		else hi = mid;
	}
	return 0.5 * (lo + hi);
}

/* ---------- location M-estimation ---------- */

/**
 * Location M-estimate at fixed scale by IRLS: mu <- sum(w_i x_i) / sum(w_i), w_i = weight(u_i),
 * u_i = (x_i - mu) / scale. trace[0] is the start point with its weights; each later entry
 * is an iterate with the weights computed at that iterate.
 */
export function locationIrls(
	x: ArrayLike<number>,
	scale: number,
	o: { kind: PsiKind; c: number; start?: number; tol?: number; maxIter?: number },
): { mu: number; iterations: number; trace: IrlsStep[] } {
	assertNonEmpty(x, 'locationIrls');
	const n = x.length;
	const start = o.start ?? median(x);
	const tol = o.tol ?? 1e-10 * Math.max(scale, 1);
	const maxIter = o.maxIter ?? 200;

	const weightsAt = (mu: number): number[] => {
		const w = new Array<number>(n);
		for (let i = 0; i < n; i++) {
			w[i] = scale > 0 ? weight(o.kind, (x[i]! - mu) / scale, o.c) : 1;
		}
		return w;
	};

	let mu = start;
	let w = weightsAt(mu);
	const trace: IrlsStep[] = [{ mu, weights: w }];
	if (!(scale > 0)) return { mu, iterations: 0, trace };

	let iterations = 0;
	while (iterations < maxIter) {
		let sw = 0;
		let swx = 0;
		for (let i = 0; i < n; i++) {
			sw += w[i]!;
			swx += w[i]! * x[i]!;
		}
		if (!(sw > 1e-300)) break;
		const muNew = swx / sw;
		iterations++;
		const converged = Math.abs(muNew - mu) <= tol;
		mu = muNew;
		w = weightsAt(mu);
		trace.push({ mu, weights: w });
		if (converged) break;
	}
	return { mu, iterations, trace };
}

/**
 * Joint location-scale M-estimate: alternate a location IRLS step (at the current scale) and a
 * scale step (M-scale centred at the new location). Starts from (median, M-scale about median).
 */
export function jointM(
	x: ArrayLike<number>,
	o: {
		psi: { kind: PsiKind; c: number };
		rho: { kind: RhoKind; c: number; b: number };
	},
): { mu: number; sigma: number; iterations: number; trace: JointStep[] } {
	assertNonEmpty(x, 'jointM');
	const tol = 1e-9;
	const maxIter = 100;
	let mu = median(x);
	let sigma = mScale(x, { kind: o.rho.kind, c: o.rho.c, b: o.rho.b, center: mu });
	const trace: JointStep[] = [{ mu, sigma }];

	let iterations = 0;
	while (iterations < maxIter) {
		const muNew = locationIrls(x, sigma, {
			kind: o.psi.kind,
			c: o.psi.c,
			start: mu,
			tol: tol * Math.max(sigma, 1),
		}).mu;
		const sigmaNew = mScale(x, { kind: o.rho.kind, c: o.rho.c, b: o.rho.b, center: muNew });
		iterations++;
		const locOk = Math.abs(muNew - mu) <= tol * Math.max(sigma, 1);
		const scaleOk = Math.abs(sigmaNew - sigma) <= tol * Math.max(sigma, 1);
		mu = muNew;
		sigma = sigmaNew;
		trace.push({ mu, sigma });
		if (locOk && scaleOk) break;
	}
	return { mu, sigma, iterations, trace };
}
