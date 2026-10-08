#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

JOB_DIR = (
    ROOT
    / "output"
    / "render-jobs"
)

REQUEST_DIR = (
    ROOT
    / "output"
    / "provider-requests"
)

RESULT_DIR = (
    ROOT
    / "output"
    / "provider-results"
)


PROVIDER = "STABILITY_AI"
MODEL = "sd3.5-large"
GENERATION_ENDPOINT = (
    "https://api.stability.ai/"
    "v2beta/stable-image/generate/sd3"
)

UPSCALE_ENDPOINT = (
    "https://api.stability.ai/"
    "v2beta/stable-image/upscale/conservative"
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


def derive_provider_seed(
    render_request_hash: str,
) -> int:
    raw = int(
        render_request_hash[:8],
        16,
    )

    # Stability valid deterministic seed range.
    return (
        raw % 4294967294
    ) + 1


def build_generation_request(
    job: dict[str, Any],
) -> dict[str, Any]:

    seed = derive_provider_seed(
        job["renderRequestHash"]
    )

    request = {
        "provider": PROVIDER,
        "model": MODEL,
        "endpoint": (
            GENERATION_ENDPOINT
        ),
        "tokenId": job["tokenId"],
        "renderJobId": (
            job["renderJobId"]
        ),
        "renderRequestHash": (
            job["renderRequestHash"]
        ),
        "seed": seed,
        "request": {
            "prompt": (
                job["positivePrompt"]
            ),
            "negative_prompt": (
                job["negativePrompt"]
            ),
            "model": MODEL,
            "aspect_ratio": "1:1",
            "output_format": "png",
            "seed": seed,
        },
        "upscale": {
            "provider": PROVIDER,
            "endpoint": (
                UPSCALE_ENDPOINT
            ),
            "mode": "conservative",
            "output_format": "png",
            "targetPolicy": (
                "4MP_SOURCE_THEN_CANONICAL_2048"
            ),
        },
    }

    request["providerRequestHash"] = (
        sha256_hex(
            canonical_json(
                request
            )
        )
    )

    return request


def write_request(
    token_id: int,
) -> dict[str, Any]:

    job_path = (
        JOB_DIR
        / f"{token_id:04d}.json"
    )

    if not job_path.exists():
        raise ValueError(
            f"RENDER_JOB_MISSING:{token_id}"
        )

    job = load_json(
        job_path
    )

    request = build_generation_request(
        job
    )

    REQUEST_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = (
        REQUEST_DIR
        / f"{token_id:04d}.json"
    )

    path.write_text(
        json.dumps(
            request,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return request


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--execute",
        action="store_true",
    )

    args = parser.parse_args()

    request = write_request(
        args.token_id
    )

    print(
        "ORIGINX_STABILITY_REQUEST=PASS"
    )

    print(
        f"TOKEN_ID={args.token_id}"
    )

    print(
        f"MODEL={MODEL}"
    )

    print(
        f"SEED={request['seed']}"
    )

    print(
        "PROVIDER_REQUEST_HASH="
        + request[
            "providerRequestHash"
        ]
    )

    if not args.execute:
        print(
            "MODE=DRY_RUN"
        )
        return

    if not os.getenv(
        "STABILITY_API_KEY"
    ):
        raise SystemExit(
            "STABILITY_API_KEY_MISSING"
        )

    raise SystemExit(
        "EXECUTION_NOT_ENABLED_YET"
    )


if __name__ == "__main__":
    main()
