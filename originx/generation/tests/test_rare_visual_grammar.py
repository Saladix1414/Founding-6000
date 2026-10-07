#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT / "art")
)

from compile_rare_render_brief import (  # noqa: E402
    compile_render_brief,
)


def load(path: Path):
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def main() -> None:
    grammar = load(
        ROOT
        / "config"
        / "rare_visual_grammar_v1.json"
    )

    if grammar["version"] != "OX-RARE-VISUAL-1":
        raise AssertionError(
            "visual grammar version mismatch"
        )

    if grammar["tier"] != "RARE":
        raise AssertionError(
            "grammar must target RARE"
        )

    if (
        grammar["generationTheme"]
        != "Primitive Origin"
    ):
        raise AssertionError(
            "theme mismatch"
        )

    if grammar["render"]["dragonCount"] != 1:
        raise AssertionError(
            "exactly one dragon required"
        )

    if grammar["render"]["visibleTypography"]:
        raise AssertionError(
            "master artwork must be text-free"
        )

    required_rules = [
        "Exactly one dominant dragon",
        "Dragon silhouette must remain readable",
        "No contemporary city elements",
        "No franchise-derived character design",
    ]

    for rule in required_rules:
        if rule not in grammar["compositionRules"]:
            raise AssertionError(
                f"missing composition rule: {rule}"
            )

    briefs = []

    for token_id in range(
        1,
        101,
    ):
        dna_path = (
            ROOT
            / "output"
            / "dna"
            / f"{token_id:04d}.json"
        )

        if not dna_path.exists():
            raise AssertionError(
                f"missing DNA {token_id}"
            )

        dna = load(
            dna_path
        )

        brief_a = compile_render_brief(
            dna,
            grammar,
        )

        brief_b = compile_render_brief(
            dna,
            grammar,
        )

        if brief_a != brief_b:
            raise AssertionError(
                f"brief not deterministic: {token_id}"
            )

        if (
            brief_a["dragonName"]
            != dna["dragonName"]
        ):
            raise AssertionError(
                f"name mismatch: {token_id}"
            )

        if (
            brief_a["dnaHash"]
            != dna["dnaHash"]
        ):
            raise AssertionError(
                f"DNA hash mismatch: {token_id}"
            )

        if (
            brief_a["render"]["masterWidth"]
            != 2048
        ):
            raise AssertionError(
                "master width mismatch"
            )

        if (
            brief_a["render"]["masterHeight"]
            != 2048
        ):
            raise AssertionError(
                "master height mismatch"
            )

        briefs.append(
            brief_a
        )

    cameras = {
        b["camera"]
        for b in briefs
    }

    poses = {
        b["pose"]
        for b in briefs
    }

    framings = {
        b["framing"]
        for b in briefs
    }

    if len(cameras) < 3:
        raise AssertionError(
            "insufficient camera variation"
        )

    if len(poses) < 3:
        raise AssertionError(
            "insufficient pose variation"
        )

    if len(framings) < 3:
        raise AssertionError(
            "insufficient framing variation"
        )

    print(
        "OX3_VISUAL_GRAMMAR_TESTS=PASS"
    )
    print(
        "DETERMINISTIC_BRIEFS_100=PASS"
    )
    print(
        f"CAMERA_VARIANTS={len(cameras)}"
    )
    print(
        f"POSE_VARIANTS={len(poses)}"
    )
    print(
        f"FRAMING_VARIANTS={len(framings)}"
    )
    print(
        "TEXT_FREE_MASTER=PASS"
    )
    print(
        "SINGLE_DRAGON_RULE=PASS"
    )


if __name__ == "__main__":
    main()
