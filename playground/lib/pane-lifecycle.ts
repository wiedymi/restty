import { stopPaneDemo } from "./demos.ts";
import { applySavedThemeForPane } from "./pane-theme.ts";
import { withPanePaused, type PaneState } from "./pane-state.ts";
import { getConnectUrlForState, type ConnectionBackend } from "./connection-state.ts";

export type PaneLifecyclePane = {
  id: number;
  paused: boolean;
  canvas: {
    focus: (options?: FocusOptions) => void;
  };
  runtime: {
    lifecycle: {
      init: () => Promise<void>;
    };
    terminal: {
      clearScreen: () => void;
      setPaused: (value: boolean) => void;
    };
    io: {
      connectPty: (url: string) => void;
      disconnectPty: () => void;
      isPtyConnected: () => boolean;
    };
  };
};

type CreatePaneLifecycleControllerOptions = {
  getPaneById: (id: number) => PaneLifecyclePane | null | undefined;
  getActivePane: () => PaneLifecyclePane | null;
  getPaneState: (id: number) => PaneState | null | undefined;
  setPaneState: (id: number, state: PaneState) => void;
  getActivePaneId: () => number | null;
  getSelectedConnectionBackend: () => ConnectionBackend;
  getSelectedPtyUrl: () => string;
  updatePaneSize: (paneId: number, force?: boolean) => void;
  syncPauseButton: (state: PaneState) => void;
  syncPtyButton: (pane: PaneLifecyclePane) => void;
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
    if (!pane) return null;
    const state = options.getPaneState(pane.id);
    if (!state) return null;
    return { pane, state };
  }

  function setPanePaused(id: number, value: boolean) {
    const pane = options.getPaneById(id);
    const state = options.getPaneState(id);
    if (!pane || !state) return;
    const nextState = withPanePaused(state, value);
    options.setPaneState(id, nextState);
    pane.paused = nextState.paused;
    pane.runtime.terminal.setPaused(nextState.paused);
    if (id === options.getActivePaneId()) {
      options.syncPauseButton(nextState);
    }
  }

  function connectPaneIfNeeded(pane: PaneLifecyclePane) {
    if (options.getSelectedConnectionBackend() !== "webcontainer") return;
    if (pane.runtime.io.isPtyConnected()) return;
    options.updatePaneSize(pane.id, true);
    pane.runtime.io.connectPty(
      getConnectUrlForState(options.getSelectedConnectionBackend(), options.getSelectedPtyUrl()),
    );
    queueAnimationFrame(() => {
      options.updatePaneSize(pane.id, true);
    });
  }

  async function initPane(pane: PaneLifecyclePane, state: PaneState) {
    await pane.runtime.lifecycle.init();
    options.setPaneState(
      pane.id,
      applySavedThemeForPane({
        pane,
        state,
      }),
    );
    await waitForAnimationFrame();
    options.updatePaneSize(pane.id, true);
    connectPaneIfNeeded(pane);
    if (pane.id === options.getActivePaneId()) {
      options.syncPtyButton(pane);
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
    active.pane.runtime.terminal.clearScreen();
  }

  function handlePtyButtonClick() {
    const pane = options.getActivePane();
    if (!pane) return;
    if (pane.runtime.io.isPtyConnected()) {
      pane.runtime.io.disconnectPty();
    } else {
      pane.runtime.io.connectPty(
        getConnectUrlForState(options.getSelectedConnectionBackend(), options.getSelectedPtyUrl()),
      );
    }
    options.syncPtyButton(pane);
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
