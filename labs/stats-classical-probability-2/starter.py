"""Bayes formula: starter code.

Complete the three functions. Probabilities are floats in [0, 1].
"""


def posterior(prior, p_pos_if_ill, p_pos_if_healthy):
    """P(H | E) for one hypothesis H against its complement."""
    # TODO: evidence by the law of total probability, then the Bayes formula
    raise NotImplementedError


def posterior_many(priors, likelihoods):
    """Posterior probabilities of several hypotheses forming a partition.

    priors[i] = P(H_i), likelihoods[i] = P(E | H_i). Returns a list that sums to 1.
    """
    # TODO: normalise priors[i] * likelihoods[i]
    raise NotImplementedError


def update_sequence(prior, lik_h, lik_not_h, n):
    """Posterior of H after n independent results, each with the same likelihoods.

    Apply `posterior` n times: each posterior becomes the next prior.
    """
    # TODO: loop n times
    raise NotImplementedError
