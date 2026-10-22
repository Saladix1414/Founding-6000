#!/usr/bin/env python3

from __future__ import annotations

import os
import sys
import tempfile
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
    inspect_token,
)


TOKEN_ID = 1

QC_PATH = (
    ROOT
    / "generation"
    / "output"
    / "render-qc"
    / "0001.json"
)

RENDER_PATH = (
    ROOT
    / "generation"
    / "output"
    / "rendered"
    / "0001.png"
)

PUBLIC_PATH = (
    ROOT.parent
    / "public"
    / "nft"
    / "rare"
    / "0001"
)


def assert_identity_links(
    result: dict,
) -> None:
    if not result[
        "identity"
    ][
        "dnaHash"
    ]:
        raise AssertionError(
            "missing DNA link"
        )

    if not result[
        "identity"
    ][
        "bundleHash"
    ]:
        raise AssertionError(
            "missing bundle link"
        )

    if not result[
        "identity"
    ][
        "glyphHash"
    ]:
        raise AssertionError(
            "missing glyph link"
        )

    if not result[
        "identity"
    ][
        "metadataHash"
    ]:
        raise AssertionError(
            "missing metadata link"
        )


def assert_base_identity(
    result: dict,
) -> None:
    if result["tokenId"] != 1:
        raise AssertionError(
            "token mismatch"
        )

    if result["serial"] != "#0001":
        raise AssertionError(
            "serial mismatch"
        )

    if result["tier"] != "RARE":
        raise AssertionError(
            "tier mismatch"
        )

    if (
        result["displayName"]
        !=
        "Azhurak — The Primordial Witness"
    ):
        raise AssertionError(
            "canonical display name mismatch"
        )

    assert_identity_links(
        result
    )


def verify_current_ready_state() -> None:
    result = inspect_token(
        TOKEN_ID
    )

    assert_base_identity(
        result
    )

    if not result["ready"]:
        raise AssertionError(
            "approved token 0001 "
            "should be publication-ready: "
            + ",".join(
                result[
                    "blockingReasons"
                ]
            )
        )

    if result["blockingReasons"]:
        raise AssertionError(
            "ready token has blocking reasons"
        )

    if not result[
        "visual"
    ][
        "approved"
    ]:
        raise AssertionError(
            "approved visual not recognized"
        )

    if not result[
        "visual"
    ][
        "qcExists"
    ]:
        raise AssertionError(
            "QC evidence not recognized"
        )

    if not result[
        "visual"
    ][
        "renderExists"
    ]:
        raise AssertionError(
            "render evidence not recognized"
        )


def verify_missing_qc_fails_closed(
    temp_dir: Path,
) -> None:
    if not QC_PATH.exists():
        raise AssertionError(
            "QC fixture missing"
        )

    backup = (
        temp_dir
        / "0001.qc.json"
    )

    os.replace(
        QC_PATH,
        backup,
    )

    try:
        result = inspect_token(
            TOKEN_ID
        )

        assert_base_identity(
            result
        )

        if result["ready"]:
            raise AssertionError(
                "missing QC did not "
                "block publication"
            )

        reasons = set(
            result[
                "blockingReasons"
            ]
        )

        if (
            "RENDER_QC_MISSING"
            not in reasons
        ):
            raise AssertionError(
                "RENDER_QC_MISSING "
                "reason absent"
            )

    finally:
        if backup.exists():
            os.replace(
                backup,
                QC_PATH,
            )


def verify_missing_render_fails_closed(
    temp_dir: Path,
) -> None:
    if not RENDER_PATH.exists():
        raise AssertionError(
            "render fixture missing"
        )

    backup = (
        temp_dir
        / "0001.render.png"
    )

    os.replace(
        RENDER_PATH,
        backup,
    )

    try:
        result = inspect_token(
            TOKEN_ID
        )

        assert_base_identity(
            result
        )

        if result["ready"]:
            raise AssertionError(
                "missing canonical render "
                "did not block publication"
            )

        reasons = set(
            result[
                "blockingReasons"
            ]
        )

        if (
            "CANONICAL_RENDER_MISSING"
            not in reasons
        ):
            raise AssertionError(
                "CANONICAL_RENDER_MISSING "
                "reason absent"
            )

    finally:
        if backup.exists():
            os.replace(
                backup,
                RENDER_PATH,
            )


def main() -> None:
    verify_current_ready_state()

    with tempfile.TemporaryDirectory(
        prefix=(
            "originx-publication-gate-"
        )
    ) as raw_temp:
        temp_dir = Path(
            raw_temp
        )

        verify_missing_qc_fails_closed(
            temp_dir
        )

        verify_missing_render_fails_closed(
            temp_dir
        )

    if not QC_PATH.exists():
        raise AssertionError(
            "QC fixture was not restored"
        )

    if not RENDER_PATH.exists():
        raise AssertionError(
            "render fixture was not restored"
        )

    final = inspect_token(
        TOKEN_ID
    )

    if not final["ready"]:
        raise AssertionError(
            "gate did not return to READY "
            "after fixture restoration"
        )

    print(
        "OX_NFT_PUBLICATION_GATE_TEST=PASS"
    )

    print(
        "TOKEN_0001_READY=YES"
    )

    print(
        "AZHURAK_CANON=PASS"
    )

    print(
        "MISSING_QC_BLOCKS=YES"
    )

    print(
        "MISSING_RENDER_BLOCKS=YES"
    )

    print(
        "FIXTURES_RESTORED=YES"
    )

    print(
        "FAIL_CLOSED=YES"
    )

    print(
        "PUBLICATION_EXECUTED=NO"
    )

    print(
        "MINT_AUTHORITY=NO"
    )


if __name__ == "__main__":
    main()
