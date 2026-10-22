#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "generation_v1.json"
CANONICAL_OVERRIDES_PATH = (
    ROOT
    / "config"
    / "canonical_overrides_v1.json"
)
DNA_OUTPUT_DIR = ROOT / "output" / "dna"
MANIFEST_OUTPUT_DIR = ROOT / "output" / "manifests"


@dataclass(frozen=True)
class Tier:
    name: str
    campaign_phase: str
    serial_start: int
    serial_end: int
    generation_theme: str


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def load_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def load_canonical_overrides() -> dict[str, Any]:
    if not CANONICAL_OVERRIDES_PATH.exists():
        return {
            "version": "OX-CANONICAL-OVERRIDES-1",
            "tokens": {},
        }

    return json.loads(
        CANONICAL_OVERRIDES_PATH.read_text(
            encoding="utf-8"
        )
    )


def resolve_canonical_identity(
    token_id: int,
    *,
    derived_name: str,
    derived_title: str,
) -> dict[str, str]:
    overrides = load_canonical_overrides()

    raw = (
        overrides
        .get("tokens", {})
        .get(str(token_id))
    )

    if raw is None:
        return {
            "dragonName": derived_name,
            "dragonTitle": derived_title,
            "displayName": (
                f"{derived_name} — {derived_title}"
            ),
            "identitySource": "DETERMINISTIC_NAME_SYSTEM",
        }

    if int(raw.get("tokenId", -1)) != token_id:
        raise ValueError(
            "CANONICAL_OVERRIDE_TOKEN_MISMATCH"
        )

    expected_serial = f"#{token_id:04d}"

    if raw.get("serial") != expected_serial:
        raise ValueError(
            "CANONICAL_OVERRIDE_SERIAL_MISMATCH"
        )

    dragon_name = str(
        raw["dragonName"]
    ).strip()

    dragon_title = str(
        raw["dragonTitle"]
    ).strip()

    display_name = str(
        raw["displayName"]
    ).strip()

    if not dragon_name:
        raise ValueError(
            "CANONICAL_OVERRIDE_NAME_EMPTY"
        )

    if not dragon_title:
        raise ValueError(
            "CANONICAL_OVERRIDE_TITLE_EMPTY"
        )

    expected_display = (
        f"{dragon_name} — {dragon_title}"
    )

    if display_name != expected_display:
        raise ValueError(
            "CANONICAL_OVERRIDE_DISPLAY_MISMATCH"
        )

    return {
        "dragonName": dragon_name,
        "dragonTitle": dragon_title,
        "displayName": display_name,
        "identitySource": "CANONICAL_OVERRIDE",
    }


def resolve_tier(token_id: int, config: dict[str, Any]) -> Tier:
    for raw in config["tiers"]:
        if raw["serialStart"] <= token_id <= raw["serialEnd"]:
            return Tier(
                name=raw["name"],
                campaign_phase=raw["campaignPhase"],
                serial_start=raw["serialStart"],
                serial_end=raw["serialEnd"],
                generation_theme=raw["generationTheme"],
            )

    raise ValueError("TOKEN_ID_OUT_OF_RANGE")


def derive_seed(
    namespace: str,
    generation_version: str,
    token_id: int,
) -> str:
    payload = f"{namespace}{generation_version}{token_id}"
    return sha256_hex(payload)


def derive_index(
    seed_hex: str,
    trait_name: str,
    option_count: int,
) -> int:
    if option_count <= 0:
        raise ValueError(f"EMPTY_TRAIT_OPTIONS:{trait_name}")

    digest = sha256_hex(f"{seed_hex}:{trait_name}")
    return int(digest, 16) % option_count


def derive_canonical_name(
    token_id: int,
    config: dict[str, Any],
) -> str:
    """
    Collision-free OriginX canonical dragon name.

    The three lexical dimensions form exactly:

        20 * 20 * 15 = 6000

    possible names.

    tokenId 1..6000 maps bijectively to those names.
    """

    name_config = config["nameSystem"]

    prefixes = name_config["prefixes"]
    cores = name_config["cores"]
    suffixes = name_config["suffixes"]

    capacity = (
        len(prefixes)
        * len(cores)
        * len(suffixes)
    )

    if capacity != int(config["maxSupply"]):
        raise ValueError(
            "NAME_SYSTEM_CAPACITY_MISMATCH"
        )

    if token_id < 1 or token_id > capacity:
        raise ValueError(
            "TOKEN_ID_OUT_OF_RANGE"
        )

    value = token_id - 1

    suffix_count = len(suffixes)
    core_count = len(cores)

    prefix_index = value // (
        core_count * suffix_count
    )

    core_index = (
        value // suffix_count
    ) % core_count

    suffix_index = value % suffix_count

    return (
        prefixes[prefix_index]
        + cores[core_index]
        + suffixes[suffix_index]
    )


def derive_dragon_title(
    traits: dict[str, str],
) -> str:
    archetype = traits["dragonArchetype"]
    location = traits["backgroundCity"]

    archetype_title = {
        "Stone Wyrm": "Wyrm",
        "Cathedral Drake": "Drake",
        "Obsidian Wyvern": "Wyvern",
        "Iron Serpent": "Serpent",
        "Ancient Ravager": "Ravager",
    }[archetype]

    return (
        f"{archetype_title} of the {location}"
    )


