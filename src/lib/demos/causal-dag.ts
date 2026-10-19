/**
 * Linear Gaussian models behind the causal DAG demo.
 * True direct effect of X on Y is TRUE_EFFECT = 2; all noises have unit variance.
 * Population OLS coefficients are closed-form, so the numbers are exact (checked by simulation).
 */

export const SCENARIOS = ['confounder', 'mediator', 'collider'] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface CausalDagDemoState {
	scenario: Scenario;
	/** Whether the third variable is included in the regression as a control. */
	adjust: boolean;
	/** Strength of Z -> X in the confounder scenario. */
	alpha: number;
}

export const TRUE_EFFECT = 2;
/** Coefficient Z -> Y in the confounder scenario. */
export const CONFOUNDER_GAMMA = 1;
/** Coefficient X -> Z (Z is the mediator) and Z -> Y in the mediator scenario. */
export const MEDIATOR_DELTA = 1;
export const MEDIATOR_GAMMA = 2;

export const ALPHA_MIN = 0;
export const ALPHA_MAX = 2;
export const ALPHA_STEP = 0.5;

export const DEFAULT_STATE: CausalDagDemoState = {
	scenario: 'confounder',
	adjust: false,
	alpha: 1,
};

export function isScenario(value: unknown): value is Scenario {
	return typeof value === 'string' && (SCENARIOS as readonly string[]).includes(value);
}

export function snapAlpha(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_STATE.alpha;
	const clamped = Math.min(ALPHA_MAX, Math.max(ALPHA_MIN, value));
	return Math.round(clamped / ALPHA_STEP) * ALPHA_STEP;
}

/**
 * Population regression slope of Y on X.
 * adjust = false: regression on X alone. adjust = true: regression on X and the third variable.
 *
 * Confounder (Z -> X with alpha, Z -> Y with gamma = 1, X -> Y with 2):
 *   unadjusted = beta + gamma * alpha / (alpha^2 + 1); adjusted = beta.
 * Mediator (X -> Z with delta = 1, Z -> Y with gamma = 2, no direct edge):
 *   unadjusted = gamma * delta = total effect 2; adjusted = 0.
 * Collider (X -> Y with 2, X -> K and Y -> K with weight 1):
 *   unadjusted = 2; adjusted = 0.5.
 */
export function estimate(scenario: Scenario, adjust: boolean, alpha: number): number {
	switch (scenario) {
		case 'confounder': {
			if (adjust) return TRUE_EFFECT;
			return TRUE_EFFECT + (CONFOUNDER_GAMMA * alpha) / (alpha * alpha + 1);
		}
		case 'mediator': {
			return adjust ? 0 : MEDIATOR_GAMMA * MEDIATOR_DELTA;
		}
		case 'collider': {
			return adjust ? 0.5 : TRUE_EFFECT;
		}
	}
}

/** Target value that the reader should compare the estimate with, in words. */
export function expectedLabel(scenario: Scenario): string {
	switch (scenario) {
		case 'confounder':
			return 'истинный эффект X на Y равен 2';
		case 'mediator':
			return 'полный эффект X на Y равен 2, прямой эффект через медиатор равен 0';
		case 'collider':
			return 'истинный эффект X на Y равен 2';
	}
}

/** Short sentence for aria-live that describes the current state. */
export function describeState(state: CausalDagDemoState): string {
	const value = estimate(state.scenario, state.adjust, state.alpha).toFixed(2);
	const control = state.adjust ? 'с контролем' : 'без контроля';
	return `Оценка связи X и Y ${control}: ${value}; ${expectedLabel(state.scenario)}.`;
}
