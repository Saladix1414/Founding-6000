#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

DNA_DIR = ROOT / "generation" / "output" / "dna"

BUNDLE_DIR = (
    ROOT
    / "identity"
    / "output"
    / "bundles"
)

GLYPH_MANIFEST_DIR = (
    ROOT
    / "identity"
    / "output"
    / "glyph-manifests"
)

AKASHIC_DIR = (
    ROOT
    / "identity"
    / "output"
    / "akashic"
)

RENDER_QC_DIR = (
    ROOT
    / "generation"
    / "output"
    / "render-qc"
)

OUTPUT_DIR = (
    ROOT
    / "metadata"
    / "output"
)


def canonical_json(
    value: Any,
) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_hex(
    value: str,
) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def load_json(
    path: Path,
) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def attribute(
    trait_type: str,
    value: Any,
) -> dict[str, Any]:
    return {
        "trait_type": trait_type,
        "value": value,
    }


def build_attributes(
    dna: dict[str, Any],
    bundle: dict[str, Any],
) -> list[dict[str, Any]]:

    attrs: list[dict[str, Any]] = [
        attribute(
            "Founding Serial",
            dna["serial"],
        ),
        attribute(
            "Tier",
            dna["tier"],
        ),
        attribute(
            "Campaign Phase",
            dna["campaignPhase"],
        ),
        attribute(
            "Generation Theme",
            dna["generationTheme"],
        ),
        attribute(
            "Generation Version",
            dna["generationVersion"],
        ),
        attribute(
            "Resonance ID",
            bundle["resonance"][
                "resonanceId"
            ],
        ),
        attribute(
            "Resonance Class",
            bundle["resonance"][
                "resonanceClass"
            ],
        ),
        attribute(
            "Resonance Spectrum",
            bundle["resonance"][
                "spectrum"
            ],
        ),
    ]

    for trait_name, value in sorted(
        dna["traits"].items()
    ):
        pretty_name = (
            "".join(
                (
                    " " + char
                    if char.isupper()
                    else char
                )
                for char in trait_name
            )
            .strip()
            .title()
        )

        attrs.append(
            attribute(
                pretty_name,
                value,
            )
        )

    return attrs


def detect_visual(
    token_id: int,
) -> dict[str, Any]:

    qc_path = (
        RENDER_QC_DIR
        / f"{token_id:04d}.json"
    )

    if not qc_path.exists():
        return {
            "status": "AWAITING_VISUAL",
            "image": None,
            "mediaHash": None,
            "qualityStatus": None,
        }

    qc = load_json(
        qc_path
    )

    final_status = qc.get(
        "finalStatus"
    )

    if final_status != "APPROVED":
        return {
            "status": "VISUAL_NOT_APPROVED",
            "image": None,
            "mediaHash": qc.get(
                "mediaHash"
            ),
            "qualityStatus": final_status,
        }

    return {
        "status": "VISUAL_APPROVED",
        "image": (
            f"originx://media/"
            f"{token_id:04d}.png"
        ),
        "mediaHash": qc[
            "mediaHash"
        ],
        "qualityStatus": (
            final_status
        ),
    }


def validate_public_metadata(
    metadata: dict[str, Any],
) -> None:

    forbidden_keys = {
        "email",
        "buyerEmail",
        "realName",
        "fullName",
        "orderId",
        "paymentId",
        "privateId",
        "password",
        "secret",
        "authToken",
        "signature",
    }

    def walk(
        value: Any,
        path: str = "",
    ) -> None:

        if isinstance(
            value,
            dict,
        ):
            for key, child in value.items():

                if key in forbidden_keys:
                    raise ValueError(
                        "PUBLIC_METADATA_FORBIDDEN_FIELD:"
                        + (
                            path + "."
                            if path
                            else ""
                        )
                        + key
                    )

                walk(
                    child,
                    (
                        path + "."
                        if path
                        else ""
                    )
                    + key,
                )

        elif isinstance(
            value,
            list,
        ):
            for index, child in enumerate(
                value
            ):
                walk(
                    child,
                    f"{path}[{index}]",
                )

    walk(
        metadata
    )


