import { expect, test } from "bun:test";
import {
  closeSettingsDialog,
  isSettingsDialogOpen,
  openSettingsDialog,
  type SettingsDialogHost,
} from "../playground/lib/settings-dialog.ts";

function createHost() {
  const calls: string[] = [];
  const focusedPane = {
    canvas: {
      focus: () => {
        calls.push("focused:focus");
      },
    },
  };
  const activePane = {
    canvas: {
      focus: () => {
        calls.push("active:focus");
      },
    },
  };

  const host: SettingsDialogHost = {
    hideContextMenu: () => {
      calls.push("hideContextMenu");
    },
    getFocusedPane: () => focusedPane,
    getActivePane: () => activePane,
    getPanes: () => [activePane],
  };

  return { host, calls };
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

test("isSettingsDialogOpen reflects dialog open state", () => {
  const dialog = createDialog();

  expect(isSettingsDialogOpen(dialog)).toBe(false);
  dialog.showModal();
  expect(isSettingsDialogOpen(dialog)).toBe(true);
  dialog.close();
  expect(isSettingsDialogOpen(dialog)).toBe(false);
});

test("openSettingsDialog hides context menu and opens dialog", () => {
  const { host, calls } = createHost();
  const dialog = createDialog();

  openSettingsDialog({ host, settingsDialog: dialog });

  expect(calls).toEqual(["hideContextMenu"]);
  expect(dialog.open).toBe(true);
});

test("closeSettingsDialog closes dialog and restores terminal focus", () => {
  const { host, calls } = createHost();
  const dialog = createDialog();
  dialog.showModal();

  closeSettingsDialog({ host, settingsDialog: dialog });

  expect(dialog.open).toBe(false);
  expect(calls).toEqual(["focused:focus"]);
});
