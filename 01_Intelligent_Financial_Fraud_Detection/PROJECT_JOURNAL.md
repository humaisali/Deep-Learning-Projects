# Intelligent Financial Fraud Detection — project journal

I started this project with a practical question. If a reviewer can investigate only a few payments, which ones should my model put at the top of the list? I wanted to understand how an ANN learns, compare it with simpler models, and end up with a queue I could actually inspect.

## Data and evaluation setup

I used the ULB credit card dataset, covering two days in September 2013. Each row represents one transaction. `Time` measures seconds since the first payment, `Amount` is its face value and `V1` through `V28` are anonymized PCA components. The answer column, `Class`, is available for training and retrospective evaluation. The scorer accepts the other 30 columns in an unlabeled CSV. [Dataset card and attribution](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud)

There were 492 frauds among 284,807 payments. A rule that called everything legitimate would score 99.83% accuracy and miss every fraud. I needed to measure both the number of cases caught and the workload those detections created.

| Window in time order | Transactions | Confirmed frauds | Decision it supports |
|---|---:|---:|---|
| Earliest 70% | 199,364 | 384 | Fit scaling parameters and model weights |
| Next 15% | 42,719 | 56 | Select the epoch, cutoff and review policy |
| Latest 15% | 42,724 | 52 | Measure historical performance at frozen cutoffs |

Equal timestamps stay together. All three models see the same windows. Precision is the fraction of alerts that are fraud. Recall is the fraction of all frauds flagged. Trapezoidal PR-AUC measures the area under the precision–recall curve across thresholds. Average precision (AP) weights precision by increases in recall. I record both because their numerical values can differ.

## Session 1 · Learning one update

1. I used four invented XOR examples so I could see why a hidden layer needs a nonlinear activation. I implemented tanh, sigmoid, mean binary cross-entropy and backpropagation in NumPy.
2. For one labeled example, the output logit's gradient is $p-y$. For an outgoing weight connected to activation $h$, it is $(p-y)h$. With $p=0.20$, $y=1$ and $h=0.50$, the derivative is $-0.40$. SGD with learning rate 0.10 raises the weight by 0.04 and the score to about 0.203.
3. I checked each NumPy gradient by perturbing its parameter. The largest absolute error was $9.61\times10^{-12}$ and the toy loss fell from 0.8299 to 0.0219. I then checked both PyTorch weight matrices and both bias vectors against autograd.

This session gave me a way to check the learning math before bringing real transactions into the experiment. [PyTorch foundations](01_PyTorch_Foundations.ipynb)

## Session 2 · Training and comparing the models

1. I sorted payments by time, separated the three windows and fitted the standard scaler on training data. This keeps future transaction statistics out of model fitting.
2. I trained a fully connected ANN with 30 inputs, hidden widths of 64 and 32, ReLU activations, 20% dropout after the first hidden activation and one output logit. I used Adam, batches of 512, learning rate 0.001 and weight decay 0.0001. The positive loss weight was the training ratio of legitimate to fraudulent transactions.
3. I tracked validation AP. The reference notebook used up to 15 epochs and patience of 10. Epoch 14 had the highest validation AP, 0.8606. For each model I selected its own validation cutoff by maximum F1 before scoring the test window.

| Reference model | Alerts | Caught | False alerts | Missed | Precision | Recall | AP | PR-AUC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ANN | 39 | 36 | 3 | 16 | 0.9231 | 0.6923 | 0.7737 | 0.7733 |
| Logistic regression | 35 | 33 | 2 | 19 | 0.9429 | 0.6346 | 0.7069 | 0.7104 |
| Gradient-boosted trees | 40 | 33 | 7 | 19 | 0.8250 | 0.6346 | 0.7068 | 0.7058 |

My reason for carrying the ANN forward was the comparison with logistic regression. Four extra investigations caught three extra frauds and added one false alert. The experiment compares complete model configurations. It did not isolate the contribution of dropout, class weighting or any individual hyperparameter. [Training notebook](02_ULB_Training_and_Risk_Review.ipynb)

## Session 3 · Moving the cutoff

I restored the saved weights and training scaler, disabled dropout and scored the validation window. I added a precision–recall curve, alert counts and the highest-ranked payments to the dashboard. The saved cutoff had to retain its full precision because it was close to 1.

| Validation cutoff | Reviews | Frauds caught | False alerts | Missed frauds |
|---|---:|---:|---:|---:|
| 0.9998766184 (rounded here) | 42 | 42 | 0 | 14 |
| 0.99 | 73 | 47 | 26 | 9 |