def choose_traits(
    seed_hex: str,
    config: dict[str, Any],
) -> dict[str, str]:
    selected: dict[str, str] = {}

    for trait_name, options in config["traits"].items():
        index = derive_index(
            seed_hex=seed_hex,
            trait_name=trait_name,
            option_count=len(options),
        )

        selected[trait_name] = options[index]

    return selected


def create_dna_record(
    token_id: int,
    config: dict[str, Any],
) -> dict[str, Any]:
    max_supply = int(config["maxSupply"])

    if token_id < 1 or token_id > max_supply:
        raise ValueError("TOKEN_ID_OUT_OF_RANGE")

    generation_version = config["generationVersion"]
    namespace = config["seedNamespace"]

    tier = resolve_tier(token_id, config)

    seed_hash = derive_seed(
        namespace=namespace,
        generation_version=generation_version,
        token_id=token_id,
    )

    traits = choose_traits(
        seed_hex=seed_hash,
        config=config,
    )

    derived_name = derive_canonical_name(
        token_id=token_id,
        config=config,
    )

    derived_title = derive_dragon_title(
        traits=traits,
    )

    canonical_identity = (
        resolve_canonical_identity(
            token_id,
            derived_name=derived_name,
            derived_title=derived_title,
        )
    )

    dragon_name = canonical_identity[
        "dragonName"
    ]

    dragon_title = canonical_identity[
        "dragonTitle"
    ]

    display_name = canonical_identity[
        "displayName"
    ]

    identity_source = canonical_identity[
        "identitySource"
    ]

    dna_payload = {
        "tokenId": token_id,
        "dragonName": dragon_name,
        "dragonTitle": dragon_title,
        "displayName": display_name,
        "tier": tier.name,
        "campaignPhase": tier.campaign_phase,
        "generationTheme": tier.generation_theme,
        "generationVersion": generation_version,
        "identitySource": identity_source,
        "traits": traits,
    }

    dna_hash = sha256_hex(
        canonical_json(dna_payload)
    )

    return {
        "tokenId": token_id,
        "serial": f"#{token_id:04d}",
        "dragonName": dragon_name,
        "dragonTitle": dragon_title,
        "displayName": display_name,
        "tier": tier.name,
        "campaignPhase": tier.campaign_phase,
        "generationTheme": tier.generation_theme,
        "generationVersion": generation_version,
        "identitySource": identity_source,
        "seedHash": seed_hash,
        "dnaHash": dna_hash,
        "traits": traits,
    }


def validate_unique(records: list[dict[str, Any]]) -> None:
    token_ids: set[int] = set()
    dna_hashes: set[str] = set()
    trait_signatures: set[str] = set()

    for record in records:
        token_id = int(record["tokenId"])
        dna_hash = str(record["dnaHash"])

        trait_signature = canonical_json(
            record["traits"]
        )

        if token_id in token_ids:
            raise ValueError(
                f"DUPLICATE_TOKEN_ID:{token_id}"
            )

        if dna_hash in dna_hashes:
            raise ValueError(
                f"DUPLICATE_DNA_HASH:{dna_hash}"
            )

        if trait_signature in trait_signatures:
            raise ValueError(
                f"DUPLICATE_TRAIT_CONFIGURATION:{token_id}"
            )

        token_ids.add(token_id)
        dna_hashes.add(dna_hash)
        trait_signatures.add(trait_signature)


def write_outputs(
    records: list[dict[str, Any]],
    config: dict[str, Any],
) -> Path:
    DNA_OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    MANIFEST_OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    for record in records:
        token_id = int(record["tokenId"])

        path = (
            DNA_OUTPUT_DIR
            / f"{token_id:04d}.json"
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

    manifest_records = [
        {
            "tokenId": record["tokenId"],
            "serial": record["serial"],
            "dragonName": record["dragonName"],
            "displayName": record["displayName"],
            "tier": record["tier"],
            "seedHash": record["seedHash"],
            "dnaHash": record["dnaHash"],
        }
        for record in records
    ]

    manifest_core = {
        "collection": config["collection"],
        "generationVersion": config["generationVersion"],
        "count": len(records),
        "records": manifest_records,
    }

    provenance_root = sha256_hex(
        canonical_json(manifest_core)
    )

    manifest = {
        **manifest_core,
        "provenanceRoot": provenance_root,
    }

    manifest_path = (
        MANIFEST_OUTPUT_DIR
        / f"batch-{records[0]['tokenId']:04d}-{records[-1]['tokenId']:04d}.json"
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return manifest_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="OriginX deterministic DNA generator"
    )

    parser.add_argument(
        "--start",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--count",
        type=int,
        required=True,
    )

    args = parser.parse_args()

    if args.count < 1:
        raise SystemExit("COUNT_MUST_BE_POSITIVE")

    config = load_config()

    end = args.start + args.count - 1

    if args.start < 1 or end > int(config["maxSupply"]):
        raise SystemExit("REQUESTED_RANGE_OUT_OF_BOUNDS")

    records = [
        create_dna_record(token_id, config)
        for token_id in range(args.start, end + 1)
    ]

    validate_unique(records)

    manifest_path = write_outputs(
        records=records,
        config=config,
    )

    print("ORIGINX_DNA_GENERATION=PASS")
    print(
        f"GENERATION_VERSION={config['generationVersion']}"
    )
    print(f"START_TOKEN={args.start}")
    print(f"END_TOKEN={end}")
    print(f"COUNT={len(records)}")
    print(f"UNIQUE_DNA={len({r['dnaHash'] for r in records})}")
    print(f"MANIFEST={manifest_path}")


if __name__ == "__main__":
    main()
