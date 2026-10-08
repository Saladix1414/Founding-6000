#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT)
)

from resonance import (  # noqa: E402
    derive_resonance,
    load_dna,
)


def main() -> None:
    signatures = set()
    ids = set()

    for token_id in range(
        1,
        101,
    ):
        dna = load_dna(
            token_id
        )

        first = derive_resonance(
            dna
        )

        second = derive_resonance(
            dna
        )

        if first != second:
            raise AssertionError(
                f"resonance not deterministic: {token_id}"
            )

        signatures.add(
            first["resonanceSignature"]
        )

        ids.add(
            first["resonanceId"]
        )

        if not (
            174.0
            <= first[
                "primaryFrequency"
            ]["value"]
            <= 963.0
        ):
            raise AssertionError(
                "primary frequency out of range"
            )

        if not (
            0.0
            <= first["phaseDegrees"]
            <= 360.0
        ):
            raise AssertionError(
                "phase out of range"
            )

    if len(signatures) != 100:
        raise AssertionError(
            "duplicate resonance signature"
        )

    if len(ids) != 100:
        raise AssertionError(
            "duplicate resonance ID"
        )

    print(
        "ORIGINX_RESONANCE_TESTS=PASS"
    )
    print(
        "DETERMINISM_100=PASS"
    )
    print(
        "UNIQUE_SIGNATURES_100=PASS"
    )
    print(
        "UNIQUE_RESONANCE_IDS_100=PASS"
    )


if __name__ == "__main__":
    main()
