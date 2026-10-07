#!/usr/bin/env python3

from __future__ import annotations

import json
import struct
import sys
import tempfile
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT / "art")
)

from verify_render import (  # noqa: E402
    read_png_dimensions,
    verify_identity,
)


def create_test_png(
    path: Path,
    width: int,
    height: int,
) -> None:
    def chunk(
        chunk_type: bytes,
        data: bytes,
    ) -> bytes:
        body = (
            chunk_type
            + data
        )

        return (
            struct.pack(
                ">I",
                len(data),
            )
            + body
            + struct.pack(
                ">I",
                zlib.crc32(body)
                & 0xFFFFFFFF,
            )
        )

    signature = b"\x89PNG\r\n\x1a\n"

    ihdr = struct.pack(
        ">IIBBBBB",
        width,
        height,
        8,
        2,
        0,
        0,
        0,
    )

    raw = b"".join(
        b"\x00"
        + b"\x00\x00\x00"
        * width
        for _ in range(height)
    )

    data = (
        signature
        + chunk(
            b"IHDR",
            ihdr,
        )
        + chunk(
            b"IDAT",
            zlib.compress(raw),
        )
        + chunk(
            b"IEND",
            b"",
        )
    )

    path.write_bytes(
        data
    )


def main() -> None:
    dna = json.loads(
        (
            ROOT
            / "output"
            / "dna"
            / "0001.json"
        ).read_text()
    )

    brief = json.loads(
        (
            ROOT
            / "output"
            / "render-briefs"
            / "0001.json"
        ).read_text()
    )

    verify_identity(
        dna,
        brief,
    )

    with tempfile.TemporaryDirectory() as tmp:
        path = (
            Path(tmp)
            / "test.png"
        )

        create_test_png(
            path,
            2048,
            2048,
        )

        width, height = (
            read_png_dimensions(
                path
            )
        )

        if width != 2048:
            raise AssertionError(
                "width mismatch"
            )

        if height != 2048:
            raise AssertionError(
                "height mismatch"
            )

    print(
        "OX3_RENDER_PIPELINE_TESTS=PASS"
    )
    print(
        "IDENTITY_BINDING=PASS"
    )
    print(
        "PNG_DIMENSIONS=PASS"
    )


if __name__ == "__main__":
    main()
