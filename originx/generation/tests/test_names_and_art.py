#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

sys.path.insert(
    0,
    str(ROOT / "engine")
)

sys.path.insert(
    0,
    str(ROOT / "art")
)

from generate_dna import (  # noqa: E402
    create_dna_record,
    derive_canonical_name,
    load_config,
)

from compile_rare_art_spec import (  # noqa: E402
    create_art_spec,
)


def main() -> None:
    config = load_config()

    names = [
        derive_canonical_name(
            token_id,
            config,
        )
        for token_id in range(
            1,
            6001,
        )
    ]

    if len(names) != 6000:
        raise AssertionError(
            "expected 6000 names"
        )

    if len(set(names)) != 6000:
        raise AssertionError(
            "canonical names are not unique"
        )

    first = create_dna_record(
        1,
        config,
    )

    first_again = create_dna_record(
        1,
        config,
    )

    if (
        first["dragonName"]
        != first_again["dragonName"]
    ):
        raise AssertionError(
            "name not deterministic"
        )

    if first != first_again:
        raise AssertionError(
            "DNA no longer deterministic"
        )

    art_spec = create_art_spec(
        dna=first,
        config=config,
    )

    if art_spec["tokenId"] != 1:
        raise AssertionError(
            "art token mismatch"
        )

    if art_spec["tier"] != "RARE":
        raise AssertionError(
            "art tier mismatch"
        )

    if (
        first["displayName"]
        not in art_spec["prompt"]
    ):
        raise AssertionError(
            "canonical name missing from prompt"
        )

    if (
        art_spec["canvas"]["masterWidth"]
        != 2048
    ):
        raise AssertionError(
            "invalid master width"
        )

    print(
        "OX3_NAMES_AND_ART_TESTS=PASS"
    )
    print(
        "UNIQUE_CANONICAL_NAMES_6000=PASS"
    )
    print(
        "DETERMINISTIC_NAMES=PASS"
    )
    print(
        "RARE_ART_SPEC=PASS"
    )
    print(
        f"TOKEN_0001_NAME={first['displayName']}"
    )


if __name__ == "__main__":
    main()
