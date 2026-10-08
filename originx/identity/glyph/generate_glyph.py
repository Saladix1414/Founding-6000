#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]

RESONANCE_DIR = (
    ROOT
    / "identity"
    / "output"
    / "resonance"
)

GLYPH_DIR = (
    ROOT
    / "identity"
    / "output"
    / "glyphs"
)

MANIFEST_DIR = (
    ROOT
    / "identity"
    / "output"
    / "glyph-manifests"
)


SVG_SIZE = 1024
CENTER = SVG_SIZE / 2


def load_json(
    path: Path,
) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def sha256_hex(
    value: str,
) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def file_sha256(
    path: Path,
) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(
            lambda: handle.read(1024 * 1024),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def hex_segment(
    signature: str,
    start: int,
    length: int,
) -> int:
    return int(
        signature[
            start:start + length
        ],
        16,
    )


def point(
    angle_degrees: float,
    radius: float,
) -> tuple[float, float]:
    angle = math.radians(
        angle_degrees - 90
    )

    return (
        CENTER
        + math.cos(angle) * radius,
        CENTER
        + math.sin(angle) * radius,
    )


def fmt(
    value: float,
) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


def build_geometry(
    signature: str,
) -> dict[str, Any]:
    spoke_count = (
        6
        + (
            hex_segment(
                signature,
                0,
                2,
            )
            % 7
        )
    )

    ring_count = (
        2
        + (
            hex_segment(
                signature,
                2,
                2,
            )
            % 4
        )
    )

    rotation = (
        hex_segment(
            signature,
            4,
            4,
        )
        / 0xFFFF
    ) * 360.0

    inner_radius = (
        105
        + (
            hex_segment(
                signature,
                8,
                4,
            )
            % 75
        )
    )

    outer_radius = (
        325
        + (
            hex_segment(
                signature,
                12,
                4,
            )
            % 115
        )
    )

    node_radius = (
        5
        + (
            hex_segment(
                signature,
                16,
                2,
            )
            % 8
        )
    )

    line_weight = round(
        1.5
        + (
            hex_segment(
                signature,
                18,
                2,
            )
            / 255
        )
        * 2.5,
        2,
    )

    phase_offset = (
        hex_segment(
            signature,
            20,
            4,
        )
        / 0xFFFF
    ) * 360.0

    return {
        "spokeCount": spoke_count,
        "ringCount": ring_count,
        "rotationDegrees": round(
            rotation,
            3,
        ),
        "phaseOffsetDegrees": round(
            phase_offset,
            3,
        ),
        "innerRadius": inner_radius,
        "outerRadius": outer_radius,
        "nodeRadius": node_radius,
        "lineWeight": line_weight,
    }


def build_svg(
    resonance: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    signature = resonance[
        "resonanceSignature"
    ]

    geometry = build_geometry(
        signature
    )

    spokes = geometry[
        "spokeCount"
    ]

    rings = geometry[
        "ringCount"
    ]

    rotation = geometry[
        "rotationDegrees"
    ]

    phase = geometry[
        "phaseOffsetDegrees"
    ]

    inner = geometry[
        "innerRadius"
    ]

    outer = geometry[
        "outerRadius"
    ]

    node_radius = geometry[
        "nodeRadius"
    ]

    line_weight = geometry[
        "lineWeight"
    ]

    lines: list[str] = []

    lines.append(
        '<?xml version="1.0" encoding="UTF-8"?>'
    )

    lines.append(
        (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {SVG_SIZE} {SVG_SIZE}" '
            f'width="{SVG_SIZE}" height="{SVG_SIZE}">'
        )
    )

    lines.append(
        "<metadata>"
        + json.dumps(
            {
                "generator": (
                    "OriginX Resonance Glyph v1"
                ),
                "tokenId": resonance[
                    "tokenId"
                ],
                "serial": resonance[
                    "serial"
                ],
                "dragonName": resonance[
                    "dragonName"
                ],
                "resonanceId": resonance[
                    "resonanceId"
                ],
                "resonanceSignature": signature,
            },
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
        + "</metadata>"
    )

    lines.append(
        '<rect width="1024" height="1024" fill="#000"/>'
    )

    lines.append(
        (
            '<g fill="none" '
            'stroke="currentColor" '
            f'stroke-width="{line_weight}" '
            'color="#d7dde5">'
        )
    )

    # Outer and inner structural rings.
    for index in range(
        rings
    ):
        ratio = (
            (index + 1)
            / (rings + 1)
        )

        radius = (
            inner
            + (
                outer - inner
            )
            * ratio
        )

        lines.append(
            (
                f'<circle cx="{fmt(CENTER)}" '
                f'cy="{fmt(CENTER)}" '
                f'r="{fmt(radius)}" '
                'opacity="0.42"/>'
            )
        )

    # Primary spokes.
    outer_points = []

    for index in range(
        spokes
    ):
        angle = (
            rotation
            + (
                index
                * 360.0
                / spokes
            )
        )

        ix, iy = point(
            angle,
            inner,
        )

        ox, oy = point(
            angle,
            outer,
        )

        outer_points.append(
            (ox, oy)
        )

        lines.append(
            (
                f'<line x1="{fmt(ix)}" '
                f'y1="{fmt(iy)}" '
                f'x2="{fmt(ox)}" '
                f'y2="{fmt(oy)}" '
                'opacity="0.88"/>'
            )
        )

    # Polygon connecting outer nodes.
    polygon = " ".join(
        (
            f"{fmt(x)},{fmt(y)}"
        )
        for x, y
        in outer_points
    )

    lines.append(
        (
            f'<polygon points="{polygon}" '
            'opacity="0.72"/>'
        )
    )

    # Secondary phase geometry.
    phase_points = []

    phase_radius = (
        inner
        + (
            outer - inner
        )
        * 0.58
    )

    for index in range(
        spokes
    ):
        angle = (
            phase
            + (
                index
                * 360.0
                / spokes
            )
        )

        x, y = point(
            angle,
            phase_radius,
        )

        phase_points.append(
            (x, y)
        )

    phase_polygon = " ".join(
        (
            f"{fmt(x)},{fmt(y)}"
        )
        for x, y
        in phase_points
    )

    lines.append(
        (
            f'<polygon points="{phase_polygon}" '
            'opacity="0.38"/>'
        )
    )

    # Signature nodes.
    for index, (
        x,
        y,
    ) in enumerate(
        outer_points
    ):
        byte_start = (
            24
            + (
                index * 2
            )
        ) % 62

        amplitude = (
            0.45
            + (
                hex_segment(
                    signature,
                    byte_start,
                    2,
                )
                / 255
            )
            * 0.55
        )

        radius = (
            node_radius
            * amplitude
        )

        lines.append(
            (
                f'<circle cx="{fmt(x)}" '
                f'cy="{fmt(y)}" '
                f'r="{fmt(radius)}" '
                'fill="currentColor" '
                'stroke="none" '
                'opacity="0.9"/>'
            )
        )

    # Central resonance nucleus.
    nucleus = (
        22
        + (
            hex_segment(
                signature,
                48,
                4,
            )
            % 30
        )
    )

    lines.append(
        (
            f'<circle cx="{fmt(CENTER)}" '
            f'cy="{fmt(CENTER)}" '
            f'r="{nucleus}" '
            'opacity="0.95"/>'
        )
    )

    lines.append(
        (
            f'<circle cx="{fmt(CENTER)}" '
            f'cy="{fmt(CENTER)}" '
            f'r="{nucleus / 2}" '
            'fill="currentColor" '
            'stroke="none"/>'
        )
    )

    lines.append(
        "</g>"
    )

    lines.append(
        "</svg>"
    )

    svg = (
        "\n".join(
            lines
        )
        + "\n"
    )

    return (
        svg,
        geometry,
    )


def generate(
    token_id: int,
) -> dict[str, Any]:
    resonance_path = (
        RESONANCE_DIR
        / f"{token_id:04d}.json"
    )

    if not resonance_path.exists():
        raise ValueError(
            "RESONANCE_RECORD_MISSING"
        )

    resonance = load_json(
        resonance_path
    )

    svg, geometry = build_svg(
        resonance
    )

    GLYPH_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    MANIFEST_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    svg_path = (
        GLYPH_DIR
        / f"{token_id:04d}.svg"
    )

    svg_path.write_text(
        svg,
        encoding="utf-8",
    )

    svg_hash = file_sha256(
        svg_path
    )

    manifest_core = {
        "glyphVersion": (
            "OX-RESONANCE-GLYPH-1"
        ),
        "tokenId": resonance[
            "tokenId"
        ],
        "serial": resonance[
            "serial"
        ],
        "dragonName": resonance[
            "dragonName"
        ],
        "displayName": resonance[
            "displayName"
        ],
        "resonanceId": resonance[
            "resonanceId"
        ],
        "resonanceSignature": resonance[
            "resonanceSignature"
        ],
        "glyphSeed": resonance[
            "glyphSeed"
        ],
        "geometry": geometry,
        "svgFile": (
            f"glyphs/{token_id:04d}.svg"
        ),
        "svgHash": svg_hash,
    }

    manifest_hash = sha256_hex(
        json.dumps(
            manifest_core,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
    )

    manifest = {
        **manifest_core,
        "manifestHash": (
            manifest_hash
        ),
    }

    manifest_path = (
        MANIFEST_DIR
        / f"{token_id:04d}.json"
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    manifest = generate(
        args.token_id
    )

    print(
        "ORIGINX_RESONANCE_GLYPH=PASS"
    )

    print(
        f"TOKEN_ID="
        f"{args.token_id}"
    )

    print(
        "SVG_HASH="
        + manifest["svgHash"]
    )

    print(
        "MANIFEST_HASH="
        + manifest["manifestHash"]
    )


if __name__ == "__main__":
    main()
