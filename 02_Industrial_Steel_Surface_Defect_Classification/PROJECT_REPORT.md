# Project 02 · Industrial steel surface defect classification

I built a PyTorch classifier for a cropped image of a steel defect. My main question was whether a CNN could recognize surface texture better than a fully connected network seeing exactly the same pixels. The first CNN answered that question on validation. The rest of the project was about understanding which defects it still missed and which changes actually helped.

The final model has **5,318 trainable parameters**. It classified **258 of 270 held-out images correctly**, giving **95.56% accuracy** and **0.9557 macro F1**. A warm inspection from local file to six class scores took a median of **4.30 ms** on the measured CPU. [Final test results](Artifacts/final_test_report.json)

## Session 1 · Preparing a fair comparison

I used NEU-CLS, the image-classification version of the NEU Surface Defect Database. Each 200 × 200 grayscale crop has one label. The six classes are crazing, inclusion, patches, pitted surface, rolled-in scale and scratches. Each has 300 examples. I checked the dimensions, mode, filename label and decoded pixel content before using the data. [Dataset authors and download](https://faculty.neu.edu.cn/songkc/en/zdylm/263265/)

I found **1,799 unique pixel arrays across 1,800 files**. Two patches had identical pixels under different names. I kept both in training and saved a single seeded split for every experiment. That gave me 210 training, 45 validation and 45 test crops per class, or 1,260 / 270 / 270 overall. I used the training gallery to inspect variation and kept the test images for the final evaluation. Grouping pixel hashes controls exact duplication. Related crops from the same strip would require production identifiers to group reliably. [Split manifest](Artifacts/split_manifest.csv) · [Training gallery](Artifacts/training_gallery.png)

I traced a scratch from an 8-bit image to a float tensor shaped `[1, 1, 200, 200]`. The axes mean batch, channel, height and width. A histogram shows how much of the crop is bright or dark, but it loses the arrangement of those pixels. Based on the visible textures, I expected crazing and rolled-in scale to cause trouble for the classifier. [Session 1 notebook](01_Explore_Steel_Surface_Images.ipynb)

## Session 2 · Establishing the ANN baseline

I flattened each crop into 40,000 values, applied a dense layer with 64 hidden units and ReLU, then produced six logits. For one image I checked that the negative log of the true-class softmax probability matched cross-entropy computed directly from the logits. I used training-pixel statistics to normalize both training and validation inputs.

With Adam at 0.0003, batch size 64 and 20 epochs, I selected the earliest checkpoint with the highest validation macro F1. Macro F1 averages the six class F1 scores, so each defect contributes equally. The ANN peaked at epoch 19 with **0.5011 macro F1 and 138/270 correct**. The final epoch fell to 0.4252. Two error directions tied at 14 cases each, crazing called pitted surface and rolled-in scale called patches. The model had 2,560,454 parameters, including 2,560,000 weights in the first layer alone. [Session 2 notebook](02_Fully_Connected_Baseline.ipynb) · [ANN metrics and curves](Artifacts/ann_validation.json)

## Session 3 · Replacing dense connections with convolutions

I trained two convolution–ReLU–max pooling blocks using the same full-resolution images, normalization, optimizer settings and epoch budget. The first block learned eight 5 × 5 filters, each reused across the surface. Its stride of two reduced a 200-pixel input width to 100 with padding. The second block learned 16 channels. Adaptive average pooling kept a 4 × 4 grid per channel for the classifier.

With **2,918 parameters**, this model reached **0.7118 macro F1 and 193/270 correct**. The ANN’s two main error counts fell from 14 to zero and from 14 to one. Overall performance improved, but scratch recall slipped from 20/45 to **19/45**. Thirteen scratches were called inclusion and twelve rolled-in scale. Those counts shaped the next experiment. [Session 3 notebook](03_Basic_CNN.ipynb) · [Basic CNN metrics](Artifacts/basic_cnn_validation.json)

**Why the CNN suited these images.** I shifted a training scratch eight pixels right. Its first-layer activations shifted four map columns, exactly as expected for stride two. Away from the borders the aligned maps matched. This is what sharing a filter across positions bought me. The final CNN label still changed from inclusion to scratches on that crop. A moving feature and a stable final prediction are separate properties.

## Session 4 · Testing depth and batch normalization separately

I added a third convolutional block at the same channel width. Before the final averaging step, one feature could now cover **43 × 43** input pixels, up from **19 × 19**. The block also changed spatial sampling. I then trained the deeper network again with batch normalization before each ReLU. Both deeper runs started with identical convolution and classifier weights and used the same minibatch order.

| Validation run | Parameters | Best epoch | Macro F1 | Correct / 270 | Scratches found / 45 |
|---|---:|---:|---:|---:|---:|
| Basic CNN | 2,918 | 20 | 0.7118 | 193 | 19 |
| Third block | 5,238 | 20 | 0.8480 | 230 | 26 |
| Third block + batch normalization | 5,318 | 19 | 0.9408 | 254 | 39 |

Adding the block recovered seven scratches. Normalizing each convolutional channel recovered another thirteen relative to the plain deeper run. Scratch precision also rose from 0.897 to 0.975 between the two deeper models. I kept the normalized model. All six of its remaining missed scratches went to inclusion (four) or pitted surface (two). [Session 4 notebook](04_Depth_and_Batch_Normalization.ipynb) · [Plain deeper run](Artifacts/deep_cnn_validation.json) · [Normalized run](Artifacts/deep_cnn_bn_validation.json)

## Session 5 · Finding which training changes paid off

I previewed horizontal flips and brightness multipliers from 0.9 to 1.1 on real training crops. I applied the transformations only to training. I reset initialization and minibatch order and used independent random draws for flipping and brightness. This made it possible to compare both changes separately and together. I then doubled the learning rate for the strongest augmentation policy while keeping the 20-epoch budget.

| Validation run | Adam learning rate | Macro F1 | Correct / 270 | Scratches found / 45 |
|---|---:|---:|---:|---:|
| No augmentation | 0.0003 | 0.9408 | 254 | 39 |
| Horizontal flips | 0.0003 | 0.9447 | 255 | 40 |
| Brightness changes | 0.0003 | 0.9447 | 255 | 40 |
| Both | 0.0003 | 0.9484 | 256 | 40 |
| Both, doubled learning rate | 0.0006 | 0.9816 | 265 | 44 |

Combining the augmentations gained two correct predictions over the control. At the same combined setting, doubling the learning rate gained another nine. The selected model corrected 14 earlier errors and introduced three, a net gain of 11 over the control. I saved the epoch 18 checkpoint, its class order and normalization values, and recorded its digest before the final test. These comparisons use one seed and one validation split. [Session 5 notebook](05_Optimize_the_CNN.ipynb) · [Selection record](Artifacts/session5_selection.json)

## Session 6 · Held-out evaluation and the inspection demo

I verified the selected checkpoint and manifest digests, checked each test crop against its saved pixel hash and ran the same prediction function used by the demo. The table reports **test** results. Earlier architecture choices used **validation** results.

| Actual defect | Correct / 45 | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| Crazing | 41 | 1.000 | 0.911 | 0.953 |
| Inclusion | 42 | 0.894 | 0.933 | 0.913 |
| Patches | 45 | 0.918 | 1.000 | 0.957 |
| Pitted surface | 44 | 1.000 | 0.978 | 0.989 |
| Rolled-in scale | 45 | 1.000 | 1.000 | 1.000 |
| Scratches | 41 | 0.932 | 0.911 | 0.921 |

**What the twelve errors looked like.** Four scratches were predicted as inclusion, three inclusions as scratches, four crazing images as patches and one pitted surface as inclusion. That accounts for all twelve. Patches had perfect recall, yet four extra images received the patches label. Rolled-in scale had perfect precision and recall on these 45 examples. My original crazing/rolled-in-scale hypothesis had zero test errors in either direction. [Test confusion matrix](Artifacts/test_confusion_matrix.png) · [Per-image predictions](Artifacts/final_test_report.json)

**How long one prediction took.** I measured each path with batch size one, 30 warm-up calls and 270 timed crops on Windows, using PyTorch 2.13.0+cpu and four threads on an Intel Core i7-8650U. The forward pass on a normalized tensor took **2.24 ms median / 7.66 ms p95**. Opening the local file, decoding it, preprocessing it and returning the label and six scores took **4.30 ms median / 7.77 ms p95**. Files could be in the OS cache. Model loading, camera acquisition and plotting fall outside the timing.

The demo accepts a local image path, converts it to grayscale, resizes it to 200 × 200 when needed, and displays the input, predicted defect, all six scores and elapsed time. The first two code cells are sufficient for a custom crop. [Session 6 inspection notebook](06_Steel_Inspection_and_Test_Evaluation.ipynb)

## What I would take into the next project

- **Keep the ANN as a real baseline.** The first convolutional model gained 0.2107 validation macro F1 while shrinking the parameter count from 2.56 million to 2,918. The shifted scratch made the reason for sharing filters visible.
- **Follow a defect through the whole experiment.** Scratch recall exposed a weakness hidden by the basic CNN’s overall gain. It went from 19/45 for the basic CNN to 44/45 for the optimized model on validation, then 41/45 on independent test images.
- **Keep a matched comparison for each training change.** Without the combined-augmentation run at 0.0003, I could easily have credited augmentation for the whole jump to 0.9816. The larger improvement came from the learning-rate comparison under this training budget.

## What remains

The six-session benchmark, held-out evaluation, timing measurements and local demo are complete. There are two open questions with practical consequences.

1. **Would the same experiments rank the models the same way again?** I used one seed and split. Repeated training seeds and an independent set from another steel batch would show how stable the scores and scratch/inclusion errors are. The existing test report is the final result for this run.
2. **Would it work as a production inspector?** NEU-CLS supplies already-cropped defects. A factory decision would need defect-free steel, representative production images, a way to locate candidate regions in full frames and a timing measurement from camera capture through the inspection decision. The reported latency covers the local crop classifier.
