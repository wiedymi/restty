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
    isPtyConnected: () => isConnected,
    getMouseStatus: () => ({ mode: mouseMode }),
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
    target,
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
