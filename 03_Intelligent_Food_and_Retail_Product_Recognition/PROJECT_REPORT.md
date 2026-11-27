# Project 03 · Session notes

## Session 01 · Food-101 audit and CPU training budget

I wanted a split I could reuse for every model and a realistic starting point for training on my laptop. I checked the 101,000 Food-101 photos from the supplied Kaggle ZIP against the authors’ train and test lists. The preparation helper verified the archive entries and reused matching files from the earlier partial extraction. [Preparation script](prepare_food101.py) · [Executed notebook](01_Explore_Food_101.ipynb)

### Two reasons to set a photo aside

I found 58 groups of identical decoded images, covering 118 files. In the baby back ribs class, training file `620996.jpg` has the same pixels as official test file `620997.jpg`. Learning from the training copy could reward the model for remembering that photo during evaluation. I excluded the training copy. I found 22 training entries like this.

Four other entries formed two pairs with conflicting labels. The same photo appeared under `omelette` and `pancakes`, and another appeared under `prime_rib` and `steak`. The pixels alone give me no basis to choose the intended label from the metadata. I excluded both entries in each pair. For same-label duplicates inside the training pool, I kept each group in a single split. This check detects exact decoded RGB matches. Edited crops and similar shots of the same meal would require a separate near-duplicate review.

| Use | Photos | Photos per dish |
|---|---:|---:|
| Training | 65,624 | 647–650 |
| Validation | 10,100 | 100 |
| Official test | 25,250 | 250 |
| Excluded from the official training pool | 26 | Varies |

I saved the class order and split assignments, then independently checked official membership and confirmed that no exact RGB match crosses the three active splits. Test photos were read for file integrity and duplicate detection only. [Class map](Artifacts/class_map.json) · [Split manifest](Artifacts/split_manifest.csv)

### What resizing changes

Three input photos were grayscale. Converting every input to RGB gives the model three channels consistently. In the gallery, the original pizza has a visible outer crust. The crop keeps the toppings but cuts off much of the rim. That makes a difference if the whole outline is useful for distinguishing dishes. [Originals and center crops](Artifacts/training_gallery.png)

In the ramen example, a 384 × 512 photo became a tensor of shape `(3, 224, 224)`. At the center, the RGB values `(131, 132, 56)` scaled to approximately `(0.514, 0.518, 0.220)`. Subtracting the ImageNet channel means and dividing by their standard deviations gave `(0.125, 0.275, −0.828)`. The negative blue value means this channel is below its reference mean.

### Choosing the first training budget

I measured the cost of one ResNet-18 training update, from reading a JPEG through backpropagation and the optimizer step. Both input sizes used the same training photos and random initialization. The machine was an Intel Core i7-8650U with CPU PyTorch, four compute threads, and batches of eight. I warmed up for three batches, then timed twelve batches per size. The files were recently read. The epoch figures below are projections from those short runs.

| Input crop | Measured images/s | Median time per batch | Estimated full training epoch | Estimated 2,525-image training epoch |
|---|---:|---:|---:|---:|
| 224 × 224 | 6.75 | 1.14 s | 162.1 min | 6.2 min |
| 160 × 160 | 12.03 | 0.68 s | 90.9 min | 3.5 min |

I’ll run Session 02 on a Colab GPU with **224 × 224 crops, all 65,624 training images, and all 10,100 validation images**. The larger crop keeps more input pixels for fine details, and using every eligible photo gives the scratch model more examples per dish. The test set stays reserved. Session 02 measures the assigned GPU, chooses a time budget, and saves its progress to Drive after each epoch.

The 160-pixel pilot figures above are the measured laptop alternative. [Session 02 notebook](02_ResNet18_From_Scratch.ipynb)

## Session 02 · Train ResNet-18 from scratch

I trained every layer on 65,624 photos at 224 × 224. Across ten epochs, validation Top-1 accuracy rose from 11.16% to 54.36%. Epoch 10 had the highest validation macro F1 (0.5437) and reached 80.17% Top-5. Reloading the selected weights reproduced the validation confusion matrix. Among the 100 Greek salad photos, 27 were classified as caprese salad. This is the specific mistake I want to revisit after transfer learning. [Validation results](Artifacts/session02_resnet18_scratch/validation.json)