I could catch five more frauds with 31 additional investigations in this window. The threshold changed the queue while the weights and ranking stayed fixed. The class-weighted output is a risk score. Estimating a fraud probability would need a calibration check. [Risk dashboard](03_Transaction_Risk_Dashboard.ipynb)

## Session 4 · Turning scores into a review queue

I made the model accept an unlabeled CSV, select the required inputs by name, reject missing or invalid values and apply the saved scaling parameters. I exported one file containing all scores and another containing just the alerts, sorted by score. The one-based source record ties each decision back to its input row.

The held-out replay reproduced the reference model’s 39 alerts. A separate custom-input run scored the full 284,807-row file and emitted 434 alerts. That full-file count is an input-handling check because it also includes training rows. The improvement in this session was repeatable scoring and traceability. [Batch scoring](04_Batch_Fraud_Scoring.ipynb)

## Session 5 · Looking inside the misses

I matched the held-out decisions to their original labels by source record and checked the run, time, amount and cutoff. The 52 frauds totaled 6,168.88. The 36 flagged frauds accounted for 3,677.93 (59.62%). The 16 misses accounted for 2,490.95. This is why I report amount coverage alongside case recall of 69.23%.

One miss was rank 40, immediately below the queue. The largest two missed amounts were 1,096.99 and 634.30, at ranks 184 and 225. Together they made up 69.5% of missed fraud amount. Extending the queue by one would catch the nearest miss and still leave those two outside it. This observation led to the next validation experiment. [Error analysis](05_Fraud_Error_Analysis.ipynb)

## Session 6 · Testing a different queue policy

I kept the budget at 42 reviews. The original policy took the top 42 ANN scores. The challenger shortlisted the top 84 scores and selected the 42 largest payments. I used the labels after selecting the queues.

| Validation policy | Frauds caught | False alerts | Fraud amount flagged | Amount coverage |
|---|---:|---:|---:|---:|
| Highest scores | 42 | 0 | 7,983.85 | 95.07% |
| Largest amounts within the shortlist | 24 | 18 | 8,214.64 | 97.82% |

The queues had 22 payments in common. The challenger dropped 20 frauds worth 15.76 in total. In their place it selected two frauds worth 246.55 and 18 legitimate payments. I would keep score order for a team judged on the number of cases caught. Switching policies would gain 230.79 in flagged face value and lose 18 detections at the same workload. The data contains no recovery rates or investigation costs to turn that tradeoff into net savings. [Fixed-budget comparison](06_Fixed_Budget_Review_Policies.ipynb)

## Session 7 · Reproducing the workflow

I brought the gradient check, training, dashboard, baseline comparison, policy experiment, batch export and missed-case audit into one notebook. It writes the checkpoint, metrics, queue and run configuration together. I kept run IDs because opening two saved notebooks can otherwise give apparently conflicting answers.

| ANN run | Selected epoch | Test alerts | Caught / false / missed | Precision | Recall | PR-AUC |
|---|---:|---:|---|---:|---:|---:|
| Reference · `20261121T162317186996Z` | 14 | 39 | 36 / 3 / 16 | 0.9231 | 0.6923 | 0.7733 |
| Packaged CPU reproduction · `20261121T184214Z_272d93dd` | 3 | 39 | 36 / 3 / 16 | 0.9231 | 0.6923 | 0.7631 |
| Latest saved Colab run · `20261121T185029Z_0ac93d0a` | 6 | 35 | 34 / 1 / 18 | 0.9714 | 0.6538 | 0.7508 |

The consolidated loop uses patience of three. In the saved Colab trace, validation AP reached 0.8501 at epoch 6. Three subsequent epochs failed to improve it and the model restored epoch 6. In the longer reference run, validation AP later reached 0.8606 at epoch 14. The latest Colab run therefore answers a slightly different operating question: it raised fewer alerts and missed two more frauds. Runtime and checkpoint selection differ across runs, so these results cannot establish a single cause for every difference. The bundled CPU reproduction also confirms that two rankings can have identical alert counts at their selected cutoffs and different PR-AUC values. [End-to-end notebook](Fraud_Detection_End_to_End.ipynb)

## What is finished and what remains

The portfolio workflow is complete for historical offline scoring. It includes the mathematical check, three-model comparison, validation dashboard, CSV scorer, error analysis, capacity experiment and reproducible checkpoints. The README covers setup, data access and the bundle. [Project README](README.md)

Before using it to guide real payment reviews, I would need a fresh chronological sample with compatible features and delayed real labels, a review budget per operating period, and the cost of false alerts and missed fraud. The two-day sample limits the strength of conclusions about future performance. The final window also informed the amount-aware hypothesis, so an independent later window is needed to confirm the policy findings. Live ingestion, score calibration if probabilities are required, drift monitoring and feedback from reviewers remain production work.

