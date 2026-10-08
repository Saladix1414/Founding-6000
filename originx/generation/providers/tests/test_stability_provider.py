#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT),
)

from stability_provider import (  # noqa: E402
    MODEL,
    build_generation_request,
    derive_provider_seed,
)


def load_json(path: Path):
    import json

    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def main() -> None:
    job_root = (
        Path(__file__)
        .resolve()
        .parents[2]
        / "output"
        / "render-jobs"
    )

    hashes = set()
    seeds = set()

    for token_id in range(
        1,
        11,
    ):
        job = load_json(
            job_root
            / f"{token_id:04d}.json"
        )

        first = build_generation_request(
            job
        )

        second = build_generation_request(
            job
        )

        if first != second:
            raise AssertionError(
                "provider request not deterministic"
            )

        if (
            first["model"]
            != MODEL
        ):
            raise AssertionError(
                "model mismatch"
            )

        seed = derive_provider_seed(
            job["renderRequestHash"]
        )

        if not (
            1
            <= seed
            <= 4294967294
        ):
            raise AssertionError(
                "invalid Stability seed"
            )

        if (
            first["request"][
                "aspect_ratio"
            ]
            != "1:1"
        ):
            raise AssertionError(
                "aspect ratio mismatch"
            )

        if (
            first["request"][
                "output_format"
            ]
            != "png"
        ):
            raise AssertionError(
                "output format mismatch"
            )

        hashes.add(
            first[
                "providerRequestHash"
            ]
        )

        seeds.add(
            first["seed"]
        )

    if len(hashes) != 10:
        raise AssertionError(
            "provider request hashes not unique"
        )

    if len(seeds) != 10:
        raise AssertionError(
            "provider seeds not unique"
        )

    print(
        "ORIGINX_STABILITY_PROVIDER_TESTS=PASS"
    )

    print(
        "DETERMINISTIC_REQUESTS_10=PASS"
    )

    print(
        "UNIQUE_PROVIDER_HASHES_10=PASS"
    )

    print(
        "UNIQUE_SEEDS_10=PASS"
    )

    print(
        "MODEL_SD35_LARGE=PASS"
    )


if __name__ == "__main__":
    main()
