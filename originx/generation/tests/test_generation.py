#!/usr/bin/env python3

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENGINE_DIR = ROOT / "engine"

sys.path.insert(
    0,
    str(ENGINE_DIR),
)

from generate_dna import (  # noqa: E402
    create_dna_record,
    load_config,
    validate_unique,
)


def assert_true(
    condition: bool,
    message: str,
) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    config = load_config()

    first = create_dna_record(
        1,
        config,
    )

    first_repeat = create_dna_record(
        1,
        config,
    )

    assert_true(
        first == first_repeat,
        "token 1 must be deterministic",
    )

    assert_true(
        first["tokenId"] == 1,
        "token id mismatch",
    )

    assert_true(
        first["serial"] == "#0001",
        "serial mismatch",
    )

    assert_true(
        first["tier"] == "RARE",
        "token 1 must be RARE",
    )

    token_1000 = create_dna_record(
        1000,
        config,
    )

    token_1001 = create_dna_record(
        1001,
        config,
    )

    token_3000 = create_dna_record(
        3000,
        config,
    )

    token_3001 = create_dna_record(
        3001,
        config,
    )

    token_6000 = create_dna_record(
        6000,
        config,
    )

    assert_true(
        token_1000["tier"] == "RARE",
        "1000 tier mismatch",
    )

    assert_true(
        token_1001["tier"] == "EPIC",
        "1001 tier mismatch",
    )

    assert_true(
        token_3000["tier"] == "EPIC",
        "3000 tier mismatch",
    )

    assert_true(
        token_3001["tier"] == "LEGENDARY",
        "3001 tier mismatch",
    )

    assert_true(
        token_6000["tier"] == "LEGENDARY",
        "6000 tier mismatch",
    )

    batch = [
        create_dna_record(
            token_id,
            config,
        )
        for token_id in range(
            1,
            11,
        )
    ]

    validate_unique(batch)

    assert_true(
        len(
            {
                record["dnaHash"]
                for record in batch
            }
        )
        == 10,
        "10 DNA hashes must be unique",
    )

    assert_true(
        len(
            {
                json.dumps(
                    record["traits"],
                    sort_keys=True,
                )
                for record in batch
            }
        )
        == 10,
        "10 trait configurations must be unique",
    )

    try:
        create_dna_record(
            0,
            config,
        )
    except ValueError as exc:
        assert_true(
            str(exc)
            == "TOKEN_ID_OUT_OF_RANGE",
            "token 0 wrong error",
        )
    else:
        raise AssertionError(
            "token 0 should fail"
        )

    try:
        create_dna_record(
            6001,
            config,
        )
    except ValueError as exc:
        assert_true(
            str(exc)
            == "TOKEN_ID_OUT_OF_RANGE",
            "token 6001 wrong error",
        )
    else:
        raise AssertionError(
            "token 6001 should fail"
        )

    print("OX2_GENERATION_TESTS=PASS")
    print("DETERMINISM=PASS")
    print("TIER_BOUNDARIES=PASS")
    print("TOKEN_RANGE=PASS")
    print("UNIQUE_DNA_10=PASS")
    print("UNIQUE_TRAITS_10=PASS")


if __name__ == "__main__":
    main()
