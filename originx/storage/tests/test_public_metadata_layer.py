#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path


ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

sys.path.insert(
    0,
    str(
        ROOT
        / "storage"
    ),
)

from build_public_nft_package import (  # noqa: E402
    build_public_metadata,
    inspect_token,
    load_json,
)


def main() -> None:
    inspection = inspect_token(
        1
    )

    if not inspection["ready"]:
        raise AssertionError(
            "token 0001 must be ready"
        )

    metadata_path = (
        ROOT
        / "metadata"
        / "output"
        / "0001.json"
    )

    source = load_json(
        metadata_path
    )

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

    image_path = (
        "/nft/rare/0001/"
        f"image-{media_hash}.png"
    )

    glyph_path = (
        "/nft/rare/0001/"
        f"glyph-{glyph_hash}.svg"
    )

    base_url = (
        "https://nft.example.invalid"
    )

    public = build_public_metadata(
        token_id=1,
        inspection=inspection,
        source_metadata=source,
        base_url=base_url,
        image_path=image_path,
        glyph_path=glyph_path,
    )

    if (
        public["name"]
        !=
        "Azhurak — The Primordial Witness"
    ):
        raise AssertionError(
            "public metadata name mismatch"
        )

    if (
        public["image"]
        != base_url + image_path
    ):
        raise AssertionError(
            "public image URI mismatch"
        )

    if (
        public["originx"][
            "glyph"
        ]
        != base_url + glyph_path
    ):
        raise AssertionError(
            "public glyph URI mismatch"
        )

    if (
        public["originx"][
            "identity"
        ][
            "internalMetadataHash"
        ]
        != inspection[
            "identity"
        ][
            "metadataHash"
        ]
    ):
        raise AssertionError(
            "internal metadata hash link missing"
        )

    if (
        public["originx"][
            "visual"
        ][
            "mediaHash"
        ]
        != media_hash
    ):
        raise AssertionError(
            "media hash mismatch"
        )

    try:
        build_public_metadata(
            token_id=1,
            inspection=inspection,
            source_metadata=source,
            base_url="http://unsafe.example",
            image_path=image_path,
            glyph_path=glyph_path,
        )
    except ValueError as exc:
        if (
            str(exc)
            !=
            "PUBLIC_BASE_URL_MUST_BE_HTTPS"
        ):
            raise
    else:
        raise AssertionError(
            "non-HTTPS base URL accepted"
        )

    print(
        "OX_NFT_PUBLIC_METADATA_TEST=PASS"
    )

    print(
        "TOKEN_0001=AZHURAK"
    )

    print(
        "ERC721_PUBLIC_METADATA=PASS"
    )

    print(
        "INTERNAL_METADATA_PRESERVED=YES"
    )

    print(
        "CONTENT_ADDRESSED_IMAGE=YES"
    )

    print(
        "CONTENT_ADDRESSED_GLYPH=YES"
    )

    print(
        "HTTPS_BASE_REQUIRED=YES"
    )

    print(
        "PUBLICATION_EXECUTED=NO"
    )


if __name__ == "__main__":
    main()
