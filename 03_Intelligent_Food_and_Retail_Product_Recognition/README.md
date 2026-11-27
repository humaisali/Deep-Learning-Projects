# Project 03 · Intelligent Food and Retail Product Recognition

I’m starting with a single dish in a photo. The first experiment asks how much ResNet-18 can learn from scratch on Food-101 and how that changes when I start with ImageNet weights. Later sessions will compare mobile candidates and add Pakistani dishes. Recognizing a packaged retail product will require a dataset with product-level labels.

## Session 1 results

I decoded all **101,000 photos**. Twenty-two official training entries had exact matches in the test set, and four more had conflicting dish labels. After setting those aside, I froze a split of **65,624 training**, **10,100 validation**, and **25,250 test** photos. The ResNet-18 timing run reached 12.03 training images per second at 160 × 160 on my laptop CPU. [Session report](PROJECT_REPORT.md) · [Verified split](Artifacts/split_manifest.csv) · [CPU measurements](Artifacts/session1_audit.json)

## Run Session 1

Use Python 3.14 and launch JupyterLab from this project folder. The checked-in manifest uses image paths relative to `Dataset/food-101`. The raw photos and source archive belong in the local `Dataset` directory.

1. Install the notebook dependencies with `python -m pip install -r requirements.txt`.
2. Download Food-101 into the local `Dataset` folder. I used the Kaggle ZIP. Run `python prepare_food101.py Dataset/food-101.zip` from this project folder. The helper opens the nested ZIP, handles the older archive's 4 GiB offset wrap, and checks each file against its stored CRC before writing. Existing identical files are reused. [Food-101 on Kaggle](https://www.kaggle.com/datasets/dansbecker/food-101)
3. Check that `Dataset/food-101/meta/train.txt` and `Dataset/food-101/images/ramen/` exist. If using the authors' `tar.gz` archive instead, extract it to the same directory. [Official Food-101 dataset](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/)
4. Start `python -m jupyterlab`, open [01 · Explore Food-101](01_Explore_Food_101.ipynb), and run the cells in order. Rerunning reads all 101,000 photos and regenerates the session artifacts. The timings will depend on your machine.

## Choosing the first model

ResNet-18 lets me test random initialization, frozen pretrained features, and fine-tuning with a common architecture. For an alternative starting point, DucLeTrong trains InceptionV3 with Keras on Food-101. Yueyang Yin uses MobileNetV3-Large, PyTorch Lightning, and ONNX export for a compact classifier. I’ll return to the mobile alternative after the ResNet experiments. [InceptionV3 implementation](https://github.com/DucLeTrong/food101-classification) · [MobileNetV3 implementation](https://github.com/yueyang-yin/food-101)


## Run Session 02 in Colab

Open the scratch baseline from the Project 03 folder in My Drive under Colab Notebooks. Select a GPU runtime and run the notebook. Allow Colab to mount Drive when prompted. The setup caches the verified official archive in Drive and extracts JPEGs onto runtime storage. The class map and split manifest come from Session 01.

The baseline uses 224 × 224 crops, 65,624 training photos and 10,100 validation photos. A short GPU benchmark sets the epoch count. Running again resumes the latest completed epoch. After training, the best weights, validation metrics, confusion matrix and learning curves are in `Artifacts/session02_resnet18_scratch/`. Those files can be copied back into the matching local project directory. [Session 02 notebook](02_ResNet18_From_Scratch.ipynb)

## Sessions 02 and 03 · Validation results

Both runs used a Tesla T4, 65,624 training photos, 224 × 224 crops and ten epochs. I selected each checkpoint by validation macro F1 on the same 10,100 photos. The 25,250 official test photos are reserved for final evaluation.

| ResNet-18 training recipe | Selected epoch | Top-1 | Top-5 | Macro F1 | Ten epochs including validation |
|---|---:|---:|---:|---:|---:|
| Random initialization, all layers trained | 10 | 54.36% | 80.17% | 0.5437 | 64 min 47 s |
| ImageNet backbone frozen, new classifier trained | 7 | 51.81% | 77.98% | 0.5146 | 63 min 44 s |

Freezing the backbone reduced Greek salad predictions called caprese salad from 27 to 3 per 100. Across all dishes the scratch model still had the higher macro F1. [Session report](PROJECT_REPORT.md)

| Session | Executed notebook | Selected weights | Validation details |
|---|---|---|---|
| 02 | [Train from scratch](02_ResNet18_From_Scratch.ipynb) | [Scratch checkpoint](Artifacts/session02_resnet18_scratch/best.pt) | [Metrics and confusion matrix](Artifacts/session02_resnet18_scratch/validation.json) |
| 03 | [Freeze the backbone](03_Frozen_Pretrained_ResNet18.ipynb) | [Frozen-backbone checkpoint](Artifacts/session03_resnet18_frozen/best.pt) | [Metrics and comparison](Artifacts/session03_resnet18_frozen/validation.json) |

To reproduce from a fresh clone in Colab, copy this project folder into My Drive → Colab Notebooks, name it `Project 03 - Intelligent Food and Retail Product Recognition` (or edit `PROJECT` in the notebook), and open the session notebook with a GPU runtime. Keep the included `Artifacts` directory and both preparation scripts in the project. Session 03 reads the saved Session 02 validation report. Each notebook writes its own resume checkpoint to Drive. The published `best.pt` files contain the full selected model weights, class order and configuration.

## Session 04 · Partial fine-tuning

Starting from the Session 03 epoch-7 checkpoint, I trained each model for three more epochs on the same 224 × 224 crops. I selected the checkpoint with the highest validation macro F1 for each model.

| Trainable layers | Selected additional epoch | Top-1 | Top-5 | Macro F1 |
|---|---:|---:|---:|---:|
| Classifier only | 2 | 58.47% | 82.16% | 0.5829 |
| Final residual stage and classifier | 3 | **63.03%** | **85.63%** | **0.6289** |

Allowing the last stage to adapt yielded 461 more correct predictions on 10,100 validation photos. At the same third epoch, the partially fine-tuned model also led the control by 4.59 percentage points in Top-1. Full fine-tuning is the next planned comparison. [Executed notebook](04_Partial_Fine_Tuning.ipynb) · [Session report](PROJECT_REPORT.md) · [Validation results](Artifacts/session04_partial_finetuning/validation.json)

To reproduce the comparison, open the Session 04 notebook in the same Colab project and run all cells on a GPU. It reads the Session 03 selected weights and validation report, then saves progress after each epoch. The selected weights for both runs are available here. [Classifier-only checkpoint](Artifacts/session04_partial_finetuning/head_only/best.pt) · [Partial fine-tuning checkpoint](Artifacts/session04_partial_finetuning/layer4_and_head/best.pt)
