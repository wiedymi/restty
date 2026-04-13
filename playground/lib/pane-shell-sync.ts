import {
  getLocalFontSelectValue,
  supportsLocalFontPicker,
  type FontHintTarget,
  type LocalFontOption,
} from "./font-controls.ts";
import { syncFontFamilyControls, syncHintingControls } from "./font-control-sync.ts";
import type { PaneState } from "./pane-state.ts";
import type { ConnectionBackend } from "./pty-connection.ts";
import {
  ACTIVE_PANE_STATE_EVENT,
  CONNECTION_STATE_EVENT,
  type ActivePaneStateDetail,
  type LocalFontStateDetail,
} from "./shell-events.ts";
import type { ShaderPreset } from "./shader-presets.ts";

export type PaneShellSyncPane = {
  runtime: {
    io: {
      isPtyConnected: () => boolean;
    };
    interaction: {
      getMouseStatus: () => {
        mode: string;
      };
    };
  };
};

type ButtonLike = {
  textContent?: string | null;
};

type SelectLike = {
  value: string;
  options?: ArrayLike<{
    value: string;
  }>;
};

type TextLike = {
  textContent?: string | null;
};

type PaneShellSyncElements = {
  btnPause: ButtonLike | null;
  rendererSelect: SelectLike | null;
  fontSizeInput: SelectLike | null;
  ptyBtn: ButtonLike | null;
  themeSelect: SelectLike | null;
  fontFamilySelect: HTMLSelectElement | null;
  fontFamilyLocalSelect: HTMLSelectElement | null;
  btnLoadLocalFonts: HTMLButtonElement | null;
  fontFamilyHintEl: TextLike | null;
  ligaturesSelect: HTMLSelectElement | null;
  fontHintingSelect: HTMLSelectElement | null;
  fontHintTargetSelect: HTMLSelectElement | null;
  mouseModeEl: HTMLSelectElement | null;
  shaderPresetEl: HTMLSelectElement | null;
};

type CreatePaneShellSyncOptions = {
  usesSvelteShell: boolean;
  target?: EventTarget;
  elements: PaneShellSyncElements;
  getSelectedConnectionBackend: () => ConnectionBackend;
  getSelectedFontFamily: () => string;
  getSelectedLocalFontMatcher: () => string;
  getDetectedLocalFontOptions: () => LocalFontOption[];
  getLocalFontHintText: () => string;
  getSelectedLigatures: () => boolean;
  getSelectedFontHinting: () => boolean;
  getSelectedFontHintTarget: () => FontHintTarget;
  getSelectedShaderPreset: () => ShaderPreset;
  syncSelectedDefaults: (state: PaneState) => void;
};

function dispatchStateEvent(target: EventTarget | undefined, type: string, detail: object) {
  target?.dispatchEvent(
    new CustomEvent(type, {
      detail,
    }),
  );
}

