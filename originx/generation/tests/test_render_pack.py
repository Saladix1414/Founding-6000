#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT / "art")
)

from build_render_pack import (  # noqa: E402
    create_render_job,
)


def load_json(path: Path):
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def main() -> None:
    hashes = set()
    job_ids = set()

    for token_id in range(
        1,
        11,
    ):
        dna = load_json(
            ROOT
            / "output"
            / "dna"
            / f"{token_id:04d}.json"
        )

        brief = load_json(
            ROOT
            / "output"
            / "render-briefs"
            / f"{token_id:04d}.json"
        )

        first = create_render_job(
            dna,
            brief,
        )

        second = create_render_job(
            dna,
            brief,
        )

        if first != second:
            raise AssertionError(
                "render job not deterministic"
            )

        if (
            first["status"]
            != "READY_FOR_RENDER"
        ):
            raise AssertionError(
                "invalid render status"
            )

        if (
            first["provider"]
            != "UNASSIGNED"
        ):
            raise AssertionError(
                "provider unexpectedly assigned"
            )

        if (
            first["model"]
            != "UNASSIGNED"
        ):
            raise AssertionError(
                "model unexpectedly assigned"
            )

        if (
            first["outputPolicy"][
                "watermarkAllowed"
            ]
        ):
            raise AssertionError(
                "watermarks must be prohibited"
            )

        hashes.add(
            first["renderRequestHash"]
        )

        job_ids.add(
            first["renderJobId"]
        )

    if len(hashes) != 10:
        raise AssertionError(
            "render request hashes not unique"
        )

    if len(job_ids) != 10:
        raise AssertionError(
            "render job IDs not unique"
        )

    print(
        "OX3_RENDER_PACK_TESTS=PASS"
    )

    print(
        "DETERMINISTIC_RENDER_JOBS=PASS"
    )

    print(
        "UNIQUE_JOB_HASHES_10=PASS"
    )

    print(
        "UNIQUE_JOB_IDS_10=PASS"
    )

    print(
        "PROVIDER_NEUTRAL=PASS"
    )


if __name__ == "__main__":
    main()
