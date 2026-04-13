import { expect, test } from "bun:test";
import { createPaneShellSync } from "../playground/lib/pane-shell-sync.ts";
import type { PaneState } from "../playground/lib/pane-state.ts";
import { ACTIVE_PANE_STATE_EVENT, CONNECTION_STATE_EVENT } from "../playground/lib/shell-events.ts";

function createPaneState(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: overrides.id ?? 1,
    renderer: overrides.renderer ?? "webgpu",
    fontSize: overrides.fontSize ?? 22,
    mouseMode: overrides.mouseMode ?? "auto",
    paused: overrides.paused ?? true,
    theme: overrides.theme ?? {
      selectValue: "Aizen Dark",
      sourceLabel: "default theme",
      theme: null,
    },
    demos: overrides.demos ?? null,
  };
}

function createPane(isConnected = false, mouseMode = "on") {
  return {
    runtime: {
      io: {
        isPtyConnected: () => isConnected,
      },
      interaction: {
        getMouseStatus: () => ({ mode: mouseMode }),
      },
    },
  };
}

test("pane shell sync dispatches active pane state through shell events", () => {
  const target = new EventTarget();
  const seen: Array<{ type: string; detail: unknown }> = [];
  const record = (type: string) => (event: Event) => {
    seen.push({
      type,
      detail: (event as CustomEvent).detail,
    });
  };

  target.addEventListener(ACTIVE_PANE_STATE_EVENT, record(ACTIVE_PANE_STATE_EVENT));
  target.addEventListener(CONNECTION_STATE_EVENT, record(CONNECTION_STATE_EVENT));

  const syncedStates: PaneState[] = [];
  const sync = createPaneShellSync({
    usesSvelteShell: true,
    target,
    elements: {
      btnPause: null,
      rendererSelect: null,
      fontSizeInput: null,
      ptyBtn: null,
      themeSelect: null,
      fontFamilySelect: null,
      fontFamilyLocalSelect: null,
      btnLoadLocalFonts: null,
      fontFamilyHintEl: null,
      ligaturesSelect: null,
      fontHintingSelect: null,
      fontHintTargetSelect: null,
      mouseModeEl: null,
      shaderPresetEl: null,
    },
    getSelectedConnectionBackend: () => "webcontainer",
    getSelectedFontFamily: () => "jetbrains",
    getSelectedLocalFontMatcher: () => "fira code",
    getDetectedLocalFontOptions: () => [
      { value: "local:fira%20code", label: "Local Font: Fira Code" },
    ],
    getLocalFontHintText: () => "Detected 1 local font families.",
    getSelectedLigatures: () => false,
    getSelectedFontHinting: () => true,
    getSelectedFontHintTarget: () => "light",
    getSelectedShaderPreset: () => "aurora",
    syncSelectedDefaults: (state) => {
      syncedStates.push(state);
    },
  });

  const pane = createPane(false, "drag");
  const state = createPaneState();

  sync.renderActivePaneControls(pane, state);
  sync.syncPtyButton(pane);

  expect(syncedStates).toEqual([state]);
  expect(seen).toEqual([
    {
      type: ACTIVE_PANE_STATE_EVENT,
      detail: {
        terminal: {
          pauseLabel: "Resume",
          renderer: "webgpu",
          fontSize: 22,
        },
        appearance: {
          fontFamily: "jetbrains",
          localFont: {
            value: "local:fira%20code",
            hintText: "Detected 1 local font families.",
            loadDisabled: true,
            selectDisabled: true,
            options: [
              { value: "", label: "Local Font: None" },
              { value: "local:fira%20code", label: "Local Font: Fira Code" },
            ],
          },
          fontRendering: { ligatures: "off", fontHinting: "on", fontHintTarget: "light" },
          mouseMode: "drag",
          shaderPreset: "aurora",
          themeSelectValue: "Aizen Dark",
        },
      },
    },
    {
      type: CONNECTION_STATE_EVENT,
      detail: { ptyButtonLabel: "Start WebContainer" },
    },
  ]);
});

test("pane shell sync updates legacy controls directly", () => {
  const btnPause = { textContent: "" };
  const rendererSelect = { value: "" };
  const fontSizeInput = { value: "" };
  const ptyBtn = { textContent: "" };
  const themeSelect = { value: "" };
  const shaderPresetEl = { value: "" };
  const mouseModeEl = {
    value: "",
    options: [{ value: "auto" }, { value: "on" }],
  };

  const sync = createPaneShellSync({
    usesSvelteShell: false,
    elements: {
      btnPause,
      rendererSelect,
      fontSizeInput,
      ptyBtn,
      themeSelect,
      fontFamilySelect: null,
      fontFamilyLocalSelect: null,
      btnLoadLocalFonts: null,
      fontFamilyHintEl: null,
      ligaturesSelect: null,
      fontHintingSelect: null,
      fontHintTargetSelect: null,
      mouseModeEl: mouseModeEl as HTMLSelectElement,
      shaderPresetEl: shaderPresetEl as HTMLSelectElement,
    },
    getSelectedConnectionBackend: () => "ws",
    getSelectedFontFamily: () => "fira-code",
    getSelectedLocalFontMatcher: () => "",
    getDetectedLocalFontOptions: () => [],
    getLocalFontHintText: () => "",
    getSelectedLigatures: () => true,
    getSelectedFontHinting: () => false,
    getSelectedFontHintTarget: () => "auto",
    getSelectedShaderPreset: () => "scanline",
    syncSelectedDefaults: () => {},
  });

  const pane = createPane(true, "on");
  const state = createPaneState({
    renderer: "webgl2",
    fontSize: 18,
    paused: false,
    theme: {
      selectValue: "theme-file",
      sourceLabel: "theme file",
      theme: null,
    },
  });

  sync.renderActivePaneControls(pane, state);
  sync.syncPtyButton(pane);

  expect(btnPause.textContent).toBe("");
  expect(rendererSelect.value).toBe("webgl2");
  expect(fontSizeInput.value).toBe("18");
  expect(mouseModeEl.value).toBe("on");
  expect(shaderPresetEl.value).toBe("scanline");
  expect(themeSelect.value).toBe("theme-file");
  expect(ptyBtn.textContent).toBe("Disconnect");
});
