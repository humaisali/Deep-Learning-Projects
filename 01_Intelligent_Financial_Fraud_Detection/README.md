# Intelligent Financial Fraud Detection

I built a PyTorch model to decide which credit card payments should enter a review queue. In a chronological replay of 42,724 transactions, the ANN flagged 39 records. Of those, 36 were fraudulent. It missed 16 of the 52 frauds.

I recorded the experiments, decisions and remaining work in the [session journal](PROJECT_JOURNAL.md). The full workflow runs in one notebook. [Open the end-to-end project in Colab](https://colab.research.google.com/drive/1GVloJsvxmMidoMeV4lnasJ3IX8BxY_b4)

The GitHub checkout includes the notebooks and both trained checkpoints. For the original metrics and batch CSVs used by the numbered lessons, extract the bundle's `Artifacts` folder into the project directory. The end-to-end notebook can generate a fresh set of results from the ULB data. [Download the portfolio bundle](https://drive.google.com/file/d/1mo0nztEV82enUAb3Q4-rHVz9vehGNNjs/view?usp=drivesdk)

## Results on the final time window

| Model | Precision | Recall | PR-AUC¹ | Alerts | Frauds caught | False alerts |
|---|---:|---:|---:|---:|---:|---:|
| ANN | 0.9231 | 0.6923 | 0.7733 | 39 | 36 | 3 |
| Logistic regression | 0.9429 | 0.6346 | 0.7104 | 35 | 33 | 2 |
| Gradient-boosted trees | 0.8250 | 0.6346 | 0.7058 | 40 | 33 | 7 |

¹ Trapezoidal area under the precision–recall curve. The ANN's average precision was 0.7737. Each model used its own cutoff selected by maximum validation F1. Relative to logistic regression, the ANN caught three additional frauds at the cost of one additional false alert.

## Data and training

The ULB dataset contains 284,807 anonymized transactions, including 492 confirmed frauds. The 30 inputs are elapsed time, transaction amount and 28 PCA components. `Class` supplies the training label. [Dataset and attribution](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud)

The earliest 70% of records train the models, the next 15% guide epoch and threshold selection, and the final 15% measure performance. Boundaries keep equal timestamps together. The scaler learns its means and scales from training rows. The ANN has 64 and 32 hidden units with ReLU, dropout, Adam and a class-weighted binary cross-entropy loss. Validation average precision selects the checkpoint.

## Run in Colab

**Single-run entry point.** Open `Fraud_Detection_End_to_End.ipynb` and select **Runtime → Run all**. It runs independently of the numbered lessons. It checks the NumPy gradients, trains all three models, chooses thresholds on validation data, evaluates the held-out window, compares the two review policies and writes scored transactions. The dashboard cell can be rerun with another validation cutoff.

The default Drive project path is `My Drive/Colab Notebooks/Project 01: Intelligent Financial Fraud Detection`. Set `project_folder` in the first cell if you use a different location. Provide the ULB file at `Dataset/creditcard.csv`, or let the notebook retrieve it through KaggleHub. For local execution, open Jupyter from the extracted project directory and select a Python kernel with NumPy, pandas, PyTorch, scikit-learn, matplotlib and IPython. KaggleHub is needed only for the download fallback.

For a custom batch, enter the CSV path in `incoming_csv`. Supply finite numeric `Time`, `Amount` and `V1` through `V28` features that use the ULB definitions. The notebook accepts unlabeled rows. Leave the field empty for a replay of the held-out window.

Each fresh run writes a new folder under `Artifacts/End-to-end runs/` containing a checkpoint, test metrics, validation policy comparison, full scored batch, ranked review queue, missed-fraud audit and run metadata. The original run ID below still identifies the reference model used for the portfolio results.

### Learning notebooks

For local use, extract the portfolio ZIP, open a terminal in the extracted directory, install the dependencies with `python -m pip install -r requirements.txt`, and launch `python -m jupyterlab`. The raw dataset is available separately from the linked ULB dataset card. The reference CSV has SHA-256 `76274b691b16a6c49d3f159c883398e03ccd6d1ee12d9d8ee38f4b4b98551a89`.

1. Use notebook 01 to check manual gradients against PyTorch autograd. [Foundations](https://drive.google.com/file/d/1XeixyReeV0ptkiL1HgV1Ox-PAaMU12FD/view)
2. Place `creditcard.csv` in the project's `Dataset` folder. Run notebook 02 to train and compare models. The checkpoint and metrics CSV share a run ID under `Artifacts`. [Training and evaluation](https://drive.google.com/file/d/1ffQqutPNTgUL_O6JZUIuRiCPQPHSdb2h/view)
3. Explore how thresholds change the review workload on the validation window. [Risk dashboard](https://colab.research.google.com/drive/1SBPup2TTkb8Ux29EBl6bxJzQC5Z2e-BJ)
4. Select **Held-out replay** in notebook 04 to reproduce the held-out review queue. Choose **Custom CSV** for an unlabeled batch with the same 30 inputs. Each run saves all scored records and a ranked alert queue under `Artifacts/Batch runs`. The `source_record` column refers to the original one-based CSV data row. [Batch scoring](https://colab.research.google.com/drive/1eS30UQF9TXxXnARRPxYdCRtq8UG8G5PS)

5. Inspect the 16 missed frauds and compare case recall with amount-weighted recall. [Error analysis](https://colab.research.google.com/drive/13Jq3UQmuWByAOEIYCD9Lnj29R1blhY7C)
6. Compare two queue policies under the same review budget. [Fixed-budget experiment](https://colab.research.google.com/drive/1QqPvniTVj5eCGsy5qvfDi2lodKHQJ7AQ)

Notebooks 03–06 reference the recorded run `20261121T162317186996Z`. The bundle includes its model, metrics and replay CSVs. To trace the foundations independently, run `python 01_numpy_backprop.py`.

## Portfolio decision

Use ANN score order when the goal is detecting the most fraud cases within the available review capacity. On validation, 42 score-ranked reviews caught 42 frauds and covered 95.07% of fraud amount. Choosing the 42 largest amounts among the 84 highest scores caught 24 frauds and covered 97.82% of fraud amount. The extra 230.79 in flagged transaction value came with 18 fewer fraud detections.

On the separate historical test replay, the original ANN caught 69.23% of fraud cases and flagged 59.62% of fraud amount. Two transactions accounted for 69.5% of the missed fraud amount. Transaction face values measure exposure. Estimating savings would require recovery and investigation-cost data.

## What the cutoff means

At the saved ANN cutoff of approximately 0.9998766, validation produced 42 alerts, all true frauds. Lowering it to 0.99 produced 73 alerts and caught 47 frauds. That is 31 additional reviews for five additional frauds caught. Class weighting affects the output scale, so the score serves as a ranking signal. An operating threshold should reflect the team's review capacity and the costs of misses and false alarms.

## Reproduction check

The bundle includes the original checkpoint and the outputs of a second, full CPU training run (`20261121T184214Z_272d93dd`). The fresh ANN reached the same operating counts of 36 true alerts, three false alerts and 16 missed frauds. Its threshold was 0.9993172884 and its trapezoidal PR-AUC was 0.7631. The reference run used 0.9998766184 and reached 0.7733. The README results table uses the reference run. Each ANN checkpoint stores its own threshold and scaling parameters. The latest saved Colab execution selected epoch 6 and caught 34 frauds in 35 alerts (PR-AUC 0.7508). The journal documents all three runs.

## Scope

The dataset covers two days in September 2013. The evaluation measures performance within this historical sample. Applying the model to another payment system would require compatible input transformations, representative recent data and a fresh evaluation.
