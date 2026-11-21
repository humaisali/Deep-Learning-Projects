"""Learn backpropagation on four invented transactions. Run with Python and NumPy."""

import numpy as np


# Columns are two fictional binary transaction signals. The label is 1 when
# exactly one signal is active. This interaction needs a nonlinear boundary.
X = np.array([[0., 0.], [0., 1.], [1., 0.], [1., 1.]])
y = np.array([[0.], [1.], [1.], [0.]])


def forward(params):
    hidden = np.tanh(X @ params["W1"] + params["b1"])
    logits = hidden @ params["W2"] + params["b2"]
    scores = np.exp(-np.logaddexp(0., -logits))  # stable sigmoid
    loss = np.mean(np.logaddexp(0., logits) - y * logits)
    return hidden, scores, loss


def backward(params, hidden, scores):
    # Mean binary cross-entropy contributes one factor of 1 / batch size.
    d_logits = (scores - y) / len(X)
    d_hidden = d_logits @ params["W2"].T
    d_pre_activation = d_hidden * (1. - hidden**2)
    return {
        "W2": hidden.T @ d_logits,
        "b2": d_logits.sum(axis=0),
        "W1": X.T @ d_pre_activation,
        "b1": d_pre_activation.sum(axis=0),
    }


def check_gradients(params, gradients):
    # Perturb each parameter and measure the slope of the actual loss.
    step = 1e-5
    largest_error = 0.
    for name, values in params.items():
        for index in np.ndindex(values.shape):
            original = values[index]
            values[index] = original + step
            plus = forward(params)[2]
            values[index] = original - step
            minus = forward(params)[2]
            values[index] = original
            measured = (plus - minus) / (2 * step)
            largest_error = max(largest_error, abs(measured - gradients[name][index]))
            np.testing.assert_allclose(measured, gradients[name][index], atol=1e-7)
    return largest_error


def main():
    rng = np.random.default_rng(42)
    params = {
        "W1": rng.normal(size=(2, 4)),
        "b1": np.zeros(4),
        "W2": rng.normal(size=(4, 1)),
        "b2": np.zeros(1),
    }
    hidden, scores, initial_loss = forward(params)
    error = check_gradients(params, backward(params, hidden, scores))
    print(f"Largest gradient-check error = {error:.2e}")
    for _ in range(2000):
        hidden, scores, _loss = forward(params)
        gradients = backward(params, hidden, scores)
        for name in params:
            params[name] -= 0.1 * gradients[name]

    _, scores, final_loss = forward(params)
    print(f"Mean training loss = {initial_loss:.4f} -> {final_loss:.4f}")
    print("Signals    Label    Learned score")
    for signals, label, score in zip(X.astype(int), y[:, 0], scores[:, 0]):
        print(f"{signals}      {int(label)}        {score:.3f}")


if __name__ == "__main__":
    main()
