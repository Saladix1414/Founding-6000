#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]

DNA_DIR = ROOT / "generation" / "output" / "dna"
RESONANCE_DIR = ROOT / "identity" / "output" / "resonance"
AKASHIC_DIR = ROOT / "identity" / "output" / "akashic"
GLYPH_MANIFEST_DIR = ROOT / "identity" / "output" / "glyph-manifests"
BRIEF_DIR = ROOT / "generation" / "output" / "render-briefs"
ART_SPEC_DIR = ROOT / "generation" / "output" / "art-specs"
OUTPUT_DIR = ROOT / "identity" / "output" / "bundles"


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_hex(value: str) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def verify_identity(
    dna: dict[str, Any],
    resonance: dict[str, Any],
    akashic: dict[str, Any],
    render_brief: dict[str, Any],
) -> None:
    token_id = dna["tokenId"]

    for source_name, source in [
        ("resonance", resonance),
        ("akashic", akashic),
        ("render", render_brief),
    ]:
        if source["tokenId"] != token_id:
            raise ValueError(
                f"IDENTITY_TOKEN_MISMATCH:{source_name}"
            )

    expected = {
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "displayName": dna["displayName"],
    }

    for key, value in expected.items():
        for source_name, source in [
            ("resonance", resonance),
            ("akashic", akashic),
            ("render", render_brief),
        ]:
            if source[key] != value:
                raise ValueError(
                    f"IDENTITY_MISMATCH:{source_name}:{key}"
                )

    if resonance["dnaHash"] != dna["dnaHash"]:
        raise ValueError(
            "RESONANCE_DNA_HASH_MISMATCH"
        )

    if render_brief["dnaHash"] != dna["dnaHash"]:
        raise ValueError(
            "RENDER_DNA_HASH_MISMATCH"
        )


def build_bundle(
    token_id: int,
) -> dict[str, Any]:

    dna_path = DNA_DIR / f"{token_id:04d}.json"
    resonance_path = RESONANCE_DIR / f"{token_id:04d}.json"
    akashic_path = AKASHIC_DIR / f"{token_id:04d}.json"
    glyph_manifest_path = (
        GLYPH_MANIFEST_DIR
        / f"{token_id:04d}.json"
    )
    brief_path = BRIEF_DIR / f"{token_id:04d}.json"
    art_spec_path = ART_SPEC_DIR / f"{token_id:04d}.json"

    required = {
        "DNA": dna_path,
        "RESONANCE": resonance_path,
        "AKASHIC": akashic_path,
        "GLYPH_MANIFEST": glyph_manifest_path,
        "RENDER_BRIEF": brief_path,
    }

    for name, path in required.items():
        if not path.exists():
            raise ValueError(
                f"MISSING_{name}:{token_id}"
            )

    dna = load_json(dna_path)
    resonance = load_json(resonance_path)
    akashic = load_json(akashic_path)
    glyph_manifest = load_json(
        glyph_manifest_path
    )
    render_brief = load_json(brief_path)

    art_spec = (
        load_json(art_spec_path)
        if art_spec_path.exists()
        else None
    )

    verify_identity(
        dna,
        resonance,
        akashic,
        render_brief,
    )

    if glyph_manifest["tokenId"] != token_id:
        raise ValueError(
            "GLYPH_TOKEN_MISMATCH"
        )

    if (
        glyph_manifest["resonanceSignature"]
        != resonance["resonanceSignature"]
    ):
        raise ValueError(
            "GLYPH_RESONANCE_MISMATCH"
        )

    if (
        glyph_manifest["resonanceId"]
        != resonance["resonanceId"]
    ):
        raise ValueError(
            "GLYPH_RESONANCE_ID_MISMATCH"
        )

    core = {
        "bundleVersion": "OX-IDENTITY-BUNDLE-1",
        "tokenId": dna["tokenId"],
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "dragonTitle": dna["dragonTitle"],
        "displayName": dna["displayName"],
        "tier": dna["tier"],
        "campaignPhase": dna["campaignPhase"],
        "generationTheme": dna["generationTheme"],
        "generationVersion": dna["generationVersion"],

        "dna": {
            "dnaHash": dna["dnaHash"],
            "seedHash": dna["seedHash"],
            "traits": dna["traits"],
        },

        "resonance": {
            "resonanceVersion": resonance["resonanceVersion"],
            "resonanceId": resonance["resonanceId"],
            "resonanceSignature": resonance["resonanceSignature"],
            "primaryFrequency": resonance["primaryFrequency"],
            "secondaryFrequency": resonance["secondaryFrequency"],
            "pulse": resonance["pulse"],
            "phaseDegrees": resonance["phaseDegrees"],
            "spectrum": resonance["spectrum"],
            "resonanceClass": resonance["resonanceClass"],
            "glyphSeed": resonance["glyphSeed"],
        },

        "resonanceGlyph": {
            "glyphVersion": glyph_manifest[
                "glyphVersion"
            ],
            "resonanceId": glyph_manifest[
                "resonanceId"
            ],
            "svgFile": glyph_manifest[
                "svgFile"
            ],
            "svgHash": glyph_manifest[
                "svgHash"
            ],
            "manifestHash": glyph_manifest[
                "manifestHash"
            ],
            "geometry": glyph_manifest[
                "geometry"
            ],
        },

        "visualIdentity": {
            "visualGrammarVersion": render_brief[
                "visualGrammarVersion"
            ],
            "camera": render_brief["camera"],
            "pose": render_brief["pose"],
            "framing": render_brief["framing"],
            "render": render_brief["render"],
            "artSpecAvailable": (
                art_spec is not None
            ),
        },

        "akashic": {
            "akashicVersion": akashic["akashicVersion"],
            "eventCount": akashic["eventCount"],
            "firstEventHash": akashic["firstEventHash"],
            "latestEventHash": akashic["latestEventHash"],
        },

        "privacy": {
            "containsPII": False,
            "publicSafe": True,
        },
    }

    bundle_hash = sha256_hex(
        canonical_json(core)
    )

    return {
        **core,
        "bundleHash": bundle_hash,
    }


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    bundle = build_bundle(
        args.token_id
    )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = (
        OUTPUT_DIR
        / f"{args.token_id:04d}.json"
    )

    path.write_text(
        json.dumps(
            bundle,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print("ORIGINX_IDENTITY_BUNDLE=PASS")
    print(f"TOKEN_ID={args.token_id}")
    print(f"BUNDLE_HASH={bundle['bundleHash']}")
    print(f"FILE={path}")


if __name__ == "__main__":
    main()
