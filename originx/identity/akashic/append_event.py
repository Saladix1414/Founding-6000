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
    append_event,
)


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--event-type",
        required=True,
    )

    parser.add_argument(
        "--occurred-at",
        required=True,
    )

    parser.add_argument(
        "--payload-json",
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

    payload = json.loads(
        args.payload_json
    )

    updated = append_event(
        record,
        event_type=(
            args.event_type
        ),
        occurred_at=(
            args.occurred_at
        ),
        payload=payload,
    )

    path.write_text(
        json.dumps(
            updated,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        "ORIGINX_AKASHIC_APPEND=PASS"
    )

    print(
        f"TOKEN_ID="
        f"{args.token_id}"
    )

    print(
        f"EVENT_COUNT="
        f"{updated['eventCount']}"
    )

    print(
        "LATEST_EVENT_HASH="
        + updated[
            "latestEventHash"
        ]
    )


if __name__ == "__main__":
    main()
