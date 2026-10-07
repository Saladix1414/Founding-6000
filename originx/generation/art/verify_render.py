#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

DNA_DIR = ROOT / "output" / "dna"
BRIEF_DIR = ROOT / "output" / "render-briefs"
RENDER_DIR = ROOT / "output" / "rendered"
QC_DIR = ROOT / "output" / "render-qc"

QC_CONFIG_PATH = (
    ROOT
    / "config"
    / "rare_quality_gate_v1.json"
)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(
            lambda: handle.read(1024 * 1024),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def read_png_dimensions(
    path: Path,
) -> tuple[int, int]:
    data = path.read_bytes()

    if len(data) < 24:
        raise ValueError(
            "INVALID_PNG_SIGNATURE"
        )

    signature = b"\x89PNG\r\n\x1a\n"

    if data[:8] != signature:
        raise ValueError(
            "INVALID_PNG_SIGNATURE"
        )

    if data[12:16] != b"IHDR":
        raise ValueError(
            "INVALID_PNG_SIGNATURE"
        )

    width, height = struct.unpack(
        ">II",
        data[16:24],
    )

    return width, height


def verify_identity(
    dna: dict[str, Any],
    brief: dict[str, Any],
) -> None:
    keys = [
        "tokenId",
        "serial",
        "dragonName",
        "displayName",
        "dnaHash",
    ]

    for key in keys:
        if dna[key] != brief[key]:
            raise ValueError(
                f"IDENTITY_MISMATCH:{key}"
            )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    token_id = args.token_id

    dna_path = (
        DNA_DIR
        / f"{token_id:04d}.json"
    )

    brief_path = (
        BRIEF_DIR
        / f"{token_id:04d}.json"
    )

    render_path = (
        RENDER_DIR
        / f"{token_id:04d}.png"
    )

    if not dna_path.exists():
        raise SystemExit(
            "DNA_RECORD_MISSING"
        )

    if not brief_path.exists():
        raise SystemExit(
            "RENDER_BRIEF_MISSING"
        )

    if not render_path.exists():
        raise SystemExit(
            "FILE_MISSING"
        )

    if render_path.stat().st_size == 0:
        raise SystemExit(
            "EMPTY_FILE"
        )

    dna = load_json(
        dna_path
    )

    brief = load_json(
        brief_path
    )

    qc_config = load_json(
        QC_CONFIG_PATH
    )

    verify_identity(
        dna,
        brief,
    )

    width, height = read_png_dimensions(
        render_path
    )

    required = qc_config["required"]

    automatic_pass = (
        width == required["width"]
        and height == required["height"]
    )

    status = (
        "AWAITING_MANUAL_REVIEW"
        if automatic_pass
        else "REJECTED"
    )

    reasons: list[str] = []

    if not automatic_pass:
        reasons.append(
            "INVALID_DIMENSIONS"
        )

    record = {
        "tokenId": token_id,
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "displayName": dna["displayName"],
        "tier": dna["tier"],
        "generationTheme": (
            dna["generationTheme"]
        ),
        "generationVersion": (
            dna["generationVersion"]
        ),
        "visualGrammarVersion": (
            brief["visualGrammarVersion"]
        ),
        "qualityGateVersion": (
            qc_config["version"]
        ),
        "dnaHash": dna["dnaHash"],
        "seedHash": dna["seedHash"],
        "mediaHash": (
            sha256_file(
                render_path
            )
        ),
        "file": str(
            render_path.relative_to(ROOT)
        ),
        "width": width,
        "height": height,
        "format": "PNG",
        "automaticStatus": status,
        "automaticRejectReasons": reasons,
        "manualReview": {
            "status": "PENDING",
            "criteria": [
                {
                    "criterion": criterion,
                    "status": "PENDING"
                }
                for criterion in qc_config[
                    "manualCriteria"
                ]
            ]
        }
    }

    QC_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output = (
        QC_DIR
        / f"{token_id:04d}.json"
    )

    output.write_text(
        json.dumps(
            record,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "OX3_RENDER_VERIFICATION=PASS"
    )
    print(
        f"TOKEN_ID={token_id}"
    )
    print(
        f"AUTOMATIC_STATUS={status}"
    )
    print(
        f"WIDTH={width}"
    )
    print(
        f"HEIGHT={height}"
    )
    print(
        f"MEDIA_HASH={record['mediaHash']}"
    )


if __name__ == "__main__":
    main()
