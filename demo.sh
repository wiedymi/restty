#!/usr/bin/env bash
set -euo pipefail

# Animated terminal showcase for restty / WebContainer demos.
# Usage: ./demo.sh [--fast] [--no-wait] [--plain]

ESC=$'\x1b'
CSI="${ESC}["

FAST=0
NO_WAIT=0
PLAIN=0

for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    --no-wait) NO_WAIT=1 ;;
    --plain) PLAIN=1 ;;
    -h|--help)
      cat <<'EOF'
Usage: ./demo.sh [options]

Options:
  --fast      Shorter animation timings
  --no-wait   Exit immediately at the end (no keypress)
  --plain     Skip heavy animation, print showcase only
  -h, --help  Show this help
EOF
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$arg" >&2
      exit 1
      ;;
  esac
done

if ! [ -t 1 ]; then
  printf 'Interactive TTY not detected; run this in a terminal for full animation.\n'
  PLAIN=1
  NO_WAIT=1
fi

if (( FAST == 1 )); then
  TYPE_DELAY=0.005
  FRAME_DELAY=0.03
  SPIN_CYCLES=9
  PARTICLE_FRAMES=52
  WAVE_FRAMES=28
else
  TYPE_DELAY=0.012
  FRAME_DELAY=0.06
  SPIN_CYCLES=16
  PARTICLE_FRAMES=84
  WAVE_FRAMES=42
fi

read -r TERM_ROWS TERM_COLS < <(stty size 2>/dev/null || printf '24 80\n')
TERM_ROWS=${TERM_ROWS:-24}
TERM_COLS=${TERM_COLS:-80}

cleanup() {
  local reset_seq="${CSI}0m${CSI}?25h${CSI}?1000l${CSI}?1002l${CSI}?1003l${CSI}?1006l${CSI}?2004l${CSI}?2027l"
  if [ -t 1 ] && [ -e /dev/tty ]; then
    printf '%s' "${reset_seq}" >/dev/tty 2>/dev/null || true
  else
    printf '%s' "${reset_seq}"
  fi
}
trap cleanup EXIT INT TERM

hide_cursor() { printf '%s?25l' "${CSI}"; }
show_cursor() { printf '%s?25h' "${CSI}"; }
clear_screen() { printf '%s2J%sH' "${CSI}" "${CSI}"; }
move() { printf '%s%d;%dH' "${CSI}" "$1" "$2"; }
sleep_frame() { sleep "${FRAME_DELAY}"; }

repeat_char() {
  local char=$1
  local count=$2
  local out=""
  local i
  for ((i = 0; i < count; i++)); do
    out+="${char}"
  done
  printf '%s' "$out"
}

pad_line() {
  local text=$1
  local width=$2
  printf '%-*.*s' "$width" "$width" "$text"
}

