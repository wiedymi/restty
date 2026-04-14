import { parseGhosttyTheme, type GhosttyTheme } from "../../src/theme/ghostty.ts";
import type { PaneState } from "./pane-state.ts";
import {
  applyBuiltinThemeToPane,
  applyThemeToPane,
  resetThemeForPane,
  type PaneThemeTarget,
} from "./pane-theme.ts";
import { shaderStagesForPreset, type ShaderPreset } from "./shader-presets.ts";

type ThemeControllerShellSync = {
  syncShaderPresetValue: (value: ShaderPreset) => void;
  syncThemeSelectValue: (value: string) => void;
};

type CreatePaneThemeControllerOptions = {
  host: {
    setShaderStages: (stages: ReturnType<typeof shaderStagesForPreset>) => void;
  };
  getActivePane: () => PaneThemeTarget | null;
  getActivePaneState: () => PaneState | null;
  getActivePaneId: () => number | null;
  setPaneState: (id: number, state: PaneState) => void;
  shellSync: ThemeControllerShellSync;
  onThemeFileReset: () => void;
  initialShaderPreset: ShaderPreset;
  parseTheme?: (text: string) => GhosttyTheme;
};

export function createPaneThemeController(options: CreatePaneThemeControllerOptions) {
  const parseTheme = options.parseTheme ?? parseGhosttyTheme;
  let selectedShaderPreset = options.initialShaderPreset;

  function getActiveContext() {
    const pane = options.getActivePane();
    const state = options.getActivePaneState();
    if (!pane || !state) return null;
    return { pane, state };
  }

  function applyCurrentShaderPreset() {
    options.shellSync.syncShaderPresetValue(selectedShaderPreset);
    options.host.setShaderStages(shaderStagesForPreset(selectedShaderPreset));
  }

  async function applyUploadedThemeFile(file: File | null | undefined) {
    const active = getActiveContext();
    if (!active || !file) return;
    try {
      const text = await file.text();
      const theme = parseTheme(text);
      const nextState = applyThemeToPane({
        pane: active.pane,
        state: active.state,
        theme,
        sourceLabel: file.name || "theme file",
      });
      if (nextState) {
        options.setPaneState(active.pane.id, nextState);
        if (active.pane.id === options.getActivePaneId()) {
          options.shellSync.syncThemeSelectValue(nextState.theme.selectValue);
        }
      }
    } catch (err) {
      console.error("theme load failed", err);
    } finally {
      options.onThemeFileReset();
    }
  }

  function applyThemeSelection(name: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    if (!name) {
      const nextState = resetThemeForPane({
        pane: active.pane,
        state: active.state,
      });
      options.setPaneState(active.pane.id, nextState);
      if (active.pane.id === options.getActivePaneId()) {
        options.shellSync.syncThemeSelectValue("");
      }
      return;
    }
    const nextState = applyBuiltinThemeToPane({
      pane: active.pane,
      state: active.state,
      name,
    });
    if (!nextState) return;
    options.setPaneState(active.pane.id, nextState);
    if (active.pane.id === options.getActivePaneId()) {
      options.shellSync.syncThemeSelectValue(nextState.theme.selectValue);
    }
  }

  function applySelectedShaderPreset(value: ShaderPreset | string | null | undefined) {
    if (
      value !== "none" &&
      value !== "scanline" &&
      value !== "aurora" &&
      value !== "crt-lite" &&
      value !== "mono-green"
    ) {
      selectedShaderPreset = "none";
    } else {
      selectedShaderPreset = value;
    }
    applyCurrentShaderPreset();
  }

  return {
    applyCurrentShaderPreset,
    applySelectedShaderPreset,
    applyThemeSelection,
    applyUploadedThemeFile,
    getShaderPreset: () => selectedShaderPreset,
  };
}