export function createPaneShellSync(options: CreatePaneShellSyncOptions) {
  const target = options.target;

  function dispatchActivePaneState(detail: ActivePaneStateDetail) {
    dispatchStateEvent(target, ACTIVE_PANE_STATE_EVENT, detail);
  }

  function syncPauseButton(state: PaneState) {
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        terminal: {
          pauseLabel: state.paused ? "Resume" : "Pause",
        },
      });
      return;
    }
    if (options.elements.btnPause) {
      options.elements.btnPause.textContent = state.paused ? "Resume" : "Pause";
    }
  }

  function syncTerminalControlValues(state: PaneState) {
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        terminal: {
          pauseLabel: state.paused ? "Resume" : "Pause",
          renderer: state.renderer,
          fontSize: state.fontSize,
        },
      });
      return;
    }
    if (options.elements.rendererSelect) {
      options.elements.rendererSelect.value = state.renderer;
    }
    if (options.elements.fontSizeInput) {
      options.elements.fontSizeInput.value = `${state.fontSize}`;
    }
  }

  function syncPtyButton(pane: PaneShellSyncPane) {
    const label = pane.runtime.io.isPtyConnected()
      ? "Disconnect"
      : options.getSelectedConnectionBackend() === "webcontainer"
        ? "Start WebContainer"
        : "Connect PTY";
    if (options.usesSvelteShell) {
      dispatchStateEvent(target, CONNECTION_STATE_EVENT, { ptyButtonLabel: label });
      return;
    }
    if (options.elements.ptyBtn) {
      options.elements.ptyBtn.textContent = label;
    }
  }

  function syncThemeSelectValue(value: string) {
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        appearance: {
          themeSelectValue: value,
        },
      });
      return;
    }
    if (options.elements.themeSelect) {
      options.elements.themeSelect.value = value;
    }
  }

  function syncShaderPresetValue(value = options.getSelectedShaderPreset()) {
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        appearance: {
          shaderPreset: value,
        },
      });
      return;
    }
    if (options.elements.shaderPresetEl) {
      options.elements.shaderPresetEl.value = value;
    }
  }

  function syncMouseModeValue(value: string) {
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        appearance: {
          mouseMode: value,
        },
      });
      return;
    }
    if (!options.elements.mouseModeEl) return;
    const hasOption = Array.from(options.elements.mouseModeEl.options).some(
      (option) => option.value === value,
    );
    options.elements.mouseModeEl.value = hasOption ? value : "auto";
  }

  function syncFontFamilyValue() {
    const value = options.getSelectedFontFamily();
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        appearance: {
          fontFamily: value,
        },
      });
      return;
    }
    if (options.elements.fontFamilySelect) {
      options.elements.fontFamilySelect.value = value;
    }
  }

  function syncFontFamilyControlState() {
    syncFontFamilyControls({
      fontFamilySelect: options.usesSvelteShell ? null : options.elements.fontFamilySelect,
      fontFamilyLocalSelect: options.usesSvelteShell
        ? null
        : options.elements.fontFamilyLocalSelect,
      btnLoadLocalFonts: options.usesSvelteShell ? null : options.elements.btnLoadLocalFonts,
      selectedFontFamily: options.getSelectedFontFamily(),
      selectedLocalFontMatcher: options.getSelectedLocalFontMatcher(),
      supportsLocalFontPicker: supportsLocalFontPicker(),
    });
  }

  function syncLocalFontControls() {
    const supportsPicker = supportsLocalFontPicker();
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        appearance: {
          localFont: {
            value: getLocalFontSelectValue(options.getSelectedLocalFontMatcher()),
            hintText: options.getLocalFontHintText(),
            loadDisabled: !supportsPicker,
            selectDisabled: !supportsPicker,
            options: [
              { value: "", label: "Local Font: None" },
              ...options.getDetectedLocalFontOptions(),
            ],
          } satisfies LocalFontStateDetail,
        },
      });
      return;
    }
    syncFontFamilyControlState();
    if (options.elements.fontFamilyHintEl) {
      options.elements.fontFamilyHintEl.textContent = options.getLocalFontHintText();
    }
  }

  function syncFontRenderingControls() {
    if (options.usesSvelteShell) {
      dispatchActivePaneState({
        appearance: {
          fontRendering: {
            ligatures: options.getSelectedLigatures() ? "on" : "off",
            fontHinting: options.getSelectedFontHinting() ? "on" : "off",
            fontHintTarget: options.getSelectedFontHintTarget(),
          },
        },
      });
      return;
    }
    syncHintingControls({
      ligaturesSelect: options.elements.ligaturesSelect,
      fontHintingSelect: options.elements.fontHintingSelect,
      fontHintTargetSelect: options.elements.fontHintTargetSelect,
      selectedLigatures: options.getSelectedLigatures(),
      selectedFontHinting: options.getSelectedFontHinting(),
      selectedFontHintTarget: options.getSelectedFontHintTarget(),
    });
  }

  function renderActivePaneControls(pane: PaneShellSyncPane, state: PaneState) {
    options.syncSelectedDefaults(state);
    state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
    if (options.usesSvelteShell) {
      const supportsPicker = supportsLocalFontPicker();
      dispatchActivePaneState({
        terminal: {
          pauseLabel: state.paused ? "Resume" : "Pause",
          renderer: state.renderer,
          fontSize: state.fontSize,
        },
        appearance: {
          fontFamily: options.getSelectedFontFamily(),
          localFont: {
            value: getLocalFontSelectValue(options.getSelectedLocalFontMatcher()),
            hintText: options.getLocalFontHintText(),
            loadDisabled: !supportsPicker,
            selectDisabled: !supportsPicker,
            options: [
              { value: "", label: "Local Font: None" },
              ...options.getDetectedLocalFontOptions(),
            ],
          },
          fontRendering: {
            ligatures: options.getSelectedLigatures() ? "on" : "off",
            fontHinting: options.getSelectedFontHinting() ? "on" : "off",
            fontHintTarget: options.getSelectedFontHintTarget(),
          },
          mouseMode: state.mouseMode,
          shaderPreset: options.getSelectedShaderPreset(),
          themeSelectValue: state.theme.selectValue,
        },
      });
      return;
    }
    syncTerminalControlValues(state);
    syncFontFamilyValue();
    syncFontFamilyControlState();
    syncLocalFontControls();
    syncFontRenderingControls();
    syncMouseModeValue(state.mouseMode);
    syncShaderPresetValue();
    syncThemeSelectValue(state.theme.selectValue);
  }

  return {
    renderActivePaneControls,
    syncFontFamilyValue,
    syncFontRenderingControls,
    syncLocalFontControls,
    syncMouseModeValue,
    syncPauseButton,
    syncPtyButton,
    syncShaderPresetValue,
    syncTerminalControlValues,
    syncThemeSelectValue,
  };
}
