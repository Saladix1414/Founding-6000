#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT),
)

from build_metadata import (  # noqa: E402
    build_metadata,
    validate_public_metadata,
)


def main() -> None:
    hashes = set()

    for token_id in range(
        1,
        11,
    ):
        first = build_metadata(
            token_id
        )

        second = build_metadata(
            token_id
        )

        if first != second:
            raise AssertionError(
                "metadata not deterministic"
            )

        if first["tokenId"] != token_id:
            raise AssertionError(
                "token mismatch"
            )

        if (
            first["serial"]
            != f"#{token_id:04d}"
        ):
            raise AssertionError(
                "serial mismatch"
            )

        if not first["originx"][
            "dnaHash"
        ]:
            raise AssertionError(
                "missing DNA hash"
            )

        if not first["originx"][
            "resonance"
        ]["resonanceSignature"]:
            raise AssertionError(
                "missing resonance"
            )

        if not first["originx"][
            "glyph"
        ]["svgHash"]:
            raise AssertionError(
                "missing glyph hash"
            )

        if not first["originx"][
            "akashic"
        ]["latestEventHash"]:
            raise AssertionError(
                "missing Akashic hash"
            )

        if (
            first["privacy"][
                "containsPII"
            ]
        ):
            raise AssertionError(
                "metadata contains PII"
            )

        if not first["privacy"][
            "publicSafe"
        ]:
            raise AssertionError(
                "metadata not public safe"
            )

        validate_public_metadata(
            first
        )

        hashes.add(
            first["metadataHash"]
        )

    if len(hashes) != 10:
        raise AssertionError(
            "metadata hashes not unique"
        )

    print(
        "ORIGINX_METADATA_TESTS=PASS"
    )

    print(
        "DETERMINISM_10=PASS"
    )

    print(
        "UNIQUE_METADATA_HASHES_10=PASS"
    )

    print(
        "DNA_LINK=PASS"
    )

    print(
        "RESONANCE_LINK=PASS"
    )

    print(
        "GLYPH_LINK=PASS"
    )

    print(
        "AKASHIC_LINK=PASS"
    )

    print(
        "PUBLIC_PII_GUARD=PASS"
    )


if __name__ == "__main__":
    main()
