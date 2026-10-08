#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


HERE = Path(__file__).resolve().parent

sys.path.insert(
    0,
    str(HERE),
)

from record import (  # noqa: E402
    AKASHIC_DIR,
    create_origin_record,
)


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--occurred-at",
        required=True,
        help=(
            "Canonical ISO-8601 timestamp "
            "supplied by authoritative system"
        ),
    )

    args = parser.parse_args()

    record = create_origin_record(
        token_id=args.token_id,
        occurred_at=(
            args.occurred_at
        ),
    )

    AKASHIC_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    path = (
        AKASHIC_DIR
        / f"{args.token_id:04d}.json"
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
        "ORIGINX_AKASHIC_CREATE=PASS"
    )

    print(
        f"TOKEN_ID="
        f"{args.token_id}"
    )

    print(
        f"EVENT_COUNT="
        f"{record['eventCount']}"
    )

    print(
        "LATEST_EVENT_HASH="
        + record[
            "latestEventHash"
        ]
    )


if __name__ == "__main__":
    main()
