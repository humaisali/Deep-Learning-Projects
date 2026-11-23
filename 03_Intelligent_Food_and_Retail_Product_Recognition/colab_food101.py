"""Stage the verified Food-101 archive on a hosted Colab runtime."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile

ARCHIVE_MD5 = "85eeb15f3717b99a5da872d97d918f87"
SOURCE = "https://data.vision.ee.ethz.ch/cvl/food-101.tar.gz"


def archive_digest(path):
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def stage_food(project, runtime):
    runtime.mkdir(parents=True, exist_ok=True)
    root = runtime / "food-101"
    marker = root / ".food101-ready"
    if marker.exists() and marker.read_text() == ARCHIVE_MD5:
        return root
    cache = project / "Dataset"
    cache.mkdir(exist_ok=True)
    # A new VM needs a local copy even when Drive already has the archive.
    with tempfile.TemporaryDirectory(dir=runtime) as temp:
        staging = Path(temp)
        archive = staging / "food-101.tar.gz"
        cached = cache / archive.name
        supplied_zip = cache / "food-101.zip"
        if supplied_zip.is_file() and not cached.is_file():
            local_zip = staging / supplied_zip.name
            shutil.copyfile(supplied_zip, local_zip)
            subprocess.run([sys.executable, str(project / "prepare_food101.py"), str(local_zip),
                            "--destination", str(staging / "food-101")], check=True)
        else:
            if cached.is_file():
                shutil.copyfile(cached, archive)
            if not archive.exists() or archive_digest(archive) != ARCHIVE_MD5:
                print("Downloading Food-101 to runtime storage.", flush=True)
                subprocess.run(["curl", "--fail", "--location", "--retry", "3", "--output",
                                str(archive), SOURCE], check=True)
                if archive_digest(archive) != ARCHIVE_MD5:
                    raise ValueError("Food-101 checksum mismatch")
                with tempfile.NamedTemporaryFile(dir=cache, delete=False) as temp_cache:
                    pending = Path(temp_cache.name)
                try:
                    shutil.copyfile(archive, pending)
                    pending.replace(cached)
                finally:
                    pending.unlink(missing_ok=True)
            with tarfile.open(archive, "r|gz") as dataset:
                for item in dataset:
                    if item.isfile() and item.name.startswith(("food-101/images/", "food-101/meta/")):
                        dataset.extract(item, staging, filter="data")
        unpacked = staging / "food-101"
        if not (unpacked / "meta/train.txt").is_file():
            raise ValueError("Missing Food-101 metadata")
        (unpacked / ".food101-ready").write_text(ARCHIVE_MD5)
        unpacked.rename(root)
    return root