Colab reported a Tesla T4. Dataset staging took 6 minutes 12 seconds, and the ten epoch timers summed to 64 minutes 47 seconds. With batches of 64, each epoch required 1,026 training updates and 158 validation batches. The short GPU training benchmark measured 202.85 images per second and projected 5.39 minutes of training per epoch. The recorded epoch average of 6.48 minutes included validation. The notebook did not record GPU utilization or separate JPEG decoding from GPU computation. The final verification and export cell took another 57 seconds. [Executed baseline](02_ResNet18_From_Scratch.ipynb)

## Session 03 · Freeze the pretrained backbone

I trained the 51,813 parameters of a new classifier and kept the ImageNet backbone and its batch-normalization statistics fixed. I used the same split, crop, optimizer settings and ten epochs as Session 02. The best macro F1 came at epoch 7. When I reloaded that head, it reproduced the validation confusion matrix. [Executed notebook](03_Frozen_Pretrained_ResNet18.ipynb)

The selected model reached 51.81% Top-1, 77.98% Top-5 and 0.5146 macro F1. The scratch model led by 2.54 percentage points in Top-1. The frozen model called 3 Greek salads caprese salad, down from 27. Its largest error went in a different direction. In total, 44 of 100 hamburgers were called pulled pork sandwiches. These runs change both the initial weights and which layers can learn, so the difference cannot be attributed to initialization alone.

The T4 spent 54.74 minutes in training and 8.99 minutes in validation. Together that was only about one minute faster than Session 02. Every augmented crop still needed decoding and a full forward pass. The log separates training from validation but does not isolate CPU data loading from GPU computation. The next planned experiment is partial fine-tuning. [Session 03 report](Artifacts/session03_resnet18_frozen/validation.json) · [Learning curves](Artifacts/session03_resnet18_frozen/learning_curves.png)

## Session 04 · Does adapting the last residual stage help?

I started both runs from the Session 03 epoch-7 checkpoint. Each saw the same shuffled crops across three additional epochs on a Tesla T4. In the control, only the 51,813 classifier parameters could learn. In the second run, I also trained the last two residual blocks, bringing the total to 8,445,541 trainable parameters. I gave the classifier a learning rate of 0.003 in both runs and the pretrained stage a smaller rate of 0.0003. Batch-normalization running statistics stayed fixed. [Executed notebook](04_Partial_Fine_Tuning.ipynb)

| Validation checkpoint | Additional epoch | Top-1 | Top-5 | Macro F1 |
|---|---:|---:|---:|---:|
| Session 03 starting weights | 0 | 51.81% | 77.98% | 0.5146 |
| Classifier only, highest macro F1 | 2 | 58.47% | 82.16% | 0.5829 |
| Classifier only, final epoch | 3 | 58.44% | 82.17% | 0.5809 |
| Final residual stage and classifier, highest macro F1 and final epoch | 3 | 63.03% | 85.63% | 0.6289 |

More classifier training already improved Top-1 from 51.81% to 58.44% at epoch 3. Unfreezing the final stage added another 4.59 percentage points at that same epoch. Across all three epochs, the recorded training and validation loops took 19.77 minutes for the control and 18.36 minutes for partial fine-tuning. These timings cover one run per setting and exclude staging and final checkpoint verification. [Epoch metrics and confusion matrices](Artifacts/session04_partial_finetuning/validation.json)

Comparing the selected checkpoints photo by photo, partial fine-tuning corrected 869 mistakes and introduced 408, for a net gain of 461. Hamburgers called pulled pork sandwiches fell from 44 per 100 at the start to 9 in the control and 3 with partial fine-tuning. Greek salads called caprese salad went from 3 at the start to 9 in both selected models. The overall gain came with a persistent error on that dish pair. [Per-photo predictions](Artifacts/session04_partial_finetuning/validation_predictions.csv) · [Examples of corrections and regressions](Artifacts/session04_partial_finetuning/paired_changes.png)

As an export check, I rebuilt both validation confusion matrices from the 10,100 saved predictions. I also loaded both published checkpoints on CPU and compared 16 photos against the T4 predictions. The partial model matched all 16. The control matched 15. For pizza image `3314176.jpg`, the CPU model ranked pizza 0.0055 logit units above grilled cheese sandwich, which the T4 had ranked first. The table uses the recorded T4 results.

Session 04 is complete. In Session 05 I plan to compare full fine-tuning with this partial model. The 25,250 official test photos remain reserved for final evaluation.
