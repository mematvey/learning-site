"""Bayes formula: reference solution."""


def posterior(prior, p_pos_if_ill, p_pos_if_healthy):
    evidence = prior * p_pos_if_ill + (1 - prior) * p_pos_if_healthy
    return prior * p_pos_if_ill / evidence


def posterior_many(priors, likelihoods):
    joint = [p * lik for p, lik in zip(priors, likelihoods)]
    evidence = sum(joint)
    return [j / evidence for j in joint]


def update_sequence(prior, lik_h, lik_not_h, n):
    p = prior
    for _ in range(n):
        p = posterior(p, lik_h, lik_not_h)
    return p