type_line() {
  local row=$1
  local col=$2
  local text=$3
  local color=${4:-"37"}
  local i ch

  move "$row" "$col"
  printf '%s38;5;%sm' "${CSI}" "$color"
  for ((i = 0; i < ${#text}; i++)); do
    ch="${text:i:1}"
    printf '%s' "$ch"
    if (( PLAIN == 0 )); then
      sleep "${TYPE_DELAY}"
    fi
  done
  printf '%s0m' "${CSI}"
}

draw_header() {
  local title="restty webcontainer demo"
  local subtitle="animated terminal capabilities"
  local w=$((TERM_COLS - 6))
  local top=1
  local colors=(45 81 117 153 189 225 219 213 207 201 165 129 93)
  local i c color

  clear_screen
  hide_cursor

  move "$top" 2
  printf '┌'
  repeat_char "─" "$w"
  printf '┐'

  move $((top + 1)) 2
  printf '│ '
  for ((i = 0; i < ${#title}; i++)); do
    c="${title:i:1}"
    color="${colors[$((i % ${#colors[@]}))]}"
    printf '%s38;5;%sm%s' "${CSI}" "$color" "$c"
  done
  printf '%s0m' "${CSI}"
  printf '%s' "$(repeat_char " " $((w - ${#title} - 1)))"
  printf '│'

  move $((top + 2)) 2
  printf '│ %s' "$(pad_line "${subtitle}" $((w - 1)))"
  printf '│'

  move $((top + 3)) 2
  printf '└'
  repeat_char "─" "$w"
  printf '┘'
}

scene_boot() {
  local y=6
  local x=4
  local bar_width=$((TERM_COLS - 18))
  local spinner=( "|" "/" "-" "\\" )
  local steps=(
    "booting webcontainer bridge"
    "probing terminal capabilities"
    "warming glyph and color pipeline"
    "syncing demo assets"
  )
  local step s pct fill empty spin line

  (( bar_width < 18 )) && bar_width=18

  for step in "${steps[@]}"; do
    for ((s = 0; s < SPIN_CYCLES; s++)); do
      pct=$(( (s + 1) * 100 / SPIN_CYCLES ))
      fill=$(( pct * bar_width / 100 ))
      empty=$(( bar_width - fill ))
      move "$y" "$x"
      printf '%s38;5;39m[%s] %s' "${CSI}" "${spinner[$((s % 4))]}" "$(pad_line "$step" 36)"
      printf '%s0m' "${CSI}"

      move $((y + 1)) "$x"
      printf '  %s38;5;46m%s%s38;5;240m%s%s0m %3d%%' \
        "${CSI}" \
        "$(repeat_char "█" "$fill")" \
        "${CSI}" \
        "$(repeat_char "░" "$empty")" \
        "${CSI}" \
        "$pct"

      if (( PLAIN == 0 )); then
        sleep_frame
      fi
    done
    y=$((y + 3))
  done
}

scene_wave() {
  local row=$((TERM_ROWS - 5))
  local start_col=4
  local width=$((TERM_COLS - 8))
  local palette=(196 202 208 214 220 226 190 154 118 82 46 47 48 49 51 45 39 33 27 21 57 93 129 165)
  local p_len=${#palette[@]}
  local frame col idx

  (( row < 12 )) && row=12
  (( width < 24 )) && width=24

  move $((row - 1)) "$start_col"
  printf '%s38;5;250m%s%s0m' "${CSI}" "$(pad_line "color wave renderer sweep" "$width")" "${CSI}"

  for ((frame = 0; frame < WAVE_FRAMES; frame++)); do
    move "$row" "$start_col"
    for ((col = 0; col < width / 2; col++)); do
      idx="${palette[$(((col + frame) % p_len))]}"
      printf '%s48;5;%sm  ' "${CSI}" "$idx"
    done
    printf '%s0m' "${CSI}"
    if (( PLAIN == 0 )); then
      sleep_frame
    fi
  done
}

scene_particles() {
  local min_y=10
  local max_y=$((TERM_ROWS - 8))
  local min_x=4
  local max_x=$((TERM_COLS - 4))
  local frames=$PARTICLE_FRAMES
  local particles=12
  local glyphs=( "·" "*" "✦" )
  local colors=(45 51 81 117 154 190 226 220 214 208 202 201)
  local i frame nx ny
  local -a px py vx vy

  (( max_y <= min_y )) && return 0
  (( max_x <= min_x )) && return 0

  move 9 4
  printf '%s38;5;250mparticle field (bounce simulation)%s0m' "${CSI}" "${CSI}"

  for ((i = 0; i < particles; i++)); do
    px[$i]=$((min_x + RANDOM % (max_x - min_x)))
    py[$i]=$((min_y + RANDOM % (max_y - min_y)))
    vx[$i]=$((RANDOM % 2 == 0 ? 1 : -1))
    vy[$i]=$((RANDOM % 2 == 0 ? 1 : -1))
  done

  for ((frame = 0; frame < frames; frame++)); do
    for ((i = 0; i < particles; i++)); do
      move "${py[$i]}" "${px[$i]}"
      printf ' '
    done

    for ((i = 0; i < particles; i++)); do
      nx=$((px[$i] + vx[$i]))
      ny=$((py[$i] + vy[$i]))
      if ((nx <= min_x || nx >= max_x)); then
        vx[$i]=$((-vx[$i]))
        nx=$((px[$i] + vx[$i]))
      fi
      if ((ny <= min_y || ny >= max_y)); then
        vy[$i]=$((-vy[$i]))
        ny=$((py[$i] + vy[$i]))
      fi
      px[$i]=$nx
      py[$i]=$ny
    done

    for ((i = 0; i < particles; i++)); do
      move "${py[$i]}" "${px[$i]}"
      printf '%s38;5;%sm%s%s0m' \
        "${CSI}" \
        "${colors[$((i % ${#colors[@]}))]}" \
        "${glyphs[$((i % ${#glyphs[@]}))]}" \
        "${CSI}"
    done

    if (( PLAIN == 0 )); then
      sleep_frame
    fi
  done
}

scene_showcase() {
  local row=$((TERM_ROWS - 12))
  (( row < 14 )) && row=14

  move "$row" 4
  printf '%s38;5;117mstyles:%s0m %s1mbold%s0m %s3mitalic%s0m %s4munderline%s0m %s9mstrike%s0m' \
    "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}"

  move $((row + 1)) 4
  printf '%s38;5;117municode:%s0m 你好 世界  日本語  🇺🇸 🇯🇵  👨‍👩‍👧  ⠋⠙⠹⠸  ┌─┬─┐' "${CSI}" "${CSI}"

  move $((row + 2)) 4
  printf '%s38;5;117mtruecolor:%s0m %s38;2;255;100;0morange%s0m %s38;2;120;200;255msky%s0m %s38;2;160;255;160mmint%s0m' \
    "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}" "${CSI}"

  move $((row + 3)) 4
  printf '%s38;5;117mnerd symbols:%s0m 󰄛            ' "${CSI}" "${CSI}"
}

scene_outro() {
  local row=$((TERM_ROWS - 3))
  move "$row" 4
  printf '%s38;5;46mDemo complete.%s0m run %s1m./test.sh%s0m for a static capability sweep.' \
    "${CSI}" "${CSI}" "${CSI}" "${CSI}"
}

draw_header

if (( PLAIN == 1 )); then
  scene_showcase
  scene_outro
else
  type_line 5 4 "Launching animated demo scenes..." 81
  scene_boot
  scene_particles
  scene_wave
  scene_showcase
  scene_outro
fi

if (( NO_WAIT == 0 )); then
  move "$TERM_ROWS" 1
  printf '%s38;5;245mPress any key to exit...%s0m' "${CSI}" "${CSI}"
  IFS= read -r -n 1 -s _
fi

show_cursor
move "$TERM_ROWS" 1
printf '\n'
