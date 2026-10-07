#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

DNA_DIR = ROOT / "output" / "dna"
BRIEF_DIR = ROOT / "output" / "render-briefs"
JOB_DIR = ROOT / "output" / "render-jobs"
PACK_DIR = ROOT / "output" / "render-packs"


def canonical_json(
    value: Any,
) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_text(
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


def create_render_job(
    dna: dict[str, Any],
    brief: dict[str, Any],
) -> dict[str, Any]:

    identity_keys = [
        "tokenId",
        "serial",
        "dragonName",
        "displayName",
        "dnaHash",
    ]

    for key in identity_keys:
        if dna[key] != brief[key]:
            raise ValueError(
                f"IDENTITY_MISMATCH:{key}"
            )

    request_core = {
        "tokenId": dna["tokenId"],
        "serial": dna["serial"],
        "dragonName": dna["dragonName"],
        "dragonTitle": dna["dragonTitle"],
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

        "dnaHash": dna["dnaHash"],
        "seedHash": dna["seedHash"],

        "render": brief["render"],

        "camera": brief["camera"],
        "pose": brief["pose"],
        "framing": brief["framing"],

        "positivePrompt": (
            brief["positivePrompt"]
        ),

        "negativePrompt": (
            brief["negativePrompt"]
        ),

        "provider": "UNASSIGNED",
        "model": "UNASSIGNED",

        "candidateCount": 1,

        "outputPolicy": {
            "masterFormat": "PNG",
            "masterWidth": 2048,
            "masterHeight": 2048,
            "textFreeArtwork": True,
            "watermarkAllowed": False,
            "postGenerationUpscaleAllowed": True,
            "manualReviewRequired": True
        }
    }

    request_hash = sha256_text(
        canonical_json(
            request_core
        )
    )

    render_job_id = (
        "oxr-"
        + f"{dna['tokenId']:04d}"
        + "-"
        + request_hash[:16]
    )

    return {
        "renderJobId": render_job_id,
        "renderRequestHash": request_hash,
        "status": "READY_FOR_RENDER",
        **request_core,
    }


def build_pack(
    start: int,
    count: int,
) -> dict[str, Any]:

    if start < 1:
        raise ValueError(
            "INVALID_START"
        )

    if count < 1:
        raise ValueError(
            "INVALID_COUNT"
        )

    end = start + count - 1

    if end > 1000:
        raise ValueError(
            "OX3_RARE_RANGE_ONLY"
        )

    jobs = []

    JOB_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    PACK_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    for token_id in range(
        start,
        end + 1,
    ):
        dna_path = (
            DNA_DIR
            / f"{token_id:04d}.json"
        )

        brief_path = (
            BRIEF_DIR
            / f"{token_id:04d}.json"
        )

        if not dna_path.exists():
            raise ValueError(
                f"MISSING_DNA:{token_id}"
            )

        if not brief_path.exists():
            raise ValueError(
                f"MISSING_RENDER_BRIEF:{token_id}"
            )

        dna = load_json(
            dna_path
        )

        brief = load_json(
            brief_path
        )

        job = create_render_job(
            dna=dna,
            brief=brief,
        )

        job_path = (
            JOB_DIR
            / f"{token_id:04d}.json"
        )

        job_path.write_text(
            json.dumps(
                job,
                indent=2,
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )

        jobs.append(
            job
        )

    pack_core = {
        "packVersion": (
            "OX-RARE-RENDER-PACK-1"
        ),

        "tier": "RARE",

        "generationTheme": (
            "Primitive Origin"
        ),

        "startToken": start,
        "endToken": end,
        "count": len(jobs),

        "jobs": [
            {
                "tokenId": job["tokenId"],
                "serial": job["serial"],
                "dragonName": (
                    job["dragonName"]
                ),
                "displayName": (
                    job["displayName"]
                ),
                "renderJobId": (
                    job["renderJobId"]
                ),
                "renderRequestHash": (
                    job["renderRequestHash"]
                ),
                "dnaHash": (
                    job["dnaHash"]
                )
            }
            for job in jobs
        ]
    }

    pack_hash = sha256_text(
        canonical_json(
            pack_core
        )
    )

    pack = {
        **pack_core,
        "packHash": pack_hash,
        "provider": "UNASSIGNED",
        "model": "UNASSIGNED",
        "status": "READY_FOR_RENDER"
    }

    pack_path = (
        PACK_DIR
        / (
            f"rare-{start:04d}-"
            f"{end:04d}.json"
        )
    )

    pack_path.write_text(
        json.dumps(
            pack,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return {
        "pack": pack,
        "path": pack_path,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Build OriginX RARE "
            "render candidate pack"
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

    try:
        result = build_pack(
            start=args.start,
            count=args.count,
        )
    except ValueError as exc:
        raise SystemExit(
            str(exc)
        ) from exc

    pack = result["pack"]

    print(
        "OX3_RENDER_PACK=PASS"
    )

    print(
        f"START_TOKEN="
        f"{pack['startToken']}"
    )

    print(
        f"END_TOKEN="
        f"{pack['endToken']}"
    )

    print(
        f"COUNT={pack['count']}"
    )

    print(
        f"PACK_HASH="
        f"{pack['packHash']}"
    )

    print(
        f"PACK_FILE="
        f"{result['path']}"
    )


if __name__ == "__main__":
    main()
