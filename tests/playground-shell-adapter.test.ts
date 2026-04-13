import { expect, test } from "bun:test";
import { createPlaygroundShellAdapter } from "../playground/lib/shell-adapter.ts";
import { THEME_FILE_RESET_EVENT } from "../playground/lib/shell-events.ts";

function createHost() {
  const calls: string[] = [];
  const focusedPane = {
    canvas: {
      focus: () => {
        calls.push("focus");
      },
    },
  };

  return {
    host: {
      hideContextMenu: () => {
        calls.push("hide");
      },
      getFocusedPane: () => focusedPane,
      getActivePane: () => focusedPane,
      getPanes: () => [focusedPane],
    },
    calls,
  };
}

function createDialog() {
  let open = false;
  return {
    get open() {
      return open;
    },
    showModal() {
      open = true;
    },
    close() {
      open = false;
    },
    setAttribute(name: string) {
      if (name === "open") open = true;
    },
    removeAttribute(name: string) {
      if (name === "open") open = false;
    },
  };
}

test("shell adapter dispatches theme reset and handles settings focus in svelte mode", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  target.addEventListener(THEME_FILE_RESET_EVENT, () => {
    seen.push("reset");
  });
  const { host, calls } = createHost();

  const adapter = createPlaygroundShellAdapter({
    usesSvelteShell: true,
    target,
    themeFileInput: null,
    settingsDialog: null,
    connectionUi: {
      connectionBackendEl: null,
      ptyUrlInput: null,
      wcCommandInput: null,
      wcCwdInput: null,
      connectionHintEl: null,
    },
  });

  adapter.resetThemeFileInput();
  adapter.openSettings(host);
  adapter.closeSettings(host);
  adapter.syncConnectionUiState();

  expect(seen).toEqual(["reset"]);
  expect(calls).toEqual(["hide", "focus"]);
});

test("shell adapter drives legacy settings and connection ui directly", () => {
  const target = new EventTarget();
  const themeFileInput = { value: "theme-file" } as HTMLInputElement;
  const dialog = createDialog();
  const { host, calls } = createHost();
  const syncCalls: string[] = [];

  const adapter = createPlaygroundShellAdapter({
    usesSvelteShell: false,
    target,
    themeFileInput,
    settingsDialog: dialog,
    connectionUi: {
      connectionBackendEl: null,
      ptyUrlInput: null,
      wcCommandInput: null,
      wcCwdInput: null,
      connectionHintEl: null,
    },
    syncConnectionUi: () => {
      syncCalls.push("sync");
    },
  });

  adapter.syncConnectionUiState();
  adapter.openSettings(host);
  expect(dialog.open).toBe(true);
  expect(calls).toEqual(["hide"]);
  expect(adapter.isSettingsDialogOpen()).toBe(true);

  adapter.closeSettings(host);
  expect(dialog.open).toBe(false);
  expect(calls).toEqual(["hide", "focus"]);

  adapter.resetThemeFileInput();
  expect(themeFileInput.value).toBe("");
  expect(syncCalls).toEqual(["sync"]);
});
