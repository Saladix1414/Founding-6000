#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

CONFIG_PATH = ROOT / "config" / "generation_v1.json"
GRAMMAR_PATH = ROOT / "config" / "rare_visual_grammar_v1.json"
DNA_DIR = ROOT / "output" / "dna"
OUTPUT_DIR = ROOT / "output" / "render-briefs"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def sha256_index(
    seed_hash: str,
    namespace: str,
    count: int,
) -> int:
    import hashlib

    if count <= 0:
        raise ValueError(
            f"EMPTY_VISUAL_OPTION:{namespace}"
        )

    payload = (
        f"{seed_hash}:"
        f"OX-RARE-VISUAL-1:"
        f"{namespace}"
    )

    digest = hashlib.sha256(
        payload.encode("utf-8")
    ).hexdigest()

    return int(
        digest,
        16,
    ) % count


def deterministic_choice(
    seed_hash: str,
    namespace: str,
    options: list[str],
) -> str:
    return options[
        sha256_index(
            seed_hash,
            namespace,
            len(options),
        )
    ]


def trait_modifiers(
    traits: dict[str, str],
    grammar: dict[str, Any],
) -> list[str]:
    modifiers: list[str] = []

    rules = grammar["traitRules"]

    checks = [
        ("armor", traits["armor"]),
        (
            "mechanicalAugmentation",
            traits["mechanicalAugmentation"],
        ),
        ("aura", traits["aura"]),
        ("weather", traits["weather"]),
        (
            "specialVariation",
            traits["specialVariation"],
        ),
    ]

    for trait_name, value in checks:
        key = f"{trait_name}.{value}"

        if key in rules:
            modifiers.extend(
                rules[key]
            )

    return modifiers


def build_positive_prompt(
    dna: dict[str, Any],
    grammar: dict[str, Any],
    camera: str,
    pose: str,
    framing: str,
    modifiers: list[str],
) -> str:
    traits = dna["traits"]

    parts = [
        "Original OriginX dark gothic dragon artwork",
        "Primitive Origin era",
        "one dominant dragon only",
        camera,
        pose,
        framing,
        (
            "dragon archetype "
            + traits["dragonArchetype"]
        ),
        (
            "body structure "
            + traits["bodyStructure"]
        ),
        (
            "scale pattern "
            + traits["scalePattern"]
        ),
        (
            "head structure "
            + traits["headStructure"]
        ),
        (
            "horn configuration "
            + traits["hornConfiguration"]
        ),
        (
            "eyes "
            + traits["eyeConfiguration"]
        ),
        (
            "wings "
            + traits["wings"]
        ),
        (
            "tail "
            + traits["tail"]
        ),
        (
            "armor "
            + traits["armor"]
        ),
        (
            "chest core "
            + traits["chestCore"]
        ),
        (
            "mechanical augmentation "
            + traits["mechanicalAugmentation"]
        ),
        (
            "ancient markings "
            + traits["ancientMarkings"]
        ),
        (
            "OriginX glyph treatment "
            + traits["originxGlyph"]
        ),
        (
            "aura "
            + traits["aura"]
        ),
        (
            "environment "
            + traits["backgroundCity"]
        ),
        (
            "architecture "
            + traits["skylineArchitecture"]
        ),
        (
            "atmosphere "
            + traits["atmosphere"]
        ),
        (
            "weather "
            + traits["weather"]
        ),
        (
            "foreground "
            + traits["foreground"]
        ),
        (
            "special variation "
            + traits["specialVariation"]
        ),
        "cinematic low-key lighting",
        "volumetric atmospheric depth",
        "ancient basalt and weathered metal material realism",
        "monumental scale",
        "high detail",
        "text-free master artwork",
        "square collectible composition",
    ]

    parts.extend(
        modifiers
    )

    return ". ".join(parts) + "."


def compile_render_brief(
    dna: dict[str, Any],
    grammar: dict[str, Any],
) -> dict[str, Any]:
    if dna["tier"] != "RARE":
        raise ValueError(
            "OX3_RARE_ONLY"
        )

    if (
        grammar["tier"] != "RARE"
        or grammar["generationTheme"]
        != "Primitive Origin"
    ):
        raise ValueError(
            "VISUAL_GRAMMAR_TIER_MISMATCH"
        )

    seed_hash = dna["seedHash"]

    camera = deterministic_choice(
        seed_hash,
        "camera",
        grammar["camera"],
    )

    pose = deterministic_choice(
        seed_hash,
        "pose",
        grammar["pose"],
    )

    framing = deterministic_choice(
        seed_hash,
        "framing",
        grammar["framing"],
    )

    modifiers = trait_modifiers(
        dna["traits"],
        grammar,
    )

    return {
        "tokenId": dna["tokenId"],
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "dragonTitle": dna["dragonTitle"],
        "displayName": dna["displayName"],
        "tier": dna["tier"],
        "generationTheme": dna["generationTheme"],
        "generationVersion": dna["generationVersion"],
        "visualGrammarVersion": grammar["version"],
        "seedHash": dna["seedHash"],
        "dnaHash": dna["dnaHash"],
        "camera": camera,
        "pose": pose,
        "framing": framing,
        "depthLayers": grammar["depthLayers"],
        "visualHierarchy": grammar["visualHierarchy"],
        "materials": grammar["materialPriority"],
        "technologyLevel": grammar[
            "technologyLevel"
        ]["name"],
        "traitModifiers": modifiers,
        "traits": dna["traits"],
        "render": grammar["render"],
        "positivePrompt": build_positive_prompt(
            dna=dna,
            grammar=grammar,
            camera=camera,
            pose=pose,
            framing=framing,
            modifiers=modifiers,
        ),
        "negativePrompt": ", ".join(
            grammar["forbiddenConcepts"]
            + grammar[
                "technologyLevel"
            ]["prohibited"]
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Compile deterministic OriginX "
            "RARE render briefs"
        )
    )

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

    config = load_json(
        CONFIG_PATH
    )

    grammar = load_json(
        GRAMMAR_PATH
    )

    end = (
        args.start
        + args.count
        - 1
    )

    if (
        args.start < 1
        or end > 1000
    ):
        raise SystemExit(
            "OX3_RARE_RANGE_ONLY"
        )

    if (
        config["generationVersion"]
        != "OX-GEN-1"
    ):
        raise SystemExit(
            "UNEXPECTED_GENERATION_VERSION"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    created = 0

    for token_id in range(
        args.start,
        end + 1,
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

        brief = compile_render_brief(
            dna=dna,
            grammar=grammar,
        )

        output = (
            OUTPUT_DIR
            / f"{token_id:04d}.json"
        )

        output.write_text(
            json.dumps(
                brief,
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

        created += 1

    print(
        "OX3_RENDER_BRIEFS=PASS"
    )
    print(
        f"START_TOKEN={args.start}"
    )
    print(
        f"END_TOKEN={end}"
    )
    print(
        f"COUNT={created}"
    )


if __name__ == "__main__":
    main()
