#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT),
)

from build_bundle import build_bundle  # noqa: E402


def main() -> None:
    hashes = set()

    for token_id in range(1, 11):
        first = build_bundle(token_id)
        second = build_bundle(token_id)

        if first != second:
            raise AssertionError(
                f"bundle not deterministic: {token_id}"
            )

        if first["tokenId"] != token_id:
            raise AssertionError(
                "token mismatch"
            )

        if not first["privacy"]["publicSafe"]:
            raise AssertionError(
                "bundle must be public safe"
            )

        if first["privacy"]["containsPII"]:
            raise AssertionError(
                "bundle must not contain PII"
            )

        if not first["resonance"]["resonanceSignature"]:
            raise AssertionError(
                "missing resonance signature"
            )

        if not first["resonanceGlyph"]["svgHash"]:
            raise AssertionError(
                "missing glyph SVG hash"
            )

        if not first["resonanceGlyph"]["manifestHash"]:
            raise AssertionError(
                "missing glyph manifest hash"
            )

        if first["akashic"]["eventCount"] < 3:
            raise AssertionError(
                "invalid Akashic event count"
            )

        hashes.add(
            first["bundleHash"]
        )

    if len(hashes) != 10:
        raise AssertionError(
            "bundle hashes not unique"
        )

    print("ORIGINX_IDENTITY_BUNDLE_TESTS=PASS")
    print("DETERMINISM_10=PASS")
    print("UNIQUE_BUNDLE_HASHES_10=PASS")
    print("PII_GUARD=PASS")
    print("RESONANCE_LINK=PASS")
    print("AKASHIC_LINK=PASS")
    print("GLYPH_LINK=PASS")


if __name__ == "__main__":
    main()