def build_metadata(
    token_id: int,
) -> dict[str, Any]:

    dna_path = (
        DNA_DIR
        / f"{token_id:04d}.json"
    )

    bundle_path = (
        BUNDLE_DIR
        / f"{token_id:04d}.json"
    )

    glyph_path = (
        GLYPH_MANIFEST_DIR
        / f"{token_id:04d}.json"
    )

    akashic_path = (
        AKASHIC_DIR
        / f"{token_id:04d}.json"
    )

    required = {
        "DNA": dna_path,
        "IDENTITY_BUNDLE": bundle_path,
        "GLYPH": glyph_path,
        "AKASHIC": akashic_path,
    }

    for name, path in required.items():
        if not path.exists():
            raise ValueError(
                f"MISSING_{name}:{token_id}"
            )

    dna = load_json(
        dna_path
    )

    bundle = load_json(
        bundle_path
    )

    glyph = load_json(
        glyph_path
    )

    akashic = load_json(
        akashic_path
    )

    if dna["tokenId"] != token_id:
        raise ValueError(
            "DNA_TOKEN_MISMATCH"
        )

    if bundle["tokenId"] != token_id:
        raise ValueError(
            "BUNDLE_TOKEN_MISMATCH"
        )

    if glyph["tokenId"] != token_id:
        raise ValueError(
            "GLYPH_TOKEN_MISMATCH"
        )

    if akashic["tokenId"] != token_id:
        raise ValueError(
            "AKASHIC_TOKEN_MISMATCH"
        )

    if (
        bundle["dna"]["dnaHash"]
        != dna["dnaHash"]
    ):
        raise ValueError(
            "BUNDLE_DNA_MISMATCH"
        )

    if (
        bundle[
            "resonanceGlyph"
        ]["svgHash"]
        != glyph["svgHash"]
    ):
        raise ValueError(
            "BUNDLE_GLYPH_MISMATCH"
        )

    if (
        bundle[
            "akashic"
        ]["latestEventHash"]
        != akashic["latestEventHash"]
    ):
        raise ValueError(
            "BUNDLE_AKASHIC_MISMATCH"
        )

    visual = detect_visual(
        token_id
    )

    metadata_core = {
        "metadataVersion": (
            "OX-METADATA-1"
        ),

        "name": dna[
            "displayName"
        ],

        "description": (
            "OriginX Founding 6000 digital membership identity. "
            "This token combines a canonical dragon identity, "
            "deterministic generative DNA, OriginX Resonance, "
            "a cryptographic Resonance Glyph and an append-oriented "
            "Akashic provenance record. Spiritual terminology is "
            "used as artistic and narrative language."
        ),

        "tokenId": token_id,
        "serial": dna["serial"],

        "tier": dna["tier"],

        "campaignPhase": (
            dna["campaignPhase"]
        ),

        "generationTheme": (
            dna["generationTheme"]
        ),

        "image": visual[
            "image"
        ],

        "visualStatus": visual[
            "status"
        ],

        "attributes": build_attributes(
            dna,
            bundle,
        ),

        "originx": {
            "dragonName": (
                dna["dragonName"]
            ),

            "dragonTitle": (
                dna["dragonTitle"]
            ),

            "generationVersion": (
                dna["generationVersion"]
            ),

            "dnaHash": (
                dna["dnaHash"]
            ),

            "seedHash": (
                dna["seedHash"]
            ),

            "identityBundleHash": (
                bundle["bundleHash"]
            ),

            "resonance": {
                "version": (
                    bundle[
                        "resonance"
                    ]["resonanceVersion"]
                ),

                "id": (
                    bundle[
                        "resonance"
                    ]["resonanceId"]
                ),

                "resonanceSignature": (
                    bundle[
                        "resonance"
                    ]["resonanceSignature"]
                ),

                "class": (
                    bundle[
                        "resonance"
                    ]["resonanceClass"]
                ),

                "spectrum": (
                    bundle[
                        "resonance"
                    ]["spectrum"]
                ),

                "primaryFrequency": (
                    bundle[
                        "resonance"
                    ]["primaryFrequency"]
                ),

                "secondaryFrequency": (
                    bundle[
                        "resonance"
                    ]["secondaryFrequency"]
                ),

                "pulse": (
                    bundle[
                        "resonance"
                    ]["pulse"]
                ),

                "phaseDegrees": (
                    bundle[
                        "resonance"
                    ]["phaseDegrees"]
                ),
            },

            "glyph": {
                "version": (
                    glyph[
                        "glyphVersion"
                    ]
                ),

                "svg": (
                    "originx://glyph/"
                    + f"{token_id:04d}.svg"
                ),

                "svgHash": (
                    glyph[
                        "svgHash"
                    ]
                ),

                "manifestHash": (
                    glyph[
                        "manifestHash"
                    ]
                ),
            },

            "akashic": {
                "version": (
                    akashic[
                        "akashicVersion"
                    ]
                ),

                "eventCount": (
                    akashic[
                        "eventCount"
                    ]
                ),

                "firstEventHash": (
                    akashic[
                        "firstEventHash"
                    ]
                ),

                "latestEventHash": (
                    akashic[
                        "latestEventHash"
                    ]
                ),
            },

            "visual": {
                "status": (
                    visual["status"]
                ),

                "mediaHash": (
                    visual[
                        "mediaHash"
                    ]
                ),

                "qualityStatus": (
                    visual[
                        "qualityStatus"
                    ]
                ),
            },
        },

        "privacy": {
            "containsPII": False,
            "publicSafe": True,
        },
    }

    metadata_hash = sha256_hex(
        canonical_json(
            metadata_core
        )
    )

    metadata = {
        **metadata_core,
        "metadataHash": (
            metadata_hash
        ),
    }

    validate_public_metadata(
        metadata
    )

    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    metadata = build_metadata(
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
            metadata,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "ORIGINX_METADATA_BUILD=PASS"
    )

    print(
        f"TOKEN_ID="
        f"{args.token_id}"
    )

    print(
        "METADATA_HASH="
        + metadata[
            "metadataHash"
        ]
    )

    print(
        "VISUAL_STATUS="
        + metadata[
            "visualStatus"
        ]
    )


if __name__ == "__main__":
    main()
