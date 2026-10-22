#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

sys.path.insert(
    0,
    str(
        ROOT
        / "engine"
    ),
)

from generate_dna import (  # noqa: E402
    create_dna_record,
    load_config,
)


def main() -> None:
    config = load_config()

    first = create_dna_record(
        1,
        config,
    )

    repeat = create_dna_record(
        1,
        config,
    )

    second = create_dna_record(
        2,
        config,
    )

    if first != repeat:
        raise AssertionError(
            "override not deterministic"
        )

    if first["tokenId"] != 1:
        raise AssertionError(
            "token mismatch"
        )

    if first["serial"] != "#0001":
        raise AssertionError(
            "serial mismatch"
        )

    if first["tier"] != "RARE":
        raise AssertionError(
            "tier mismatch"
        )

    if first["dragonName"] != "Azhurak":
        raise AssertionError(
            "Azhurak override missing"
        )

    if (
        first["dragonTitle"]
        != "The Primordial Witness"
    ):
        raise AssertionError(
            "Azhurak title mismatch"
        )

    if (
        first["displayName"]
        !=
        "Azhurak — The Primordial Witness"
    ):
        raise AssertionError(
            "display name mismatch"
        )

    if (
        first["identitySource"]
        != "CANONICAL_OVERRIDE"
    ):
        raise AssertionError(
            "identity source mismatch"
        )

    if (
        second["identitySource"]
        != "DETERMINISTIC_NAME_SYSTEM"
    ):
        raise AssertionError(
            "ordinary deterministic token altered"
        )

    if (
        second["dragonName"]
        != "Vaerkaath"
    ):
        raise AssertionError(
            "token 2 name unexpectedly changed"
        )

    if first["seedHash"] != repeat["seedHash"]:
        raise AssertionError(
            "seed changed between runs"
        )

    if first["dnaHash"] != repeat["dnaHash"]:
        raise AssertionError(
            "DNA hash not deterministic"
        )

    print(
        "OX_CANONICAL_OVERRIDE_TEST=PASS"
    )

    print(
        "TOKEN_0001=AZHURAK"
    )

    print(
        "TOKEN_0001_TITLE=THE_PRIMORDIAL_WITNESS"
    )

    print(
        "TOKEN_0001_IDENTITY_SOURCE=CANONICAL_OVERRIDE"
    )

    print(
        "TOKEN_0002_DETERMINISTIC=PASS"
    )

    print(
        "BLOCKCHAIN_AUTHORITY=NO"
    )

    print(
        "MINT_AUTHORITY=NO"
    )


if __name__ == "__main__":
    main()
