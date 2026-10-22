#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any


ORIGINX_ROOT = (
    Path(__file__)
    .resolve()
    .parents[1]
)

REPO_ROOT = (
    ORIGINX_ROOT
    .parent
)

DNA_DIR = (
    ORIGINX_ROOT
    / "generation"
    / "output"
    / "dna"
)

RENDER_DIR = (
    ORIGINX_ROOT
    / "generation"
    / "output"
    / "rendered"
)

QC_DIR = (
    ORIGINX_ROOT
    / "generation"
    / "output"
    / "render-qc"
)

BUNDLE_DIR = (
    ORIGINX_ROOT
    / "identity"
    / "output"
    / "bundles"
)

GLYPH_MANIFEST_DIR = (
    ORIGINX_ROOT
    / "identity"
    / "output"
    / "glyph-manifests"
)

GLYPH_DIR = (
    ORIGINX_ROOT
    / "identity"
    / "output"
    / "glyphs"
)

AKASHIC_DIR = (
    ORIGINX_ROOT
    / "identity"
    / "output"
    / "akashic"
)

METADATA_DIR = (
    ORIGINX_ROOT
    / "metadata"
    / "output"
)

PUBLIC_NFT_DIR = (
    REPO_ROOT
    / "public"
    / "nft"
)


def load_json(
    path: Path,
) -> dict[str, Any]:
    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def canonical_json(
    value: Any,
) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def sha256_bytes(
    value: bytes,
) -> str:
    return hashlib.sha256(
        value
    ).hexdigest()


def sha256_file(
    path: Path,
) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(
            lambda:
                handle.read(
                    1024 * 1024
                ),
            b"",
        ):
            digest.update(
                chunk
            )

    return digest.hexdigest()


def require_file(
    path: Path,
    code: str,
) -> None:
    if not path.is_file():
        raise ValueError(
            code
        )


def visual_akashic_hash(
    akashic: dict[str, Any],
) -> str | None:
    matches = [
        event
        for event in akashic.get(
            "events",
            [],
        )
        if event.get(
            "eventType"
        ) == "VISUAL_MANIFESTED"
    ]

    if not matches:
        return None

    payload = (
        matches[-1]
        .get(
            "payload",
            {},
        )
    )

    value = payload.get(
        "mediaHash"
    )

    return (
        value
        if isinstance(
            value,
            str,
        )
        else None
    )


