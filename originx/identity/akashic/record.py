#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]

DNA_DIR = (
    ROOT
    / "generation"
    / "output"
    / "dna"
)

RESONANCE_DIR = (
    ROOT
    / "identity"
    / "output"
    / "resonance"
)

AKASHIC_DIR = (
    ROOT
    / "identity"
    / "output"
    / "akashic"
)


GENESIS_PREVIOUS_HASH = (
    "0" * 64
)


ALLOWED_EVENT_TYPES = {
    "DNA_FORGED",
    "NAME_ASSIGNED",
    "RESONANCE_CREATED",
    "RESONANCE_GLYPH_MANIFESTED",
    "VISUAL_MANIFESTED",
    "METADATA_FINALIZED",
    "MINT_QUEUED",
    "MINT_SUBMITTED",
    "MINT_CONFIRMED",
    "NFT_ACTIVATED",
    "ACCESS_ACTIVATED",
    "KEEPER_TRANSITION",
    "OWNER_RECONCILED",
    "ORIGIN_EVENT_COMPLETED",
    "METADATA_VERSIONED",
    "ACCESS_EXPIRED",
}


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


def event_hash(
    event_core: dict[str, Any],
) -> str:
    return sha256_hex(
        canonical_json(
            event_core
        )
    )


def validate_public_payload(
    payload: dict[str, Any],
) -> None:
    forbidden_keys = {
        "email",
        "buyerEmail",
        "realName",
        "fullName",
        "orderId",
        "paymentId",
        "privateId",
        "signature",
        "authToken",
        "password",
        "secret",
    }

    def walk(
        value: Any,
        path: str = "",
    ) -> None:
        if isinstance(
            value,
            dict,
        ):
            for key, child in value.items():
                if key in forbidden_keys:
                    raise ValueError(
                        "FORBIDDEN_PUBLIC_FIELD:"
                        + (
                            path
                            + "."
                            if path
                            else ""
                        )
                        + key
                    )

                walk(
                    child,
                    (
                        path
                        + "."
                        if path
                        else ""
                    )
                    + key,
                )

        elif isinstance(
            value,
            list,
        ):
            for index, child in enumerate(
                value
            ):
                walk(
                    child,
                    f"{path}[{index}]",
                )

    walk(
        payload
    )


def build_event(
    *,
    token_id: int,
    sequence: int,
    event_type: str,
    previous_event_hash: str,
    occurred_at: str,
    payload: dict[str, Any],
) -> dict[str, Any]:

    if sequence < 1:
        raise ValueError(
            "INVALID_EVENT_SEQUENCE"
        )

    if (
        event_type
        not in ALLOWED_EVENT_TYPES
    ):
        raise ValueError(
            "UNSUPPORTED_AKASHIC_EVENT"
        )

    if len(
        previous_event_hash
    ) != 64:
        raise ValueError(
            "INVALID_PREVIOUS_EVENT_HASH"
        )

    validate_public_payload(
        payload
    )

    core = {
        "tokenId": token_id,
        "sequence": sequence,
        "eventType": event_type,
        "occurredAt": occurred_at,
        "previousEventHash": (
            previous_event_hash
        ),
        "payload": payload,
        "akashicVersion": (
            "OX-AKASHIC-1"
        ),
    }

    digest = event_hash(
        core
    )

    return {
        **core,
        "eventHash": digest,
    }


def verify_chain(
    record: dict[str, Any],
) -> None:
    events = record.get(
        "events",
        [],
    )

    previous_hash = (
        GENESIS_PREVIOUS_HASH
    )

    expected_sequence = 1

    for event in events:
        if (
            event["sequence"]
            != expected_sequence
        ):
            raise ValueError(
                "AKASHIC_SEQUENCE_BROKEN"
            )

        if (
            event[
                "previousEventHash"
            ]
            != previous_hash
        ):
            raise ValueError(
                "AKASHIC_PREVIOUS_HASH_BROKEN"
            )

        core = {
            "tokenId": event[
                "tokenId"
            ],
            "sequence": event[
                "sequence"
            ],
            "eventType": event[
                "eventType"
            ],
            "occurredAt": event[
                "occurredAt"
            ],
            "previousEventHash": event[
                "previousEventHash"
            ],
            "payload": event[
                "payload"
            ],
            "akashicVersion": event[
                "akashicVersion"
            ],
        }

        calculated = event_hash(
            core
        )

        if (
            calculated
            != event["eventHash"]
        ):
            raise ValueError(
                "AKASHIC_EVENT_HASH_MISMATCH"
            )

        previous_hash = event[
            "eventHash"
        ]

        expected_sequence += 1


