import type { ResttyPaneApi } from "../../src/index.ts";
import { stopPaneDemo } from "./demos.ts";
import { applySavedThemeForPane } from "./pane-theme.ts";
import { withPanePaused, type PaneState } from "./pane-state.ts";
import {
  getConnectUrlForState,
  isWebContainerConnectionBackend,
  type ConnectionBackend,
} from "./connection-state.ts";

export type PaneLifecyclePane = {
  id: number;
  paused: boolean;
  canvas: {
    focus: (options?: FocusOptions) => void;
  };
  initRuntime: () => Promise<void>;
};

export function isPaneLifecyclePane(value: unknown): value is PaneLifecyclePane {
  if (!value || typeof value !== "object") return false;
  const pane = value as {
    canvas?: { focus?: unknown };
    initRuntime?: unknown;
  };
  return (
    typeof pane.initRuntime === "function" &&
    !!pane.canvas &&
    typeof pane.canvas.focus === "function"
  );
}

type PaneLifecyclePaneHandle = Pick<
  ResttyPaneApi,
  | "applyTheme"
  | "clearScreen"
  | "connectPty"
  | "disconnectPty"
  | "isPtyConnected"
  | "resetTheme"
  | "setPaused"
> & {
  id: number;
};

type CreatePaneLifecycleControllerOptions = {
  getPaneById: (id: number) => PaneLifecyclePane | null | undefined;
  getPaneHandleById: (id: number) => PaneLifecyclePaneHandle | null | undefined;
  getActivePane: () => PaneLifecyclePane | null;
  getActivePaneHandle: () => PaneLifecyclePaneHandle | null;
  getPaneState: (id: number) => PaneState | null | undefined;
  setPaneState: (id: number, state: PaneState) => void;
  getActivePaneId: () => number | null;
  getSelectedConnectionBackend: () => ConnectionBackend;
  getSelectedPtyUrl: () => string;
  updatePaneSize: (paneId: number, force?: boolean) => void;
  syncPauseButton: (state: PaneState) => void;
  syncPtyButton: (pane: Pick<ResttyPaneApi, "isPtyConnected"> & { id: number }) => void;
  waitForAnimationFrame?: () => Promise<void>;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
};

const defaultWaitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const defaultQueueAnimationFrame = (callback: FrameRequestCallback) => {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(0), 0) as unknown as number;
};

export function createPaneLifecycleController(options: CreatePaneLifecycleControllerOptions) {
  const waitForAnimationFrame = options.waitForAnimationFrame ?? defaultWaitForAnimationFrame;
  const queueAnimationFrame = options.requestAnimationFrame ?? defaultQueueAnimationFrame;

  function getActivePaneState() {
    const pane = options.getActivePane();
    const paneHandle = options.getActivePaneHandle();
    if (!pane || !paneHandle) return null;
    const state = options.getPaneState(pane.id);
    if (!state) return null;
    return { pane, paneHandle, state };
  }

  function setPanePaused(id: number, value: boolean) {
    const pane = options.getPaneById(id);
    const paneHandle = options.getPaneHandleById(id);
    const state = options.getPaneState(id);
    if (!pane || !paneHandle || !state) return;
    const nextState = withPanePaused(state, value);
    options.setPaneState(id, nextState);
    pane.paused = nextState.paused;
    paneHandle.setPaused(nextState.paused);
    if (id === options.getActivePaneId()) {
      options.syncPauseButton(nextState);
    }
  }

  function connectPaneIfNeeded(paneId: number) {
    const paneHandle = options.getPaneHandleById(paneId);
    if (!paneHandle) return;
    if (!isWebContainerConnectionBackend(options.getSelectedConnectionBackend())) return;
    if (paneHandle.isPtyConnected()) return;
    options.updatePaneSize(paneId, true);
    paneHandle.connectPty(
      getConnectUrlForState(options.getSelectedConnectionBackend(), options.getSelectedPtyUrl()),
    );
    queueAnimationFrame(() => {
      options.updatePaneSize(paneId, true);
    });
  }

  async function initPane(pane: PaneLifecyclePane, state: PaneState) {
    const paneHandle = options.getPaneHandleById(pane.id);
    if (!paneHandle) return;
    await pane.initRuntime();
    options.setPaneState(
      pane.id,
      applySavedThemeForPane({
        pane: paneHandle,
        state,
      }),
    );
    await waitForAnimationFrame();
    options.updatePaneSize(pane.id, true);
    connectPaneIfNeeded(pane.id);
    if (pane.id === options.getActivePaneId()) {
      options.syncPtyButton(paneHandle);
    }
    pane.canvas.focus({ preventScroll: true });
  }

  function handleTerminalInit() {
    const active = getActivePaneState();
    if (!active) return;
    setPanePaused(active.pane.id, false);
    stopPaneDemo(active.state);
    void initPane(active.pane, active.state);
  }

  function handleTerminalPauseToggle() {
    const active = getActivePaneState();
    if (!active) return;
    setPanePaused(active.pane.id, !active.state.paused);
  }

  function handleTerminalClear() {
    const active = getActivePaneState();
    if (!active) return;
    stopPaneDemo(active.state);
    active.paneHandle.clearScreen();
  }

  function handlePtyButtonClick() {
    const active = getActivePaneState();
    if (!active) return;
    if (active.paneHandle.isPtyConnected()) {
      active.paneHandle.disconnectPty();
    } else {
      active.paneHandle.connectPty(
        getConnectUrlForState(options.getSelectedConnectionBackend(), options.getSelectedPtyUrl()),
      );
    }
    options.syncPtyButton(active.paneHandle);
  }

  return {
    connectPaneIfNeeded,
    handlePtyButtonClick,
    handleTerminalClear,
    handleTerminalInit,
    handleTerminalPauseToggle,
    initPane,
    setPanePaused,
  };
}
