import { expect, test } from "bun:test";
import {
  restoreTerminalFocus,
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

test("restoreTerminalFocus prefers focused pane", () => {
  const { host, calls } = createHost();

  restoreTerminalFocus(host);

  expect(calls).toEqual(["focused:focus"]);
});
