import { colorToFloats, colorToRgbU32, type GhosttyTheme } from "../../theme";
import { runtimeTerminalColorFromTheme } from "./highlight-terminal-color-utils";
import type { LifecycleThemeSizeDeps } from "./lifecycle-theme-size.types";

export function createLifecycleThemeHandlers(deps: LifecycleThemeSizeDeps) {
  function applyTheme(theme: GhosttyTheme | null | undefined, sourceLabel = "theme") {
    if (!theme) return;

    if (theme.colors.background) {
      deps.setDefaultBg(colorToFloats(theme.colors.background, 255));
    }
    if (theme.colors.foreground) {
      deps.setDefaultFg(colorToFloats(theme.colors.foreground, 255));
    }
    if (theme.colors.selectionBackground) {
      deps.setSelectionBackgroundColor(
        runtimeTerminalColorFromTheme(theme.colors.selectionBackground),
      );
    }
    if (theme.colors.selectionForeground) {
      deps.setSelectionForegroundColor(
        runtimeTerminalColorFromTheme(theme.colors.selectionForeground),
      );
    }
    if (theme.colors.searchBackground) {
      deps.setSearchMatchBackgroundColor(
        runtimeTerminalColorFromTheme(theme.colors.searchBackground),
      );
    }
    if (theme.colors.searchForeground) {
      deps.setSearchMatchTextColor(runtimeTerminalColorFromTheme(theme.colors.searchForeground));
    }
    if (theme.colors.searchSelectedBackground) {
      deps.setSearchCurrentMatchBackgroundColor(
        runtimeTerminalColorFromTheme(theme.colors.searchSelectedBackground),
      );
    }
    if (theme.colors.searchSelectedForeground) {
      deps.setSearchCurrentMatchTextColor(
        runtimeTerminalColorFromTheme(theme.colors.searchSelectedForeground),
      );
    }
    if (theme.colors.cursor) {
      deps.setCursorFallback(colorToFloats(theme.colors.cursor, 255));
    }

    deps.setActiveTheme(theme);

    const wasmReady = deps.getWasmReady();
    const wasm = deps.getWasm();
    const wasmHandle = deps.getWasmHandle();
    if (wasmReady && wasm && wasmHandle) {
      const fg = theme.colors.foreground ? colorToRgbU32(theme.colors.foreground) : 0xffffffff;
      const bg = theme.colors.background ? colorToRgbU32(theme.colors.background) : 0xffffffff;
      const cursor = theme.colors.cursor ? colorToRgbU32(theme.colors.cursor) : 0xffffffff;
      if (wasm.setDefaultColors) {
        wasm.setDefaultColors(wasmHandle, fg, bg, cursor);
      }

      const palette = theme.colors.palette;
      let maxIndex = -1;
      for (let i = palette.length - 1; i >= 0; i -= 1) {
        if (palette[i]) {
          maxIndex = i;
          break;
        }
      }
      if (maxIndex >= 0 && wasm.setPalette) {
        const count = maxIndex + 1;
        const bytes = new Uint8Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          const color = palette[i];
          if (!color) continue;
          const base = i * 3;
          bytes[base] = color.r & 0xff;
          bytes[base + 1] = color.g & 0xff;
          bytes[base + 2] = color.b & 0xff;
        }
        wasm.setPalette(wasmHandle, bytes, count);
      }

      wasm.renderUpdate(wasmHandle);
    }

    deps.markNeedsRender();
  }

  function resetTheme() {
    deps.setDefaultBg([...deps.defaultBgBase]);
    deps.setDefaultFg([...deps.defaultFgBase]);
    deps.setSelectionBackgroundColor(deps.selectionBackgroundBase);
    deps.setSelectionForegroundColor(deps.selectionForegroundBase);
    deps.setSearchMatchBackgroundColor(deps.searchMatchBackgroundBase);
    deps.setSearchCurrentMatchBackgroundColor(deps.searchCurrentMatchBackgroundBase);
    deps.setSearchMatchTextColor(deps.searchMatchTextBase);
    deps.setSearchCurrentMatchTextColor(deps.searchCurrentMatchTextBase);
    deps.setCursorFallback([...deps.cursorBase]);
    deps.setActiveTheme(null);

    const wasmReady = deps.getWasmReady();
    const wasm = deps.getWasm();
    const wasmHandle = deps.getWasmHandle();
    if (wasmReady && wasm && wasmHandle) {
      const fg = 0xffffff;
      const bg = 0x000000;
      const cursor = 0xffffff;
      if (wasm.setDefaultColors) {
        wasm.setDefaultColors(wasmHandle, fg, bg, cursor);
      }
      if (wasm.resetPalette) {
        wasm.resetPalette(wasmHandle);
      }
      wasm.renderUpdate(wasmHandle);
    }

    deps.markNeedsRender();
  }

  return { applyTheme, resetTheme };
}