def inspect_token(
    token_id: int,
) -> dict[str, Any]:

    if (
        token_id < 1
        or token_id > 1000
    ):
        raise ValueError(
            "NFT23_RARE_TOKEN_OUT_OF_SCOPE"
        )

    serial = (
        f"{token_id:04d}"
    )

    paths = {
        "dna":
            DNA_DIR
            / f"{serial}.json",

        "bundle":
            BUNDLE_DIR
            / f"{serial}.json",

        "glyphManifest":
            GLYPH_MANIFEST_DIR
            / f"{serial}.json",

        "glyph":
            GLYPH_DIR
            / f"{serial}.svg",

        "akashic":
            AKASHIC_DIR
            / f"{serial}.json",

        "qc":
            QC_DIR
            / f"{serial}.json",

        "render":
            RENDER_DIR
            / f"{serial}.png",

        "metadata":
            METADATA_DIR
            / f"{serial}.json",
    }

    base_required = [
        (
            paths["dna"],
            "DNA_RECORD_MISSING",
        ),
        (
            paths["bundle"],
            "IDENTITY_BUNDLE_MISSING",
        ),
        (
            paths["glyphManifest"],
            "GLYPH_MANIFEST_MISSING",
        ),
        (
            paths["glyph"],
            "GLYPH_FILE_MISSING",
        ),
        (
            paths["akashic"],
            "AKASHIC_RECORD_MISSING",
        ),
        (
            paths["metadata"],
            "METADATA_RECORD_MISSING",
        ),
    ]

    for path, code in base_required:
        require_file(
            path,
            code,
        )

    dna = load_json(
        paths["dna"]
    )

    bundle = load_json(
        paths["bundle"]
    )

    glyph_manifest = load_json(
        paths["glyphManifest"]
    )

    akashic = load_json(
        paths["akashic"]
    )

    metadata = load_json(
        paths["metadata"]
    )

    expected_serial = (
        f"#{serial}"
    )

    identity_records = [
        (
            "DNA",
            dna,
        ),
        (
            "BUNDLE",
            bundle,
        ),
        (
            "GLYPH",
            glyph_manifest,
        ),
        (
            "AKASHIC",
            akashic,
        ),
        (
            "METADATA",
            metadata,
        ),
    ]

    for name, record in identity_records:
        if (
            record.get(
                "tokenId"
            )
            != token_id
        ):
            raise ValueError(
                f"{name}_TOKEN_MISMATCH"
            )

        if (
            record.get(
                "serial"
            )
            != expected_serial
        ):
            raise ValueError(
                f"{name}_SERIAL_MISMATCH"
            )

    if (
        dna.get(
            "tier"
        )
        != "RARE"
    ):
        raise ValueError(
            "NFT23_TIER_NOT_RARE"
        )

    if (
        bundle.get(
            "tier"
        )
        != "RARE"
    ):
        raise ValueError(
            "BUNDLE_TIER_MISMATCH"
        )

    if (
        metadata.get(
            "tier"
        )
        != "RARE"
    ):
        raise ValueError(
            "METADATA_TIER_MISMATCH"
        )

    if (
        bundle[
            "dna"
        ][
            "dnaHash"
        ]
        != dna[
            "dnaHash"
        ]
    ):
        raise ValueError(
            "DNA_HASH_LINK_MISMATCH"
        )

    actual_glyph_hash = (
        sha256_file(
            paths["glyph"]
        )
    )

    declared_glyph_hash = (
        glyph_manifest.get(
            "svgHash"
        )
    )

    if (
        actual_glyph_hash
        != declared_glyph_hash
    ):
        raise ValueError(
            "GLYPH_FILE_HASH_MISMATCH"
        )

    if (
        bundle[
            "resonanceGlyph"
        ][
            "svgHash"
        ]
        != declared_glyph_hash
    ):
        raise ValueError(
            "BUNDLE_GLYPH_HASH_MISMATCH"
        )

    result: dict[str, Any] = {
        "version":
            "OX-NFT-PUBLICATION-GATE-1",

        "tokenId":
            token_id,

        "serial":
            expected_serial,

        "tier":
            "RARE",

        "displayName":
            dna.get(
                "displayName"
            ),

        "ready":
            False,

        "blockingReasons":
            [],

        "identity": {
            "dnaHash":
                dna[
                    "dnaHash"
                ],

            "bundleHash":
                bundle[
                    "bundleHash"
                ],

            "glyphHash":
                declared_glyph_hash,

            "metadataHash":
                metadata[
                    "metadataHash"
                ],

            "akashicLatestEventHash":
                akashic[
                    "latestEventHash"
                ],
        },

        "visual": {
            "qcExists":
                paths[
                    "qc"
                ].is_file(),

            "renderExists":
                paths[
                    "render"
                ].is_file(),

            "approved":
                False,

            "mediaHash":
                None,
        },
    }

    reasons: list[str] = (
        result[
            "blockingReasons"
        ]
    )

    if not paths["qc"].is_file():
        reasons.append(
            "RENDER_QC_MISSING"
        )

    if not paths["render"].is_file():
        reasons.append(
            "CANONICAL_RENDER_MISSING"
        )

    if (
        paths["qc"].is_file()
        and paths["render"].is_file()
    ):
        qc = load_json(
            paths["qc"]
        )

        if (
            qc.get(
                "finalStatus"
            )
            != "APPROVED"
        ):
            reasons.append(
                "RENDER_NOT_APPROVED"
            )

        else:
            result[
                "visual"
            ][
                "approved"
            ] = True

        actual_media_hash = (
            sha256_file(
                paths["render"]
            )
        )

        qc_media_hash = (
            qc.get(
                "mediaHash"
            )
        )

        result[
            "visual"
        ][
            "mediaHash"
        ] = actual_media_hash

        if (
            qc_media_hash
            != actual_media_hash
        ):
            reasons.append(
                "QC_MEDIA_HASH_MISMATCH"
            )

        metadata_media_hash = (
            metadata.get(
                "originx",
                {},
            )
            .get(
                "visual",
                {},
            )
            .get(
                "mediaHash"
            )
        )

        if (
            metadata_media_hash
            != actual_media_hash
        ):
            reasons.append(
                "METADATA_MEDIA_HASH_MISMATCH"
            )

        if (
            metadata.get(
                "visualStatus"
            )
            != "VISUAL_APPROVED"
        ):
            reasons.append(
                "METADATA_VISUAL_NOT_APPROVED"
            )

        akashic_media_hash = (
            visual_akashic_hash(
                akashic
            )
        )

        if (
            akashic_media_hash
            != actual_media_hash
        ):
            reasons.append(
                "AKASHIC_MEDIA_HASH_MISMATCH"
            )

    result["ready"] = (
        len(
            reasons
        )
        == 0
    )

    result["_paths"] = {
        key:
            str(
                value
            )
        for key, value in paths.items()
    }

    return result


