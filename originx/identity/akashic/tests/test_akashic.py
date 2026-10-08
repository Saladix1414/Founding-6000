#!/usr/bin/env python3

from __future__ import annotations

import copy
import sys
from pathlib import Path


ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

sys.path.insert(
    0,
    str(ROOT),
)

from record import (  # noqa: E402
    append_event,
    build_event,
    create_origin_record,
    validate_public_payload,
    verify_chain,
)


TIMESTAMP = (
    "2026-01-01T00:00:00Z"
)


def main() -> None:
    record = create_origin_record(
        token_id=1,
        occurred_at=TIMESTAMP,
    )

    if (
        record["eventCount"]
        != 3
    ):
        raise AssertionError(
            "origin record must "
            "start with 3 events"
        )

    verify_chain(
        record
    )

    updated = append_event(
        record,
        event_type=(
            "VISUAL_MANIFESTED"
        ),
        occurred_at=TIMESTAMP,
        payload={
            "mediaHash": (
                "a" * 64
            ),
            "artDirectionVersion": (
                "OX-ART-1"
            ),
        },
    )

    if (
        updated["eventCount"]
        != 4
    ):
        raise AssertionError(
            "append failed"
        )

    verify_chain(
        updated
    )

    tampered = copy.deepcopy(
        updated
    )

    tampered[
        "events"
    ][0]["payload"][
        "dragonName"
    ] = "TAMPERED"

    try:
        verify_chain(
            tampered
        )
    except ValueError as exc:
        if (
            str(exc)
            != "AKASHIC_EVENT_HASH_MISMATCH"
        ):
            raise
    else:
        raise AssertionError(
            "tamper should be detected"
        )

    try:
        validate_public_payload(
            {
                "email": (
                    "private@example.com"
                )
            }
        )
    except ValueError as exc:
        if not str(exc).startswith(
            "FORBIDDEN_PUBLIC_FIELD:"
        ):
            raise
    else:
        raise AssertionError(
            "PII field should fail"
        )

    genesis = build_event(
        token_id=1,
        sequence=1,
        event_type="DNA_FORGED",
        previous_event_hash=(
            "0" * 64
        ),
        occurred_at=TIMESTAMP,
        payload={
            "dnaHash": (
                "b" * 64
            )
        },
    )

    genesis_repeat = (
        build_event(
            token_id=1,
            sequence=1,
            event_type=(
                "DNA_FORGED"
            ),
            previous_event_hash=(
                "0" * 64
            ),
            occurred_at=TIMESTAMP,
            payload={
                "dnaHash": (
                    "b" * 64
                )
            },
        )
    )

    if (
        genesis
        != genesis_repeat
    ):
        raise AssertionError(
            "event hashing not deterministic"
        )

    print(
        "ORIGINX_AKASHIC_TESTS=PASS"
    )

    print(
        "GENESIS_EVENTS=PASS"
    )

    print(
        "APPEND_ONLY_CHAIN=PASS"
    )

    print(
        "TAMPER_DETECTION=PASS"
    )

    print(
        "PUBLIC_PII_GUARD=PASS"
    )

    print(
        "DETERMINISTIC_EVENT_HASH=PASS"
    )


if __name__ == "__main__":
    main()
