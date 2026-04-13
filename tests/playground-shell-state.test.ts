import { beforeEach, expect, test } from "bun:test";
import { get } from "svelte/store";
import type { LocalFontOption } from "../playground/lib/font-controls.ts";
import {
  CONNECTION_STATE_EVENT,
  FONT_FAMILY_STATE_EVENT,
  FONT_RENDERING_STATE_EVENT,
  LOCAL_FONT_STATE_EVENT,
  MOUSE_MODE_STATE_EVENT,
  PTY_BUTTON_STATE_EVENT,
  SHADER_PRESET_STATE_EVENT,
  TERMINAL_STATE_EVENT,
  THEME_SELECT_STATE_EVENT,
} from "../playground/lib/shell-events.ts";
import {
  appearanceShellState,
  connectionShellState,
  demoShellState,
  resetShellState,
  startShellStateBridge,
  terminalShellState,
} from "../playground/svelte/src/lib/stores/shell-state.ts";

beforeEach(() => {
  resetShellState();
});

test("startShellStateBridge syncs terminal and connection state from shell events", () => {
  const target = new EventTarget();
  const stop = startShellStateBridge(target);

  target.dispatchEvent(
    new CustomEvent(TERMINAL_STATE_EVENT, {
      detail: {
        pauseLabel: "Resume",
        renderer: "webgpu",
        fontSize: 24,
      },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(PTY_BUTTON_STATE_EVENT, {
      detail: {
        label: "Disconnect",
      },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(CONNECTION_STATE_EVENT, {
      detail: {
        backend: "ws",
        ptyUrl: "ws://example.test/pty",
        webContainerCommand: "bash",
        webContainerCwd: "/tmp",
      },
    }),
  );

  expect(get(terminalShellState)).toEqual({
    pauseLabel: "Resume",
    renderer: "webgpu",
    fontSize: "24",
  });
  expect(get(connectionShellState)).toEqual({
    backend: "ws",
    ptyUrl: "ws://example.test/pty",
    webContainerCommand: "bash",
    webContainerCwd: "/tmp",
    ptyButtonLabel: "Disconnect",
  });

  stop();
});

test("startShellStateBridge syncs appearance state from shell events", () => {
  const target = new EventTarget();
  const stop = startShellStateBridge(target);
  const options: LocalFontOption[] = [
    { value: "", label: "Local Font: None" },
    { value: "local:fira%20code", label: "Local Font: Fira Code" },
  ];

  target.dispatchEvent(
    new CustomEvent(FONT_RENDERING_STATE_EVENT, {
      detail: {
        ligatures: "off",
        fontHinting: "on",
        fontHintTarget: "light",
      },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(MOUSE_MODE_STATE_EVENT, {
      detail: { value: "on" },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(THEME_SELECT_STATE_EVENT, {
      detail: { value: "Aizen Dark" },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(SHADER_PRESET_STATE_EVENT, {
      detail: { value: "aurora" },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(FONT_FAMILY_STATE_EVENT, {
      detail: { value: "jetbrains" },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(LOCAL_FONT_STATE_EVENT, {
      detail: {
        value: "local:fira%20code",
        hintText: "Detected 1 local font families.",
        selectDisabled: false,
        loadDisabled: false,
        options,
      },
    }),
  );

  expect(get(appearanceShellState)).toMatchObject({
    mouseMode: "on",
    fontFamily: "jetbrains",
    localFontHintText: "Detected 1 local font families.",
    localFontOptions: options,
    localFontSelectDisabled: false,
    localFontValue: "local:fira%20code",
    loadLocalFontsDisabled: false,
    ligatures: "off",
    fontHinting: "on",
    fontHintTarget: "light",
    shaderPreset: "aurora",
    themeSelectValue: "Aizen Dark",
  });

  stop();
});

test("stop bridge removes listeners", () => {
  const target = new EventTarget();
  const stop = startShellStateBridge(target);

  stop();
  target.dispatchEvent(
    new CustomEvent(TERMINAL_STATE_EVENT, {
      detail: {
        pauseLabel: "Resume",
      },
    }),
  );

  expect(get(terminalShellState).pauseLabel).toBe("Pause");
});

test("resetShellState restores the demo shell default", () => {
  demoShellState.set({ kind: "unicode" });

  resetShellState();

  expect(get(demoShellState)).toEqual({ kind: "basic" });
});