def create_origin_record(
    token_id: int,
    occurred_at: str,
) -> dict[str, Any]:
    dna_path = (
        DNA_DIR
        / f"{token_id:04d}.json"
    )

    resonance_path = (
        RESONANCE_DIR
        / f"{token_id:04d}.json"
    )

    if not dna_path.exists():
        raise ValueError(
            "DNA_RECORD_MISSING"
        )

    if not resonance_path.exists():
        raise ValueError(
            "RESONANCE_RECORD_MISSING"
        )

    dna = load_json(
        dna_path
    )

    resonance = load_json(
        resonance_path
    )

    if (
        dna["tokenId"]
        != resonance["tokenId"]
    ):
        raise ValueError(
            "IDENTITY_MISMATCH"
        )

    events = []

    first = build_event(
        token_id=token_id,
        sequence=1,
        event_type="DNA_FORGED",
        previous_event_hash=(
            GENESIS_PREVIOUS_HASH
        ),
        occurred_at=occurred_at,
        payload={
            "serial": dna["serial"],
            "dragonName": (
                dna["dragonName"]
            ),
            "displayName": (
                dna["displayName"]
            ),
            "tier": dna["tier"],
            "generationTheme": (
                dna[
                    "generationTheme"
                ]
            ),
            "generationVersion": (
                dna[
                    "generationVersion"
                ]
            ),
            "dnaHash": (
                dna["dnaHash"]
            ),
        },
    )

    events.append(
        first
    )

    second = build_event(
        token_id=token_id,
        sequence=2,
        event_type="NAME_ASSIGNED",
        previous_event_hash=(
            first["eventHash"]
        ),
        occurred_at=occurred_at,
        payload={
            "dragonName": (
                dna["dragonName"]
            ),
            "dragonTitle": (
                dna["dragonTitle"]
            ),
            "displayName": (
                dna["displayName"]
            ),
        },
    )

    events.append(
        second
    )

    third = build_event(
        token_id=token_id,
        sequence=3,
        event_type=(
            "RESONANCE_CREATED"
        ),
        previous_event_hash=(
            second["eventHash"]
        ),
        occurred_at=occurred_at,
        payload={
            "resonanceId": (
                resonance[
                    "resonanceId"
                ]
            ),
            "resonanceSignature": (
                resonance[
                    "resonanceSignature"
                ]
            ),
            "spectrum": (
                resonance["spectrum"]
            ),
            "resonanceClass": (
                resonance[
                    "resonanceClass"
                ]
            ),
            "glyphSeed": (
                resonance[
                    "glyphSeed"
                ]
            ),
        },
    )

    events.append(
        third
    )

    record = {
        "tokenId": token_id,
        "serial": dna["serial"],
        "dragonName": (
            dna["dragonName"]
        ),
        "displayName": (
            dna["displayName"]
        ),
        "akashicVersion": (
            "OX-AKASHIC-1"
        ),
        "eventCount": len(
            events
        ),
        "firstEventHash": (
            events[0]["eventHash"]
        ),
        "latestEventHash": (
            events[-1]["eventHash"]
        ),
        "events": events,
    }

    verify_chain(
        record
    )

    return record


def append_event(
    record: dict[str, Any],
    *,
    event_type: str,
    occurred_at: str,
    payload: dict[str, Any],
) -> dict[str, Any]:

    verify_chain(
        record
    )

    events = list(
        record["events"]
    )

    previous_hash = (
        events[-1]["eventHash"]
        if events
        else GENESIS_PREVIOUS_HASH
    )

    event = build_event(
        token_id=record["tokenId"],
        sequence=len(events) + 1,
        event_type=event_type,
        previous_event_hash=(
            previous_hash
        ),
        occurred_at=occurred_at,
        payload=payload,
    )

    events.append(
        event
    )

    updated = {
        **record,
        "eventCount": len(
            events
        ),
        "latestEventHash": (
            event["eventHash"]
        ),
        "events": events,
    }

    verify_chain(
        updated
    )

    return updated
