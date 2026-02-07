#!/usr/bin/env sh
set -eu

ESC=$(printf '\033')
CSI="${ESC}["

FAST=0
NO_WAIT=0
PLAIN=0

for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    --no-wait) NO_WAIT=1 ;;
    --plain) PLAIN=1 ;;
  esac
done

if [ ! -t 1 ]; then
  PLAIN=1
  NO_WAIT=1
fi

if [ "$FAST" -eq 1 ]; then
  STEP_SLEEP=0.02
  FRAME_SLEEP=0.03
else
  STEP_SLEEP=0.04
  FRAME_SLEEP=0.06
fi

printf '%s?25l%s2J%sH' "$CSI" "$CSI" "$CSI"
printf '+--------------------------------------------------------------------------+\n'
printf '| restty webcontainer demo                                                 |\n'
printf '| animated terminal capabilities                                           |\n'
printf '+--------------------------------------------------------------------------+\n'
printf '%s38;5;81mLaunching demo scenes...%s0m\n\n' "$CSI" "$CSI"

for step in \
  'booting webcontainer bridge' \
  'probing terminal capabilities' \
  'warming glyph pipeline' \
  'syncing demo assets'
do
  i=0
  while [ "$i" -le 24 ]; do
    pct=$(( i * 100 / 24 ))
    fill=$(( i * 28 / 24 ))
    empty=$(( 28 - fill ))

    bar_fill=''
    j=0
    while [ "$j" -lt "$fill" ]; do
      bar_fill="${bar_fill}#"
      j=$((j + 1))
    done

    bar_empty=''
    k=0
    while [ "$k" -lt "$empty" ]; do
      bar_empty="${bar_empty}-"
      k=$((k + 1))
    done

    printf '\r%s38;5;39m%-32s%s0m [%s38;5;46m%s%s38;5;240m%s%s0m] %3s%%' \
      "$CSI" "$step" "$CSI" "$CSI" "$bar_fill" "$CSI" "$bar_empty" "$CSI" "$pct"

    if [ "$PLAIN" -eq 0 ]; then
      sleep "$STEP_SLEEP"
    fi

    i=$((i + 1))
  done
  printf '\n'
done

printf '\n%s38;5;250mcolor wave%s0m\n' "$CSI" "$CSI"
if [ "$PLAIN" -eq 0 ]; then
  frame=0
  while [ "$frame" -lt 18 ]; do
    printf '\r'
    col=0
    while [ "$col" -lt 24 ]; do
      color=$(( 16 + ((col + frame) % 36) ))
      printf '%s48;5;%sm  ' "$CSI" "$color"
      col=$((col + 1))
    done
    printf '%s0m' "$CSI"
    sleep "$FRAME_SLEEP"
    frame=$((frame + 1))
  done
  printf '\n'
fi

printf '\n%s38;5;117mstyles:%s0m %s1mBold%s0m %s3mItalic%s0m %s4mUnderline%s0m\n' \
  "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI"
printf '%s38;5;117municode:%s0m arrows <- ->  blocks [] {} <>\n' "$CSI" "$CSI"
printf '%s38;5;117mtruecolor:%s0m %s38;2;255;100;0mOrange%s0m %s38;2;120;200;255mSky%s0m\n\n' \
  "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI"
printf '%s38;5;46mDemo complete.%s0m run ./test.sh for static checks.\n' "$CSI" "$CSI"

if [ "$NO_WAIT" -eq 0 ] && [ -t 0 ]; then
  printf '%s38;5;245mPress any key to exit...%s0m' "$CSI" "$CSI"
  stty -echo -icanon time 0 min 1 >/dev/null 2>&1 || true
  dd bs=1 count=1 >/dev/null 2>&1 || true
  stty sane >/dev/null 2>&1 || true
  printf '\n'
fi

printf '%s0m%s?25h%s?1000l%s?1002l%s?1003l%s?1006l\n' "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI"
