# OriginX Generative DNA Engine

Phase:

OX-2 — Generative DNA Engine

Current scope:

deterministic DNA only.

No final artwork generation.

No blockchain dependency.

No minting.

## Deterministic seed

Canonical seed source:

SHA256(
  "ORIGINX"
  +
  generationVersion
  +
  tokenId
)

Current generation version:

OX-GEN-1

## Initial validation batch

The first validation batch contains:

tokenId 1 through 10.

This batch is development-only and is not the final Genesis 1000
production generation.

## Commands

Run tests:

python3 originx/generation/tests/test_generation.py

Generate first batch:

python3 originx/generation/engine/generate_dna.py \
  --start 1 \
  --count 10
