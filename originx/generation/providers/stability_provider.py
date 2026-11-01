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

    api_key = os.getenv(
        "STABILITY_API_KEY"
    )

    if not api_key:
        raise SystemExit(
            "STABILITY_API_KEY_MISSING"
        )

    # First live OriginX generation is intentionally restricted
    # to token #0001. Batch execution remains disabled.
    if args.token_id != 1:
        raise SystemExit(
            "LIVE_RENDER_TOKEN_NOT_AUTHORIZED"
        )

    import subprocess

    RESULT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        RESULT_DIR
        / f"{args.token_id:04d}-candidate.png"
    )

    error_path = (
        RESULT_DIR
        / f"{args.token_id:04d}-error.txt"
    )

    request_data = request["request"]

    command = [
        "curl",
        "--silent",
        "--show-error",
        "--output",
        str(output_path),
        "--write-out",
        "%{http_code}",
        "--header",
        "@-",
        "--header",
        "accept: image/*",
        "--form",
        "none=",
        "--form",
        f"prompt={request_data['prompt']}",
        "--form",
        (
            "negative_prompt="
            + request_data["negative_prompt"]
        ),
        "--form",
        f"model={request_data['model']}",
        "--form",
        (
            "aspect_ratio="
            + request_data["aspect_ratio"]
        ),
        "--form",
        (
            "output_format="
            + request_data["output_format"]
        ),
        "--form",
        f"seed={request_data['seed']}",
        GENERATION_ENDPOINT,
    ]

    completed = subprocess.run(
        command,
        input=f"authorization: Bearer {api_key}\n",
        capture_output=True,
        text=True,
        check=False,
    )

    http_status = (
        completed.stdout.strip()
    )

    if completed.stderr:
        error_path.write_text(
            completed.stderr,
            encoding="utf-8",
        )

    if http_status != "200":
        if output_path.exists():
            error_body = (
                output_path.read_bytes()
            )

            error_path.write_bytes(
                error_body
            )

            output_path.unlink()

        raise SystemExit(
            "STABILITY_GENERATION_FAILED:"
            + http_status
        )

    if not output_path.exists():
        raise SystemExit(
            "STABILITY_OUTPUT_MISSING"
        )

    data = output_path.read_bytes()

    png_signature = (
        b"\x89PNG\r\n\x1a\n"
    )

    if not data.startswith(
        png_signature
    ):
        raise SystemExit(
            "STABILITY_OUTPUT_NOT_PNG"
        )

    media_hash = hashlib.sha256(
        data
    ).hexdigest()

    result_record = {
        "provider": PROVIDER,
        "model": MODEL,
        "tokenId": args.token_id,
        "renderJobId": (
            request["renderJobId"]
        ),
        "providerRequestHash": (
            request[
                "providerRequestHash"
            ]
        ),
        "seed": request["seed"],
        "status": (
            "CANDIDATE_GENERATED"
        ),
        "candidateFile": (
            str(
                output_path.relative_to(
                    ROOT
                )
            )
        ),
        "candidateMediaHash": (
            media_hash
        ),
        "canonical": False,
        "qualityGate": (
            "NOT_RUN"
        ),
    }

    result_path = (
        RESULT_DIR
        / f"{args.token_id:04d}.json"
    )

    result_path.write_text(
        json.dumps(
            result_record,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "MODE=LIVE_SINGLE_TOKEN"
    )

    print(
        "CANDIDATE_GENERATED=PASS"
    )

    print(
        "CANDIDATE_FILE="
        + str(output_path)
    )

    print(
        "CANDIDATE_MEDIA_HASH="
        + media_hash
    )


if __name__ == "__main__":
    main()
