#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

npm run prod:runtime:check
npm run prod:prepare
