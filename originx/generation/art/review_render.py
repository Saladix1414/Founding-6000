#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QC_DIR = ROOT / "output" / "render-qc"


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--decision",
        choices=[
            "approve",
            "reject",
        ],
        required=True,
    )

    parser.add_argument(
        "--note",
        default="",
    )

    args = parser.parse_args()

    path = (
        QC_DIR
        / f"{args.token_id:04d}.json"
    )

    if not path.exists():
        raise SystemExit(
            "QC_RECORD_MISSING"
        )

    record = json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )

    if (
        record["automaticStatus"]
        != "AWAITING_MANUAL_REVIEW"
    ):
        raise SystemExit(
            "AUTOMATIC_GATE_NOT_PASSED"
        )

    final_status = (
        "APPROVED"
        if args.decision == "approve"
        else "REJECTED"
    )

    record["manualReview"]["status"] = (
        final_status
    )

    record["manualReview"]["note"] = (
        args.note
    )

    record["finalStatus"] = (
        final_status
    )

    path.write_text(
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
        "OX3_MANUAL_REVIEW=PASS"
    )
    print(
        f"TOKEN_ID={args.token_id}"
    )
    print(
        f"FINAL_STATUS={final_status}"
    )


if __name__ == "__main__":
    main()
