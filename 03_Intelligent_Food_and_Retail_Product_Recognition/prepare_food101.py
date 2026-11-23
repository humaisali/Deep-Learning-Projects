"""Prepare the Food-101 images and metadata from the Kaggle download."""
import argparse
from contextlib import contextmanager
from pathlib import Path
import re
import shutil
import tempfile
import zipfile


@contextmanager
def image_archive(source, staging_directory):
    with zipfile.ZipFile(source) as outer:
        if "food-101.zip" in outer.namelist():
            # Keep the inner archive seekable without loading 5 GB into memory.
            with tempfile.TemporaryFile(dir=staging_directory) as temp:
                with outer.open("food-101.zip") as wrapped:
                    shutil.copyfileobj(wrapped, temp, length=4 * 1024 * 1024)
                temp.seek(0)
                with zipfile.ZipFile(temp) as inner:
                    yield inner
        else:
            yield outer


def fix_legacy_offsets(archive):
    # This Kaggle ZIP used 32-bit offsets for a file larger than 4 GiB.
    # Its first local header is at zero, but Python interprets it as 2**32.
    entries = archive.infolist()
    boundary = 2**32
    if not entries or entries[0].header_offset != boundary:
        return
    archive.fp.seek(0)
    if archive.fp.read(4) != b"PK\x03\x04":
        raise ValueError("Unexpected start of inner archive")
    previous = -1
    page = 0
    for entry in entries:
        offset = entry.header_offset % boundary + page
        if offset <= previous:
            page += boundary
            offset += boundary
        if offset >= archive.start_dir:
            raise ValueError(f"Invalid local header offset for {entry.filename}")
        entry.header_offset = offset
        previous = offset
    # ZipFile.open also uses the next header as a bound on compressed data.
    for current, following in zip(entries, entries[1:]):
        current._end_offset = following.header_offset
    entries[-1]._end_offset = archive.start_dir


def prepare(source, destination):
    destination.mkdir(parents=True, exist_ok=True)
    with image_archive(source, destination.parent) as archive:
        fix_legacy_offsets(archive)
        files = {}
        pattern = r"food-101/(images/[a-z0-9_]+/[0-9]+\.jpg|meta/(?:train|test)\.(?:txt|json)|meta/(?:classes|labels)\.txt)"
        for entry in archive.infolist():
            match = re.fullmatch(pattern, entry.filename)
            if match:
                name = match.group(1)
                if name in files:
                    raise ValueError(f"Repeated file in archive: {name}")
                files[name] = entry
        if sum(name.startswith("images/") for name in files) != 101_000:
            raise ValueError("Expected 101,000 Food-101 JPEGs")
        if not {"meta/classes.txt", "meta/train.txt", "meta/test.txt"} <= files.keys():
            raise ValueError("Archive is missing required split metadata")
        matched = 0
        for i, (name, entry) in enumerate(files.items(), 1):
            body = archive.read(entry)  # Checks the local filename and CRC before writing.
            target = destination / name
            if target.is_file() and target.stat().st_size == len(body) and target.read_bytes() == body:
                matched += 1
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as stage:
                    try:
                        stage.write(body)
                        stage.close()
                        Path(stage.name).replace(target)
                    finally:
                        Path(stage.name).unlink(missing_ok=True)
            if i % 20000 == 0:
                print(f"Verified {i:,} files", flush=True)
        print(f"Verified {len(files):,} files, reused {matched:,}, wrote {len(files)-matched:,}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--destination", type=Path, default=Path("Dataset/food-101"))
    args = parser.parse_args()
    prepare(args.archive, args.destination)

