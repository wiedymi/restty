#!/usr/bin/env sh
set -eu

ESC=$(printf '\033')
CSI="${ESC}["

printf '%s?25l%s2J%sH' "$CSI" "$CSI" "$CSI"
printf 'restty terminal capability test\n'
printf '%s\n\n' '---------------------------------'

printf '%s1mStyles:%s0m %s1mBold%s0m %s3mItalic%s0m %s4mUnderline%s0m\n\n' \
  "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI"

printf 'Base 16 colors:\n'
for i in 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  printf '%s48;5;%sm  %s0m' "$CSI" "$i" "$CSI"
  case "$i" in
    7|15) printf '\n' ;;
  esac
done

printf '\nTruecolor:\n'
printf '%s38;2;255;100;0mOrange%s0m %s38;2;120;200;255mSky%s0m %s38;2;160;255;160mMint%s0m\n\n' \
  "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI"

printf 'Box drawing:\n'
printf '+------------------------------+\n'
printf '|  mono renderer box drawing   |\n'
printf '+------------------------------+\n\n'

printf 'Unicode / width:\n'
printf 'arrows: <- ->  blocks: [] {} <>  text: ni hao / nihongo\n\n'

printf 'Done.\n'
printf '%s0m%s?25h%s?1000l%s?1002l%s?1003l%s?1006l\n' "$CSI" "$CSI" "$CSI" "$CSI" "$CSI" "$CSI"
