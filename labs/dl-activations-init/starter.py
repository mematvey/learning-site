"""Activations and weight initialization: starter code.

Complete the functions below so that they match the chapter text.
Biases are zero everywhere. Weight matrices have shape (n_out, n_in),
so a layer computes activate(a @ W.T, kind) for a batch `a` of shape (batch, n_in).
"""


def xavier_init(n_in, n_out, rng):
    """Xavier (Glorot) normal init: weights of shape (n_out, n_in), Var(w) = 2 / (n_in + n_out).

    rng: np.random.Generator. Returns a float64 array.
    """
    # TODO: draw normal samples with the Xavier variance; the std is sqrt(Var(w))
    raise NotImplementedError


def he_init(n_in, n_out, rng):
    """He normal init for ReLU: weights of shape (n_out, n_in), Var(w) = 2 / n_in.

    rng: np.random.Generator. Returns a float64 array.
    """
    # TODO: draw normal samples with the He variance (depends on n_in only)
    raise NotImplementedError


def activate(z, kind):
    """Elementwise activation: 'relu', 'tanh' or 'sigmoid'. Raises ValueError otherwise.

    Sigmoid must stay finite for large |z|, for example z = -1000 or z = 1000.
    """
    # TODO: implement the three activations; check `kind` and raise ValueError for others
    raise NotImplementedError


def init_stack(width, depth, scheme, rng):
    """Returns `depth` square weight matrices (width, width) for the chosen scheme.

    scheme: 'xavier' or 'he'. Raises ValueError for any other name.
    """
    # TODO: build `depth` matrices with the init function that matches `scheme`
    raise NotImplementedError


def forward_stack(x, weights, kind):
    """Forward pass with zero biases. x has shape (batch, width).

    Layer l computes a_l = activate(a_{l-1} @ W_l.T, kind). Returns the list of
    the L layer outputs a_1, ..., a_L (the input x is not included).
    Do not modify x.
    """
    # TODO: apply each layer in order and collect its output
    raise NotImplementedError


def layer_stats(activations):
    """Mean and variance of each layer's output over all its entries.

    Returns two float arrays of length L: (means, variances), with ddof = 0.
    """
    # TODO: compute mean and population variance per layer output
    raise NotImplementedError
