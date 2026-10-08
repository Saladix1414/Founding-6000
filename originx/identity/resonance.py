#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DNA_DIR = ROOT / "generation" / "output" / "dna"


def sha256_hex(value: str) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def derive_resonance_signature(
    token_id: int,
    generation_version: str,
    dna_hash: str,
) -> str:
    payload = (
        "ORIGINX_RESONANCE"
        + generation_version
        + str(token_id)
        + dna_hash
    )

    return sha256_hex(payload)


def segment(
    signature: str,
    start: int,
    length: int,
) -> int:
    return int(
        signature[start:start + length],
        16,
    )


def derive_resonance(
    dna: dict[str, Any],
) -> dict[str, Any]:

    signature = derive_resonance_signature(
        token_id=int(dna["tokenId"]),
        generation_version=dna["generationVersion"],
        dna_hash=dna["dnaHash"],
    )

    # Artistic mappings only — not physical measurements.
    primary_hz = round(
        174.0
        + (
            segment(signature, 0, 8)
            / 0xFFFFFFFF
        )
        * (963.0 - 174.0),
        2,
    )

    secondary_hz = round(
        174.0
        + (
            segment(signature, 8, 8)
            / 0xFFFFFFFF
        )
        * (963.0 - 174.0),
        2,
    )

    pulse = round(
        1.0
        + (
            segment(signature, 16, 8)
            / 0xFFFFFFFF
        )
        * 11.0,
        2,
    )

    phase = round(
        (
            segment(signature, 24, 8)
            / 0xFFFFFFFF
        )
        * 360.0,
        2,
    )

    spectra = [
        "Obsidian-Cyan",
        "Crimson-Graphite",
        "Moonstone-Blue",
        "Basalt-Violet",
        "Iron-Ember",
        "Void-Silver",
        "Ancient-Gold",
        "Black-Scarlet",
    ]

    classes = [
        "PRIMORDIAL",
        "WARDEN",
        "ECHO",
        "CATALYST",
        "ASCENDANT",
        "RELIC",
        "VEIL",
        "NEXUS",
    ]

    spectrum = spectra[
        segment(signature, 32, 4)
        % len(spectra)
    ]

    resonance_class = classes[
        segment(signature, 36, 4)
        % len(classes)
    ]

    resonance_id = (
        "RX-"
        + signature[:12].upper()
    )

    glyph_seed = sha256_hex(
        "ORIGINX_GLYPH"
        + signature
    )

    return {
        "tokenId": dna["tokenId"],
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "displayName": dna["displayName"],
        "generationVersion": (
            dna["generationVersion"]
        ),
        "dnaHash": dna["dnaHash"],
        "resonanceVersion": (
            "OX-RESONANCE-1"
        ),
        "resonanceId": resonance_id,
        "resonanceSignature": signature,
        "primaryFrequency": {
            "value": primary_hz,
            "unit": "Hz",
            "meaning": (
                "artistic deterministic representation"
            )
        },
        "secondaryFrequency": {
            "value": secondary_hz,
            "unit": "Hz",
            "meaning": (
                "artistic deterministic representation"
            )
        },
        "pulse": pulse,
        "phaseDegrees": phase,
        "spectrum": spectrum,
        "resonanceClass": resonance_class,
        "glyphSeed": glyph_seed,
    }


def load_dna(token_id: int) -> dict[str, Any]:
    path = (
        DNA_DIR
        / f"{token_id:04d}.json"
    )

    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    record = derive_resonance(
        load_dna(args.token_id)
    )

    print(
        json.dumps(
            record,
            indent=2,
            ensure_ascii=False,
        )
    )
