import { Restty } from "../../src/index.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createConnectionController } from "./connection-controller.ts";
import type { createPaneLifecycleController } from "./pane-lifecycle.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";
import type { PaneState } from "./pane-state.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";

export type PlaygroundWindow = Window & typeof globalThis;

export type PlaygroundControlShell = {
  syncConnectionState: (detail: ConnectionStateDetail) => void;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  getConnectionShellStateDetail: () => {
    backend: string;
    ptyUrl: string;
    ptyButtonLabel: string;
    webContainerCommand: string;
    webContainerCwd: string;
  };
};

export type PlaygroundControlControllers = {
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
  connectionController: ReturnType<typeof createConnectionController>;
};

export type PlaygroundControlState = {
  paneStates: Map<number, PaneState>;
  getActivePaneId: () => number | null;
};

export type WirePlaygroundControlsOptions = {
  restty: Restty;
  window: PlaygroundWindow;
  shell: PlaygroundControlShell;
  controllers: PlaygroundControlControllers;
  state: PlaygroundControlState;
};
