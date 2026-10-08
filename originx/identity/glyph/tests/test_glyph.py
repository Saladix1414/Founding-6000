#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT),
)

from generate_glyph import (  # noqa: E402
    build_geometry,
    build_svg,
)


def sha256_text(
    value: str,
) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def main() -> None:
    resonance_root = (
        Path(__file__)
        .resolve()
        .parents[2]
        / "output"
        / "resonance"
    )

    import json

    svg_hashes = set()

    for token_id in range(
        1,
        11,
    ):
        path = (
            resonance_root
            / f"{token_id:04d}.json"
        )

        resonance = json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )

        first_svg, first_geometry = (
            build_svg(
                resonance
            )
        )

        second_svg, second_geometry = (
            build_svg(
                resonance
            )
        )

        if first_svg != second_svg:
            raise AssertionError(
                "glyph SVG not deterministic"
            )

        if (
            first_geometry
            != second_geometry
        ):
            raise AssertionError(
                "glyph geometry not deterministic"
            )

        signature = resonance[
            "resonanceSignature"
        ]

        geometry = build_geometry(
            signature
        )

        if not (
            6
            <= geometry["spokeCount"]
            <= 12
        ):
            raise AssertionError(
                "invalid spoke count"
            )

        if not (
            2
            <= geometry["ringCount"]
            <= 5
        ):
            raise AssertionError(
                "invalid ring count"
            )

        if (
            resonance[
                "resonanceSignature"
            ]
            not in first_svg
        ):
            raise AssertionError(
                "signature missing from SVG metadata"
            )

        svg_hashes.add(
            sha256_text(
                first_svg
            )
        )

    if len(svg_hashes) != 10:
        raise AssertionError(
            "glyphs not unique"
        )

    print(
        "ORIGINX_GLYPH_TESTS=PASS"
    )
    print(
        "DETERMINISTIC_GLYPHS_10=PASS"
    )
    print(
        "UNIQUE_GLYPHS_10=PASS"
    )
    print(
        "GEOMETRY_BOUNDS=PASS"
    )
    print(
        "RESONANCE_BINDING=PASS"
    )


if __name__ == "__main__":
    main()