def normalize_base_url(
    value: str,
) -> str:
    value = value.strip().rstrip("/")

    if not value.startswith("https://"):
        raise ValueError(
            "PUBLIC_BASE_URL_MUST_BE_HTTPS"
        )

    return value


def build_public_metadata(
    token_id: int,
    inspection: dict[str, Any],
    source_metadata: dict[str, Any],
    base_url: str,
    image_path: str,
    glyph_path: str,
) -> dict[str, Any]:

    base_url = normalize_base_url(
        base_url
    )

    attributes = source_metadata.get(
        "attributes",
        [],
    )

    return {
        "name":
            source_metadata["name"],

        "description":
            source_metadata.get(
                "description",
                "",
            ),

        "image":
            base_url
            + image_path,

        "external_url":
            (
                base_url
                + "/nft/rare/"
                + f"{token_id:04d}"
            ),

        "attributes":
            attributes,

        "originx": {
            "publicMetadataVersion":
                "OX-ERC721-PUBLIC-METADATA-1",

            "tokenId":
                token_id,

            "serial":
                inspection[
                    "serial"
                ],

            "tier":
                inspection[
                    "tier"
                ],

            "displayName":
                inspection[
                    "displayName"
                ],

            "glyph":
                base_url
                + glyph_path,

            "identity": {
                "dnaHash":
                    inspection[
                        "identity"
                    ][
                        "dnaHash"
                    ],

                "bundleHash":
                    inspection[
                        "identity"
                    ][
                        "bundleHash"
                    ],

                "akashicLatestEventHash":
                    inspection[
                        "identity"
                    ][
                        "akashicLatestEventHash"
                    ],

                "internalMetadataHash":
                    inspection[
                        "identity"
                    ][
                        "metadataHash"
                    ],
            },

            "visual": {
                "mediaHash":
                    inspection[
                        "visual"
                    ][
                        "mediaHash"
                    ],

                "approved":
                    True,
            },

            "authority": {
                "metadataIsMintAuthority":
                    False,

                "metadataIsGovernanceAuthority":
                    False,
            },
        },
    }


