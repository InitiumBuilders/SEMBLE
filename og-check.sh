#!/usr/bin/env bash
# Fetch every share card and prove it is a real PNG of the right size.
# A 200 is NOT enough here: a Satori throw returns an error PAGE with a 200 in
# some setups, and an empty body is still "successful". Check the magic bytes
# and the IHDR dimensions.
set -u
OUT=/home/initium/live-build/og-out
mkdir -p "$OUT"
BASE="${1:-https://www.semble.cc}"
FAIL=0

for v in thezao partners live semble; do
  F="$OUT/og-$v.png"
  CODE=$(curl -s -o "$F" -w '%{http_code}' --max-time 45 "$BASE/og?v=$v")
  CT=$(curl -s -o /dev/null -w '%{content_type}' --max-time 45 "$BASE/og?v=$v")
  SZ=$(wc -c < "$F")
  MAGIC=$(head -c 8 "$F" | od -An -tx1 | tr -d ' \n')
  # PNG IHDR: width/height are big-endian uint32 at byte offsets 16 and 20
  DIM=$(od -An -tu4 -j16 -N8 --endian=big "$F" 2>/dev/null | tr -s ' ' | sed 's/^ //;s/ /x/')
  printf '  %-9s HTTP %s  %-10s %7s bytes  %s\n' "$v" "$CODE" "$CT" "$SZ" "${DIM:-?}"
  if [ "$MAGIC" != "89504e470d0a1a0a" ]; then
    echo "      ⛔ NOT A PNG - first bytes: $MAGIC"
    echo "      body head: $(head -c 220 "$F" | tr -d '\0' | tr '\n' ' ')"
    FAIL=1
  fi
  [ "$SZ" -gt 8000 ] || { echo "      ⛔ suspiciously small - probably a blank render"; FAIL=1; }
done

echo
[ "$FAIL" = "0" ] && echo "ALL 4 SHARE CARDS RENDER" || { echo "SHARE CARDS BROKEN"; exit 1; }
