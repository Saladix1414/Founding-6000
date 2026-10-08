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
    verify_chain,
)


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    path = (
        AKASHIC_DIR
        / f"{args.token_id:04d}.json"
    )

    if not path.exists():
        raise SystemExit(
            "AKASHIC_RECORD_MISSING"
        )

    record = json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )

    verify_chain(
        record
    )

    print(
        "ORIGINX_AKASHIC_VERIFY=PASS"
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
