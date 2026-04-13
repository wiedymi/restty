import { beforeEach, expect, test } from "bun:test";
import { get } from "svelte/store";
import type { LocalFontOption } from "../playground/lib/font-controls.ts";
import { ACTIVE_PANE_STATE_EVENT, CONNECTION_STATE_EVENT } from "../playground/lib/shell-events.ts";
import {
  appearanceShellState,
  connectionShellState,
  demoShellState,
  resetShellState,
  settingsShellState,
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
    new CustomEvent(ACTIVE_PANE_STATE_EVENT, {
      detail: {
        terminal: {
          pauseLabel: "Resume",
          renderer: "webgpu",
          fontSize: 24,
        },
      },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(CONNECTION_STATE_EVENT, {
      detail: {
        backend: "ws",
        ptyUrl: "ws://example.test/pty",
        ptyButtonLabel: "Disconnect",
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

test("startShellStateBridge merges partial connection updates", () => {
  const target = new EventTarget();
  const stop = startShellStateBridge(target);

  target.dispatchEvent(
    new CustomEvent(CONNECTION_STATE_EVENT, {
      detail: {
        backend: "webcontainer",
        ptyUrl: "ws://example.test/pty",
        ptyButtonLabel: "Start WebContainer",
        webContainerCommand: "bash",
        webContainerCwd: "/tmp",
      },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(CONNECTION_STATE_EVENT, {
      detail: {
        ptyButtonLabel: "Disconnect",
      },
    }),
  );

  expect(get(connectionShellState)).toEqual({
    backend: "webcontainer",
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
    new CustomEvent(ACTIVE_PANE_STATE_EVENT, {
      detail: {
        appearance: {
          mouseMode: "on",
          fontFamily: "jetbrains",
          localFont: {
            value: "local:fira%20code",
            hintText: "Detected 1 local font families.",
            selectDisabled: false,
            loadDisabled: false,
            options,
          },
          fontRendering: {
            ligatures: "off",
            fontHinting: "on",
            fontHintTarget: "light",
          },
          shaderPreset: "aurora",
          themeSelectValue: "Aizen Dark",
        },
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

test("startShellStateBridge merges partial active pane updates", () => {
  const target = new EventTarget();
  const stop = startShellStateBridge(target);

  target.dispatchEvent(
    new CustomEvent(ACTIVE_PANE_STATE_EVENT, {
      detail: {
        terminal: {
          pauseLabel: "Resume",
          renderer: "webgl2",
          fontSize: 20,
        },
        appearance: {
          fontFamily: "jetbrains",
          mouseMode: "auto",
          shaderPreset: "aurora",
          themeSelectValue: "Aizen Dark",
        },
      },
    }),
  );
  target.dispatchEvent(
    new CustomEvent(ACTIVE_PANE_STATE_EVENT, {
      detail: {
        terminal: {
          pauseLabel: "Pause",
        },
        appearance: {
          mouseMode: "drag",
        },
      },
    }),
  );

  expect(get(terminalShellState)).toEqual({
    pauseLabel: "Pause",
    renderer: "webgl2",
    fontSize: "20",
  });
  expect(get(appearanceShellState)).toMatchObject({
    fontFamily: "jetbrains",
    mouseMode: "drag",
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
    new CustomEvent(ACTIVE_PANE_STATE_EVENT, {
      detail: {
        terminal: {
          pauseLabel: "Resume",
        },
      },
    }),
  );

  expect(get(terminalShellState).pauseLabel).toBe("Pause");
});

test("resetShellState restores the demo shell default", () => {
  demoShellState.set({ kind: "unicode" });
  settingsShellState.set({ open: true });

  resetShellState();

  expect(get(demoShellState)).toEqual({ kind: "basic" });
  expect(get(settingsShellState)).toEqual({ open: false });
});
