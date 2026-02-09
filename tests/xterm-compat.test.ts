import { beforeEach, expect, mock, test } from "bun:test";

type FakeWrite = {
  text: string;
  source: string;
};

type FakeManagerState = {
  writes: FakeWrite[];
  resizes: Array<{ cols: number; rows: number }>;
  clearCount: number;
  focusCount: number;
  blurCount: number;
  destroyed: number;
};

type FakePane = {
  id: number;
  container: object;
  focusTarget: null;
  paused: boolean;
  setPaused: (value: boolean) => void;
  app: {
    setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
    setPaused: (value: boolean) => void;
    togglePause: () => void;
    setFontSize: (value: number) => void;
    applyTheme: () => void;
    resetTheme: () => void;
    sendInput: (text: string, source?: string) => void;
    sendKeyInput: (text: string, source?: string) => void;
    clearScreen: () => void;
    connectPty: () => void;
    disconnectPty: () => void;
    isPtyConnected: () => boolean;
    setMouseMode: () => void;
    getMouseStatus: () => { mode: string; active: boolean; detail: string; enabled: boolean };
    copySelectionToClipboard: () => Promise<boolean>;
    pasteFromClipboard: () => Promise<boolean>;
    dumpAtlasForCodepoint: () => void;
    resize: (cols: number, rows: number) => void;
    focus: () => void;
    blur: () => void;
    updateSize: () => void;
    getBackend: () => string;
  };
};

type FakeManager = {
  getPanes: () => FakePane[];
  getPaneById: (id: number) => FakePane | null;
  getActivePane: () => FakePane | null;
  getFocusedPane: () => FakePane | null;
  createInitialPane: (options?: { focus?: boolean }) => FakePane;
  setActivePane: (id: number) => void;
  markPaneFocused: (id: number) => void;
  splitPane: (id: number, direction: "vertical" | "horizontal") => FakePane | null;
  splitActivePane: (direction: "vertical" | "horizontal") => FakePane | null;
  closePane: (id: number) => boolean;
  getStyleOptions: () => Record<string, never>;
  setStyleOptions: () => void;
  requestLayoutSync: () => void;
  hideContextMenu: () => void;
  destroy: () => void;
};

const managerStates: FakeManagerState[] = [];

function createFakeManager(options: any): FakeManager {
  const state: FakeManagerState = {
    writes: [],
    resizes: [],
    clearCount: 0,
    focusCount: 0,
    blurCount: 0,
    destroyed: 0,
  };
  managerStates.push(state);

  const panes = new Map<number, FakePane>();
  let nextId = 1;
  let activePaneId: number | null = null;
  let focusedPaneId: number | null = null;

  const setActive = (pane: FakePane | null) => {
    activePaneId = pane?.id ?? null;
    options.onActivePaneChange?.(pane);
  };

  const setFocused = (pane: FakePane | null) => {
    focusedPaneId = pane?.id ?? null;
    setActive(pane);
  };

  const createPane = (): FakePane => {
    const id = nextId;
    nextId += 1;
    const appOptions =
      typeof options.appOptions === "function"
        ? options.appOptions({
            id,
            sourcePane: null,
            canvas: {},
            imeInput: {},
            termDebugEl: {},
          })
        : (options.appOptions ?? {});

    let ptyConnected = false;

    const app = {
      setRenderer: (_value: "auto" | "webgpu" | "webgl2") => {},
      setPaused: (_value: boolean) => {},
      togglePause: () => {},
      setFontSize: (_value: number) => {},
      applyTheme: () => {},
      resetTheme: () => {},
      sendInput: (text: string, source = "program") => {
        if (!text) return;
        let nextText = text;
        if (source === "pty") {
          const intercepted = appOptions.beforeRenderOutput?.({ text, source });
          if (intercepted === null) return;
          if (typeof intercepted === "string") nextText = intercepted;
        } else {
          const intercepted = appOptions.beforeInput?.({ text, source });
          if (intercepted === null) return;
          if (typeof intercepted === "string") nextText = intercepted;
        }
        state.writes.push({ text: nextText, source });
      },
      sendKeyInput: (text: string, source = "key") => {
        if (!text) return;
        const intercepted = appOptions.beforeInput?.({ text, source });
        if (intercepted === null) return;
        state.writes.push({ text: typeof intercepted === "string" ? intercepted : text, source });
      },
      clearScreen: () => {
        state.clearCount += 1;
      },
      connectPty: () => {
        ptyConnected = true;
      },
      disconnectPty: () => {
        ptyConnected = false;
      },
      isPtyConnected: () => ptyConnected,
      setMouseMode: () => {},
      getMouseStatus: () => ({ mode: "auto", active: false, detail: "sgr", enabled: true }),
      copySelectionToClipboard: async () => true,
      pasteFromClipboard: async () => true,
      dumpAtlasForCodepoint: () => {},
      resize: (cols: number, rows: number) => {
        state.resizes.push({ cols, rows });
      },
      focus: () => {
        state.focusCount += 1;
      },
      blur: () => {
        state.blurCount += 1;
      },
      updateSize: () => {},
      getBackend: () => "test",
    };

    const pane: FakePane = {
      id,
      container: {},
      focusTarget: null,
      paused: false,
      setPaused: (value: boolean) => {
        pane.paused = value;
      },
      app,
    };

    panes.set(id, pane);
    options.onPaneCreated?.(pane);
    return pane;
  };

  return {
    getPanes: () => Array.from(panes.values()),
    getPaneById: (id: number) => panes.get(id) ?? null,
    getActivePane: () => (activePaneId === null ? null : (panes.get(activePaneId) ?? null)),
    getFocusedPane: () => (focusedPaneId === null ? null : (panes.get(focusedPaneId) ?? null)),
    createInitialPane: () => {
      if (panes.size > 0) return Array.from(panes.values())[0];
      const pane = createPane();
      setFocused(pane);
      options.onLayoutChanged?.();
      return pane;
    },
    setActivePane: (id: number) => {
      const pane = panes.get(id) ?? null;
      if (!pane) return;
      setActive(pane);
    },
    markPaneFocused: (id: number) => {
      const pane = panes.get(id) ?? null;
      if (!pane) return;
      setFocused(pane);
    },
    splitPane: (_id: number, _direction: "vertical" | "horizontal") => null,
    splitActivePane: (_direction: "vertical" | "horizontal") => null,
    closePane: (_id: number) => false,
    getStyleOptions: () => ({}),
    setStyleOptions: () => {},
    requestLayoutSync: () => options.onLayoutChanged?.(),
    hideContextMenu: () => {},
    destroy: () => {
      state.destroyed += 1;
      panes.clear();
      activePaneId = null;
      focusedPaneId = null;
    },
  };
}

