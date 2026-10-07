#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

CONFIG = (
    ROOT
    / "config"
    / "generation_v1.json"
)

DNA_DIR = (
    ROOT
    / "output"
    / "dna"
)

ART_SPEC_DIR = (
    ROOT
    / "output"
    / "art-specs"
)


def load_json(
    path: Path,
) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def build_art_prompt(
    dna: dict[str, Any],
    config: dict[str, Any],
) -> str:
    traits = dna["traits"]

    art = config["artDirection"]["rare"]

    positive = [
        config["artDirection"]["collectionStyle"],
        art["visualEra"],
        f"character: {dna['displayName']}",
        f"dragon archetype: {traits['dragonArchetype']}",
        f"body: {traits['bodyStructure']}",
        f"scales: {traits['scalePattern']}",
        f"head: {traits['headStructure']}",
        f"horns: {traits['hornConfiguration']}",
        f"eyes: {traits['eyeConfiguration']}",
        f"wings: {traits['wings']}",
        f"tail: {traits['tail']}",
        f"armor: {traits['armor']}",
        f"chest core: {traits['chestCore']}",
        (
            "mechanical augmentation: "
            + traits["mechanicalAugmentation"]
        ),
        f"markings: {traits['ancientMarkings']}",
        f"OriginX glyph: {traits['originxGlyph']}",
        f"aura: {traits['aura']}",
        f"location: {traits['backgroundCity']}",
        (
            "architecture: "
            + traits["skylineArchitecture"]
        ),
        f"atmosphere: {traits['atmosphere']}",
        f"weather: {traits['weather']}",
        f"foreground: {traits['foreground']}",
        art["lighting"],
        art["composition"],
        "square collectible master composition",
        "no visible written prompt text",
    ]

    negative = art["prohibited"]

    return (
        ". ".join(positive)
        + ". Avoid: "
        + ", ".join(negative)
        + "."
    )


def create_art_spec(
    dna: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, Any]:

    if dna["tier"] != "RARE":
        raise ValueError(
            "OX3_RARE_ONLY"
        )

    art = config["artDirection"]["rare"]

    return {
        "tokenId": dna["tokenId"],
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "dragonTitle": dna["dragonTitle"],
        "displayName": dna["displayName"],
        "tier": dna["tier"],
        "generationTheme": dna["generationTheme"],
        "generationVersion": dna["generationVersion"],
        "artDirectionVersion": (
            config["artDirection"]["version"]
        ),
        "nameSystemVersion": (
            config["nameSystem"]["version"]
        ),
        "dnaHash": dna["dnaHash"],
        "seedHash": dna["seedHash"],
        "canvas": {
            "masterWidth": 2048,
            "masterHeight": 2048,
            "aspectRatio": "1:1",
            "preferredFormat": "PNG"
        },
        "materials": art["materials"],
        "palette": art["palette"],
        "traits": dna["traits"],
        "prompt": build_art_prompt(
            dna=dna,
            config=config,
        ),
        "negativeConcepts": (
            art["prohibited"]
        )
    }


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--start",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--count",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    if args.count < 1:
        raise SystemExit(
            "COUNT_MUST_BE_POSITIVE"
        )

    config = load_json(CONFIG)

    ART_SPEC_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    created = 0

    for token_id in range(
        args.start,
        args.start + args.count,
    ):

        dna_path = (
            DNA_DIR
            / f"{token_id:04d}.json"
        )

        if not dna_path.exists():
            raise SystemExit(
                f"MISSING_DNA:{token_id}"
            )

        dna = load_json(
            dna_path
        )

        spec = create_art_spec(
            dna=dna,
            config=config,
        )

        output = (
            ART_SPEC_DIR
            / f"{token_id:04d}.json"
        )

        output.write_text(
            json.dumps(
                spec,
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

        created += 1

    print(
        "OX3_RARE_ART_SPEC=PASS"
    )
    print(
        f"COUNT={created}"
    )


if __name__ == "__main__":
    main()
