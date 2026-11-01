#!/usr/bin/env python3
"""Verify the prepared arcade release, without enabling sales or minting."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'originx/identity/akashic'))
from record import verify_chain


def encode(value):
    return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()


def hashfile(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(repo):
    directory=repo/'public/nft/releases/rare-0002-0101'
    manifest=json.loads((directory/'release.json').read_text())
    core={k:v for k,v in manifest.items() if k!='manifestHash'}
    assert hashlib.sha256(encode(core)).hexdigest()==manifest['manifestHash'], 'MANIFEST_HASH'
    assert manifest['quantityPerSale']==1 and len(manifest['items'])==100
    assert {i['tokenId'] for i in manifest['items']}==set(range(2,102))
    pixels=set()
    for item in manifest['items']:
        token=item['tokenId']; stem=f'{token:04d}'; folder=directory/stem
        metadata=repo/'public'/item['metadataPath'].lstrip('/')
        assert hashfile(metadata)==item['metadataHash'], f'METADATA_HASH:{token}'
        meta=json.loads(metadata.read_text())
        assert meta['originx']['tokenId']==token and meta['originx']['tier']=='RARE'
        assert meta['originx']['mediaHash']==item['mediaHash']
        image=repo/'public'/item['imagePath'].lstrip('/')
        assert hashfile(image)==item['mediaHash'], f'IMAGE_HASH:{token}'
        with Image.open(image) as im:
            assert im.size==(1254,1254)
            h=hashlib.sha256(im.convert('RGBA').tobytes()).hexdigest()
        assert h==item['pixelHash'] and h not in pixels, f'PIXEL_DUPLICATE:{token}'
        pixels.add(h)
        ledger=folder/f"akashic-{item['akashicHash']}.json"
        assert hashfile(ledger)==item['akashicHash']
        record=json.loads(ledger.read_text());verify_chain(record)
        assert record['tokenId']==token and record['latestEventHash']==item['akashicLatestEventHash']
        assert record==json.loads((repo/f'originx/identity/output/akashic/{stem}.json').read_text())
        assert record['events'][-2]['payload']['mediaHash']==item['mediaHash']
        assert record['events'][-1]['payload']['metadataHash']==item['metadataHash']
        visual=json.loads((folder/f"visual-dna-{item['visualDnaHash']}.json").read_text())
        assert hashlib.sha256(encode(visual)).hexdigest()==item['visualDnaHash']
        alias=repo/f'public/nft/metadata/{token}.json'
        assert alias.read_bytes()==metadata.read_bytes(),f'TOKEN_URI_ALIAS:{token}'
    print('100_METADATA_100_AKASHIC_100_IMAGES=PASS')
    print('100_DISTINCT_PIXELS_AND_TOKEN_URI_ALIASES=PASS')
    print('RELEASE_PREPARED_NOT_ACTIVATED')


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--repo',type=Path,default=REPO)
    verify(parser.parse_args().repo)