mock.module("../src/app/pane-app-manager", () => ({
  createResttyAppPaneManager: (options: any) => createFakeManager(options),
}));

const { Terminal } = await import("../src/xterm");
const { runXtermMigrationSample } = await import("./fixtures/xterm-migration-sample");

function latestState(): FakeManagerState {
  const state = managerStates.at(-1);
  if (!state) throw new Error("expected manager state");
  return state;
}

beforeEach(() => {
  managerStates.length = 0;
});

test("xterm compat open/write/writeln flushes queued output as pty stream", () => {
  const term = new Terminal();
  term.write("hello");
  term.writeln("world");

  term.open({} as HTMLElement);

  expect(latestState().writes).toEqual([
    { text: "hello", source: "pty" },
    { text: "world\r\n", source: "pty" },
  ]);
});

test("xterm compat resize/focus/blur map to restty active pane", () => {
  const term = new Terminal({ cols: 90, rows: 20 });
  term.resize(120, 40);

  term.open({} as HTMLElement);
  term.resize(140, 50);
  term.focus();
  term.blur();

  expect(term.cols).toBe(140);
  expect(term.rows).toBe(50);
  expect(latestState().resizes).toEqual([
    { cols: 120, rows: 40 },
    { cols: 140, rows: 50 },
  ]);
  expect(latestState().focusCount).toBe(1);
  expect(latestState().blurCount).toBe(1);
});

test("xterm compat loadAddon activates once and disposes with terminal", () => {
  const calls: string[] = [];
  const term = new Terminal();
  const addon = {
    activate: (terminal: InstanceType<typeof Terminal>) => {
      expect(terminal).toBe(term);
      calls.push("activate");
    },
    dispose: () => {
      calls.push("dispose");
    },
  };

  term.loadAddon(addon);
  term.loadAddon(addon);
  term.open({} as HTMLElement);
  term.dispose();
  term.dispose();

  expect(calls).toEqual(["activate", "dispose"]);
  expect(latestState().destroyed).toBe(1);
  expect(() => term.write("x")).toThrow("disposed");
});

test("xterm compat write callbacks execute", () => {
  const term = new Terminal();
  let callbacks = 0;

  term.write("a", () => {
    callbacks += 1;
  });
  term.open({} as HTMLElement);
  term.writeln("b", () => {
    callbacks += 1;
  });

  expect(callbacks).toBe(2);
});

test("xterm compat onData and onResize events emit expected payloads", () => {
  const term = new Terminal();
  const dataEvents: string[] = [];
  const resizeEvents: Array<{ cols: number; rows: number }> = [];

  const dataDisposable = term.onData((data) => {
    dataEvents.push(data);
  });
  const resizeDisposable = term.onResize((size) => {
    resizeEvents.push(size);
  });

  term.open({} as HTMLElement);
  term.resize(111, 33);
  term.restty?.sendKeyInput("k", "key");
  term.restty?.sendInput("paste", "program");
  term.restty?.sendInput("from-pty", "pty");

  dataDisposable.dispose();
  resizeDisposable.dispose();
  term.restty?.sendKeyInput("ignored", "key");
  term.resize(120, 40);

  expect(dataEvents).toEqual(["k", "paste"]);
  expect(resizeEvents).toEqual([{ cols: 111, rows: 33 }]);
});

test("xterm compat options, clear, and reset are available", () => {
  const term = new Terminal({
    cols: 80,
    rows: 24,
    cursorBlink: true,
  });

  expect(term.getOption("cursorBlink")).toBe(true);
  term.setOption("fontSize", 14);
  expect(term.getOption("fontSize")).toBe(14);
  term.setOption("cols", 100);
  term.setOption("rows", 35);

  term.open({} as HTMLElement);
  term.clear();
  term.reset();

  expect(term.cols).toBe(100);
  expect(term.rows).toBe(35);
  expect(latestState().resizes).toEqual([{ cols: 100, rows: 35 }]);
  expect(latestState().clearCount).toBe(2);
  expect(latestState().writes.at(-1)).toEqual({ text: "\u001bc", source: "pty" });
});

test("xterm migration sample runs without xterm-specific rewrites", () => {
  const sample = runXtermMigrationSample({} as HTMLElement);
  sample.term.restty?.sendKeyInput("ls", "key");

  expect(sample.calls.addonActivated).toBe(1);
  expect(sample.calls.resizeEvents).toEqual([{ cols: 120, rows: 30 }]);
  expect(sample.calls.dataEvents).toEqual(["ls"]);
  expect(latestState().writes).toEqual([
    { text: "$ ", source: "pty" },
    { text: "echo ok\r\n", source: "pty" },
    { text: "ls", source: "key" },
  ]);

  sample.term.dispose();
  expect(sample.calls.addonDisposed).toBe(1);
});