def publish_token(
    token_id: int,
    base_url: str,
) -> dict[str, Any]:

    inspection = (
        inspect_token(
            token_id
        )
    )

    if not inspection["ready"]:
        reasons = ",".join(
            inspection[
                "blockingReasons"
            ]
        )

        raise ValueError(
            "NFT_PUBLICATION_BLOCKED:"
            + reasons
        )

    paths = {
        key:
            Path(value)
        for key, value in (
            inspection[
                "_paths"
            ].items()
        )
    }

    media_hash = (
        inspection[
            "visual"
        ][
            "mediaHash"
        ]
    )

    glyph_hash = (
        inspection[
            "identity"
        ][
            "glyphHash"
        ]
    )

    metadata_hash = (
        inspection[
            "identity"
        ][
            "metadataHash"
        ]
    )

    serial = (
        f"{token_id:04d}"
    )

    target_dir = (
        PUBLIC_NFT_DIR
        / "rare"
        / serial
    )

    target_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    image_name = (
        f"image-{media_hash}.png"
    )

    glyph_name = (
        f"glyph-{glyph_hash}.svg"
    )

    internal_metadata_name = (
        f"internal-metadata-{metadata_hash}.json"
    )

    image_path = (
        f"/nft/rare/"
        f"{serial}/"
        f"{image_name}"
    )

    glyph_path = (
        f"/nft/rare/"
        f"{serial}/"
        f"{glyph_name}"
    )

    public_metadata_path = (
        f"/nft/metadata/"
        f"{token_id}.json"
    )

    shutil.copyfile(
        paths["render"],
        target_dir
        / image_name,
    )

    shutil.copyfile(
        paths["glyph"],
        target_dir
        / glyph_name,
    )

    shutil.copyfile(
        paths["metadata"],
        target_dir
        / internal_metadata_name,
    )

    source_metadata = load_json(
        paths["metadata"]
    )

    public_metadata = (
        build_public_metadata(
            token_id=token_id,
            inspection=inspection,
            source_metadata=source_metadata,
            base_url=base_url,
            image_path=image_path,
            glyph_path=glyph_path,
        )
    )

    public_metadata_dir = (
        PUBLIC_NFT_DIR
        / "metadata"
    )

    public_metadata_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    public_metadata_file = (
        public_metadata_dir
        / f"{token_id}.json"
    )

    public_metadata_file.write_text(
        json.dumps(
            public_metadata,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    public_metadata_sha256 = (
        sha256_file(
            public_metadata_file
        )
    )

    manifest_core = {
        "manifestVersion":
            "OX-NFT-PUBLIC-MANIFEST-1",

        "tokenId":
            token_id,

        "serial":
            inspection[
                "serial"
            ],

        "tier":
            "RARE",

        "displayName":
            inspection[
                "displayName"
            ],

        "assets": {
            "image": {
                "path":
                    image_path,

                "sha256":
                    media_hash,
            },

            "glyph": {
                "path":
                    glyph_path,

                "sha256":
                    glyph_hash,
            },

            "internalMetadata": {
                "path":
                    (
                        f"/nft/rare/"
                        f"{serial}/"
                        f"{internal_metadata_name}"
                    ),

                "canonicalHash":
                    metadata_hash,

                "fileSha256":
                    sha256_file(
                        paths[
                            "metadata"
                        ]
                    ),
            },

            "publicMetadata": {
                "path":
                    public_metadata_path,

                "url":
                    (
                        normalize_base_url(
                            base_url
                        )
                        + public_metadata_path
                    ),

                "fileSha256":
                    public_metadata_sha256,
            },
        },

        "identity": {
            "dnaHash":
                inspection[
                    "identity"
                ][
                    "dnaHash"
                ],

            "bundleHash":
                inspection[
                    "identity"
                ][
                    "bundleHash"
                ],

            "akashicLatestEventHash":
                inspection[
                    "identity"
                ][
                    "akashicLatestEventHash"
                ],
        },

        "tokenURI": (
            normalize_base_url(
                base_url
            )
            + public_metadata_path
        ),

        "authority": {
            "mintAuthorized":
                False,

            "mainnetAuthorized":
                False,

            "publicationIsMintAuthority":
                False,
        },
    }

    manifest_hash = (
        sha256_bytes(
            canonical_json(
                manifest_core
            ).encode(
                "utf-8"
            )
        )
    )

    manifest = {
        **manifest_core,

        "manifestHash":
            manifest_hash,
    }

    manifest_name = (
        "provenance-"
        + manifest_hash
        + ".json"
    )

    (
        target_dir
        / manifest_name
    ).write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )

    return {
        "tokenId":
            token_id,

        "directory":
            str(
                target_dir
            ),

        "manifest":
            str(
                target_dir
                / manifest_name
            ),

        "manifestHash":
            manifest_hash,

        "tokenURI":
            (
                normalize_base_url(
                    base_url
                )
                + public_metadata_path
            ),

        "publicMetadata":
            str(
                public_metadata_file
            ),
    }


def main() -> None:
    parser = (
        argparse.ArgumentParser()
    )

    parser.add_argument(
        "--token-id",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--publish",
        action="store_true",
    )

    parser.add_argument(
        "--base-url",
        default=None,
    )

    args = parser.parse_args()

    if args.publish:
        if not args.base_url:
            raise SystemExit(
                "PUBLIC_BASE_URL_REQUIRED"
            )

        result = publish_token(
            args.token_id,
            args.base_url,
        )

        print(
            "OX_NFT_PUBLICATION=PASS"
        )

        print(
            "TOKEN_ID="
            + str(
                result[
                    "tokenId"
                ]
            )
        )

        print(
            "MANIFEST_HASH="
            + result[
                "manifestHash"
            ]
        )

        print(
            "OUTPUT="
            + result[
                "directory"
            ]
        )

        print(
            "TOKEN_URI="
            + result[
                "tokenURI"
            ]
        )

        print(
            "PUBLIC_METADATA="
            + result[
                "publicMetadata"
            ]
        )

        return

    result = inspect_token(
        args.token_id
    )

    print(
        json.dumps(
            {
                key:
                    value
                for key, value
                in result.items()
                if key != "_paths"
            },
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    print(
        "OX_NFT_PUBLICATION_GATE="
        + (
            "READY"
            if result[
                "ready"
            ]
            else "BLOCKED"
        )
    )


if __name__ == "__main__":
    main()
