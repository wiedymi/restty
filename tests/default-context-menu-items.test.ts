import { expect, test } from "bun:test";
import { createDefaultResttyPaneContextMenuItems } from "../src/surface/panes/default-context-menu-items.ts";

function createPane(overrides?: {
  connected?: boolean;
  paused?: boolean;
  withSetPaused?: boolean;
}) {
  const calls: string[] = [];
  let connected = overrides?.connected ?? false;

  return {
    pane: {
      id: 1,
      container: {} as HTMLDivElement,
      runtime: {} as never,
      paused: overrides?.paused,
      setPaused: overrides?.withSetPaused
        ? (value: boolean) => {
            calls.push(`setPaused:${value}`);
          }
        : undefined,
      copySelectionToClipboard: async () => {
        calls.push("copy");
        return true;
      },
      pasteFromClipboard: async () => {
        calls.push("paste");
        return true;
      },
      clearScreen: () => {
        calls.push("clear");
      },
      connectPty: (url = "") => {
        calls.push(`connect:${url}`);
        connected = true;
      },
      disconnectPty: () => {
        calls.push("disconnect");
        connected = false;
      },
      isPtyConnected: () => connected,
      togglePause: () => {
        calls.push("togglePause");
      },
    },
    calls,
  };
}

test("default context menu routes terminal actions through pane action methods", async () => {
  const { pane, calls } = createPane({ connected: false, withSetPaused: false });
  const items = createDefaultResttyPaneContextMenuItems({
    pane,
    manager: {
      getPanes: () => [pane],
      splitPane: () => null,
      closePane: () => false,
    },
    getPtyUrl: () => "ws://localhost:8787/pty",
    modKeyLabel: "Ctrl",
  });

  const actionable = items.filter((item) => item !== "separator");

  await actionable[0]!.action();
  await actionable[1]!.action();
  actionable[5]!.action();
  actionable[6]!.action();
  actionable[7]!.action();

  expect(actionable[6]!.label).toBe("Connect PTY");
  expect(calls).toEqual([
    "copy",
    "paste",
    "clear",
    "connect:ws://localhost:8787/pty",
    "togglePause",
  ]);
});

test("default context menu prefers pane setPaused when available", () => {
  const { pane, calls } = createPane({ connected: true, paused: true, withSetPaused: true });
  const items = createDefaultResttyPaneContextMenuItems({
    pane,
    manager: {
      getPanes: () => [pane, pane],
      splitPane: () => null,
      closePane: () => false,
    },
  });

  const actionable = items.filter((item) => item !== "separator");
  actionable[6]!.action();
  actionable[7]!.action();

  expect(actionable[6]!.label).toBe("Disconnect PTY");
  expect(actionable[7]!.label).toBe("Resume Renderer");
  expect(calls).toEqual(["disconnect", "setPaused:false"]);
});
