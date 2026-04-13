import { expect, mock, test } from "bun:test";
import type { ResttyPlugin } from "../src/surface/restty";

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
    setShaderStages: (stages: Array<Record<string, unknown>>) => void;
    getShaderStages: () => Array<Record<string, unknown>>;
  };
  __writes: Array<{ kind: "input" | "key"; text: string; source: string }>;
  __callbacks: {
    onDesktopNotification?: (notification: {
      title: string;
      body: string;
      source: "osc9" | "osc777";
      raw: string;
    }) => void;
  };
  __shaderStages: Array<Record<string, unknown>>;
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

function normalizeNewlines(text: string): string {
  return text.replace(/\r?\n/g, "\r\n");
}

function createFakeManager(options: any): FakeManager {
  const panes = new Map<number, FakePane>();
  let nextId = 1;
  let activePaneId: number | null = null;
  let focusedPaneId: number | null = null;

  const emitLayout = () => {
    options.onLayoutChanged?.();
  };

  const setActive = (pane: FakePane | null) => {
    activePaneId = pane?.id ?? null;
    options.onActivePaneChange?.(pane);
  };

  const markFocused = (pane: FakePane | null) => {
    focusedPaneId = pane?.id ?? null;
    setActive(pane);
  };

  const createPane = (sourcePane: FakePane | null): FakePane => {
    const id = nextId;
    nextId += 1;
    const appOptions =
      typeof options.appOptions === "function"
        ? options.appOptions({
            id,
            sourcePane,
            canvas: {},
            imeInput: {},
            termDebugEl: {},
          })
        : (options.appOptions ?? {});
    let paneShaderStages: Array<Record<string, unknown>> = Array.isArray(appOptions.shaderStages)
      ? appOptions.shaderStages.map((stage: Record<string, unknown>) => ({ ...stage }))
      : [];
    let ptyConnected = false;
    const writes: Array<{ kind: "input" | "key"; text: string; source: string }> = [];
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
          const intercepted = appOptions.beforeRenderOutput?.({ text: nextText, source });
          if (intercepted === null) return;
          if (typeof intercepted === "string") nextText = intercepted;
        } else {
          const intercepted = appOptions.beforeInput?.({ text: nextText, source });
          if (intercepted === null) return;
          if (typeof intercepted === "string") nextText = intercepted;
          nextText = normalizeNewlines(nextText);
        }
        writes.push({ kind: "input", text: nextText, source });
      },
      sendKeyInput: (text: string, source = "key") => {
        if (!text) return;
        let nextText = text;
        const intercepted = appOptions.beforeInput?.({ text: nextText, source });
        if (intercepted === null) return;
        if (typeof intercepted === "string") nextText = intercepted;
        writes.push({ kind: "key", text: nextText, source });
      },
      clearScreen: () => {},
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
      resize: (_cols: number, _rows: number) => {},
      focus: () => {},
      blur: () => {},
      updateSize: () => {},
      getBackend: () => "test",
      setShaderStages: (stages: Array<Record<string, unknown>>) => {
        paneShaderStages = stages.map((stage) => ({ ...stage }));
        pane.__shaderStages = paneShaderStages.map((stage) => ({ ...stage }));
      },
      getShaderStages: () => paneShaderStages.map((stage) => ({ ...stage })),
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
      __writes: writes,
      __callbacks: {
        onDesktopNotification: appOptions.callbacks?.onDesktopNotification,
      },
      __shaderStages: paneShaderStages.map((stage) => ({ ...stage })),
    };
    panes.set(id, pane);
    options.onPaneCreated?.(pane);
    return pane;
  };

  const splitPaneImpl = (id: number, direction: "vertical" | "horizontal") => {
    const source = panes.get(id) ?? null;
    if (!source) return null;
    const pane = createPane(source);
    markFocused(pane);
    options.onPaneSplit?.(source, pane, direction);
    emitLayout();
    return pane;
  };

  return {
    getPanes: () => Array.from(panes.values()),
    getPaneById: (id: number) => panes.get(id) ?? null,
    getActivePane: () => (activePaneId === null ? null : (panes.get(activePaneId) ?? null)),
    getFocusedPane: () => (focusedPaneId === null ? null : (panes.get(focusedPaneId) ?? null)),
    createInitialPane: () => {
      if (panes.size) return Array.from(panes.values())[0];
      const pane = createPane(null);
      markFocused(pane);
      emitLayout();
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
      markFocused(pane);
    },
    splitPane: splitPaneImpl,
    splitActivePane: (direction: "vertical" | "horizontal") => {
      const active = activePaneId === null ? null : (panes.get(activePaneId) ?? null);
      if (!active) return null;
      return splitPaneImpl(active.id, direction);
    },
    closePane: (id: number) => {
      if (panes.size <= 1) return false;
      const pane = panes.get(id);
      if (!pane) return false;
      panes.delete(id);
      options.onPaneClosed?.(pane);
      const fallback = Array.from(panes.values())[0] ?? null;
      markFocused(fallback);
      emitLayout();
      return true;
    },
    getStyleOptions: () => ({}),
    setStyleOptions: () => {},
    requestLayoutSync: () => emitLayout(),
    hideContextMenu: () => {},
    destroy: () => {
      panes.clear();
      activePaneId = null;
      focusedPaneId = null;
    },
  };
}

mock.module("../src/surface/pane-app-manager", () => ({
  createResttyAppPaneManager: (options: any) => createFakeManager(options),
}));

const { RESTTY_PLUGIN_API_VERSION, Restty } = await import("../src/surface/restty");

function createRestty(): InstanceType<typeof Restty> {
  return new Restty({
    root: {} as any,
    surface: {
      createInitialPane: false,
    },
  });
}

function activeWrites(restty: InstanceType<typeof Restty>) {
  const pane = restty.getActivePane() as FakePane | null;
  if (!pane) throw new Error("expected active pane");
  return pane.__writes;
}

test("plugin lifecycle: use/unuse/plugins and cleanup", async () => {
  const restty = createRestty();
  let activated = 0;
  let cleaned = 0;
  const plugin: ResttyPlugin = {
    id: "plugin/lifecycle",
    activate() {
      activated += 1;
      return () => {
        cleaned += 1;
      };
    },
  };

  await restty.use(plugin);
  expect(activated).toBe(1);
  expect(restty.plugins()).toEqual(["plugin/lifecycle"]);

  await restty.use(plugin);
  expect(activated).toBe(1);
  expect(restty.plugins()).toEqual(["plugin/lifecycle"]);

  expect(restty.unuse("plugin/lifecycle")).toBe(true);
  expect(cleaned).toBe(1);
  expect(restty.plugins()).toEqual([]);
  expect(restty.unuse("plugin/lifecycle")).toBe(false);
});

test("restty onDesktopNotification callback receives paneId and preserves pane callback", () => {
  const paneNotifications: Array<{ paneId: number; title: string; source: string }> = [];
  const resttyNotifications: Array<{ paneId: number; title: string; source: string }> = [];
  const restty = new Restty({
    root: {} as any,
    surface: {
      createInitialPane: false,
      events: {
        onDesktopNotification: (notification) => {
          resttyNotifications.push({
            paneId: notification.paneId,
            title: notification.title,
            source: notification.source,
          });
        },
      },
    },
    terminal: ({ id }) => ({
      callbacks: {
        onDesktopNotification: (notification) => {
          paneNotifications.push({
            paneId: id,
            title: notification.title,
            source: notification.source,
          });
        },
      },
    }),
  });

  const pane = restty.createInitialPane() as FakePane;
  pane.__callbacks.onDesktopNotification?.({
    title: "build complete",
    body: "done",
    source: "osc777",
    raw: "notify;build complete;done",
  });

  expect(paneNotifications).toEqual([
    {
      paneId: pane.id,
      title: "build complete",
      source: "osc777",
    },
  ]);
  expect(resttyNotifications).toEqual([
    {
      paneId: pane.id,
      title: "build complete",
      source: "osc777",
    },
  ]);
});

test("restty shader stage API syncs stages to existing panes and supports handle updates", () => {
  const restty = createRestty();
  const pane = restty.createInitialPane() as FakePane;
  const handle = restty.addShaderStage({
    id: "fx/crt",
    mode: "after-main",
    uniforms: [0.2, 0.7],
    shader: {
      wgsl: "fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f { return color; }",
      glsl: "vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) { return color; }",
    },
  });

  expect(restty.getShaderStages().map((stage) => stage.id)).toEqual(["fx/crt"]);
  expect(pane.__shaderStages.map((stage) => String(stage.id))).toEqual(["fx/crt"]);

  handle.setUniforms([0.9, 0.1, 0.5]);
  const afterUniforms = restty.getShaderStages()[0];
  expect(afterUniforms?.uniforms).toEqual([0.9, 0.1, 0.5]);

  handle.setEnabled(false);
  const afterEnabled = restty.getShaderStages()[0];
  expect(afterEnabled?.enabled).toBe(false);

  handle.dispose();
  expect(restty.getShaderStages()).toEqual([]);
  expect(pane.__shaderStages).toEqual([]);
});

test("plugin addRenderStage registers namespaced stage and cleans up on unuse", async () => {
  const restty = createRestty();
  const pane = restty.createInitialPane() as FakePane;

  await restty.use({
    id: "plugin/stage",
    activate(ctx) {
      const stage = ctx.addRenderStage({
        id: "mono-green",
        mode: "after-main",
        uniforms: [0.8],
        shader: {
          wgsl: "fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f { return color; }",
          glsl: "vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) { return color; }",
        },
      });
      stage.setEnabled(true);
      return () => stage.dispose();
    },
  });

  expect(restty.getShaderStages().map((stage) => stage.id)).toEqual(["plugin/stage:mono-green"]);
  expect(pane.__shaderStages.map((stage) => String(stage.id))).toEqual(["plugin/stage:mono-green"]);

  expect(restty.unuse("plugin/stage")).toBe(true);
  expect(restty.getShaderStages()).toEqual([]);
  expect(pane.__shaderStages).toEqual([]);
});

test("pluginInfo reports metadata, status, and active disposer counts", async () => {
  const restty = createRestty();
  restty.createInitialPane();
  let disposeRuntime: (() => void) | null = null;

  await restty.use({
    id: "plugin/info",
    version: "1.2.3",
    apiVersion: RESTTY_PLUGIN_API_VERSION,
    requires: { pluginApi: { min: 1, max: 1 } },
    activate(ctx) {
      const event = ctx.on("pane:resized", () => {});
      const input = ctx.addInputInterceptor(({ text }) => text);
      const output = ctx.addOutputInterceptor(({ text }) => text);
      const lifecycle = ctx.addLifecycleHook(() => {});
      const render = ctx.addRenderHook(() => {});
      disposeRuntime = () => {
        event.dispose();
        input.dispose();
        output.dispose();
        lifecycle.dispose();
        render.dispose();
      };
      return () => disposeRuntime?.();
    },
  });

  const info = restty.pluginInfo("plugin/info");
  expect(info).not.toBeNull();
  expect(info?.id).toBe("plugin/info");
  expect(info?.active).toBe(true);
  expect(info?.version).toBe("1.2.3");
  expect(info?.apiVersion).toBe(RESTTY_PLUGIN_API_VERSION);
  expect(info?.listeners).toBe(1);
  expect(info?.inputInterceptors).toBe(1);
  expect(info?.outputInterceptors).toBe(1);
  expect(info?.lifecycleHooks).toBe(1);
  expect(info?.renderHooks).toBe(1);
  expect(info?.renderStages).toBe(0);
  expect(Array.isArray(restty.pluginInfo())).toBe(true);

  disposeRuntime?.();
  const afterManualDispose = restty.pluginInfo("plugin/info");
  expect(afterManualDispose?.listeners).toBe(0);
  expect(afterManualDispose?.inputInterceptors).toBe(0);
  expect(afterManualDispose?.outputInterceptors).toBe(0);
  expect(afterManualDispose?.lifecycleHooks).toBe(0);
  expect(afterManualDispose?.renderHooks).toBe(0);
  expect(afterManualDispose?.renderStages).toBe(0);
});

test("manifest registry loading activates plugins and returns per-entry status", async () => {
  const restty = createRestty();
  restty.createInitialPane();
  let seenContextOptions: unknown = null;
  let seenActivationOptions: unknown = null;

  const results = await restty.loadPlugins(
    [
      { id: "plugin/manifest", options: { rewrite: true } },
      { id: "plugin/disabled", enabled: false },
      { id: "plugin/missing" },
      { id: "plugin/error" },
      { id: "plugin/mismatch" },
    ],
    {
      "plugin/manifest": () => ({
        id: "plugin/manifest",
        activate(ctx, options) {
          seenContextOptions = ctx.options;
          seenActivationOptions = options;
          const d = ctx.addInputInterceptor(({ text }) => `${text}!`);
          return () => d.dispose();
        },
      }),
      "plugin/error": () => {
        throw new Error("registry exploded");
      },
      "plugin/mismatch": {
        id: "plugin/other-id",
        activate() {},
      },
    },
  );

  expect(results).toEqual([
    { id: "plugin/manifest", status: "loaded", error: null },
    { id: "plugin/disabled", status: "skipped", error: null },
    {
      id: "plugin/missing",
      status: "missing",
      error: "Restty plugin plugin/missing was not found in registry",
    },
    { id: "plugin/error", status: "failed", error: "registry exploded" },
    {
      id: "plugin/mismatch",
      status: "failed",
      error: "Restty plugin registry entry plugin/mismatch resolved to id plugin/other-id",
    },
  ]);

  expect(seenContextOptions).toEqual({ rewrite: true });
  expect(seenActivationOptions).toEqual({ rewrite: true });
  restty.sendInput("ok");
  expect(activeWrites(restty)).toEqual([{ kind: "input", text: "ok!", source: "program" }]);

  const missingInfo = restty.pluginInfo("plugin/missing");
  expect(missingInfo?.active).toBe(false);
  expect(missingInfo?.lastError).toContain("not found in registry");
});

test("lifecycle and render hooks observe extension points beyond text interceptors", async () => {
  const restty = createRestty();
  const lifecycleEvents: string[] = [];
  const renderEvents: Array<{ phase: string; text: string; dropped: boolean }> = [];

  await restty.use({
    id: "plugin/hooks",
    activate(ctx) {
      const lifecycle = ctx.addLifecycleHook((payload) => {
        lifecycleEvents.push(
          `${payload.phase}:${payload.action}:${String(payload.paneId ?? payload.sourcePaneId ?? "none")}`,
        );
      });
      const render = ctx.addRenderHook((payload) => {
        renderEvents.push({ phase: payload.phase, text: payload.text, dropped: payload.dropped });
      });
      const output = ctx.addOutputInterceptor(({ text }) => {
        if (text === "drop") return null;
        return `${text}!`;
      });
      return () => {
        lifecycle.dispose();
        render.dispose();
        output.dispose();
      };
    },
  });

  const first = restty.createInitialPane();
  const second = restty.splitPane(first.id, "vertical");
  restty.setActivePane(first.id);
  restty.markPaneFocused(first.id);
  restty.connectPty();
  restty.disconnectPty();
  restty.resize(100, 30);
  restty.focus();
  restty.blur();
  restty.sendInput("ok", "pty");
  restty.sendInput("drop", "pty");
  if (second) {
    restty.closePane(second.id);
  }

  expect(lifecycleEvents).toContain("before:create-initial-pane:none");
  expect(lifecycleEvents).toContain("after:create-initial-pane:1");
  expect(lifecycleEvents).toContain("before:split-pane:1");
  expect(lifecycleEvents).toContain("before:connect-pty:1");
  expect(lifecycleEvents).toContain("after:disconnect-pty:1");
  expect(lifecycleEvents).toContain("after:resize:1");
  expect(lifecycleEvents).toContain("after:focus:1");
  expect(lifecycleEvents).toContain("after:blur:1");
  expect(lifecycleEvents).toContain("after:close-pane:2");

  expect(renderEvents).toEqual([
    { phase: "before", text: "ok", dropped: false },
    { phase: "after", text: "ok!", dropped: false },
    { phase: "before", text: "drop", dropped: false },
    { phase: "after", text: "drop", dropped: true },
  ]);
});

test("plugin events are emitted for pane lifecycle + focus/blur/resize", async () => {
  const restty = createRestty();
  const events: string[] = [];
  const ids: Array<number | null> = [];
  await restty.use({
    id: "plugin/events",
    activate(ctx) {
      const d1 = ctx.on("pane:created", ({ paneId }) => {
        events.push("pane:created");
        ids.push(paneId);
      });
      const d2 = ctx.on("pane:split", ({ createdPaneId }) => {
        events.push("pane:split");
        ids.push(createdPaneId);
      });
      const d3 = ctx.on("pane:closed", ({ paneId }) => {
        events.push("pane:closed");
        ids.push(paneId);
      });
      const d4 = ctx.on("pane:resized", ({ paneId }) => {
        events.push("pane:resized");
        ids.push(paneId);
      });
      const d5 = ctx.on("pane:focused", ({ paneId }) => {
        events.push("pane:focused");
        ids.push(paneId);
      });
      const d6 = ctx.on("pane:blurred", ({ paneId }) => {
        events.push("pane:blurred");
        ids.push(paneId);
      });
      return () => {
        d1.dispose();
        d2.dispose();
        d3.dispose();
        d4.dispose();
        d5.dispose();
        d6.dispose();
      };
    },
  });

  const first = restty.createInitialPane();
  const second = restty.splitPane(first.id, "vertical");
  expect(second).not.toBeNull();
  restty.resize(120, 36);
  restty.focus();
  restty.blur();
  if (second) {
    restty.closePane(second.id);
  }

  expect(events).toContain("pane:created");
  expect(events).toContain("pane:split");
  expect(events).toContain("pane:resized");
  expect(events).toContain("pane:focused");
  expect(events).toContain("pane:blurred");
  expect(events).toContain("pane:closed");
  expect(ids.some((id) => typeof id === "number" && id > 0)).toBe(true);
});

test("input interceptors apply by priority and can replace/drop input", async () => {
  const restty = createRestty();
  restty.createInitialPane();
  const calls: string[] = [];

  await restty.use({
    id: "plugin/input-low",
    activate(ctx) {
      const d = ctx.addInputInterceptor(
        ({ text }) => {
          calls.push("low");
          return `${text}L`;
        },
        { priority: -10 },
      );
      return () => d.dispose();
    },
  });

  await restty.use({
    id: "plugin/input-high",
    activate(ctx) {
      const d1 = ctx.addInputInterceptor(
        ({ text }) => {
          calls.push("high");
          return `${text}H`;
        },
        { priority: 10 },
      );
      const d2 = ctx.addInputInterceptor(({ text, source }) => {
        if (source === "program" && text.includes("DROP")) return null;
      });
      return () => {
        d1.dispose();
        d2.dispose();
      };
    },
  });

  restty.sendInput("ok");
  restty.sendInput("DROP");

  expect(calls.slice(0, 2)).toEqual(["low", "high"]);
  expect(activeWrites(restty)).toEqual([{ kind: "input", text: "okLH", source: "program" }]);
});

test("output interceptors can transform and drop PTY output", async () => {
  const restty = createRestty();
  restty.createInitialPane();

  await restty.use({
    id: "plugin/output",
    activate(ctx) {
      const d1 = ctx.addOutputInterceptor(({ text }) => `A${text}`, { priority: -1 });
      const d2 = ctx.addOutputInterceptor(({ text }) => {
        if (text.includes("DROP")) return null;
        return `${text}B`;
      });
      return () => {
        d1.dispose();
        d2.dispose();
      };
    },
  });

  restty.sendInput("ok", "pty");
  restty.sendInput("DROP", "pty");

  expect(activeWrites(restty)).toEqual([{ kind: "input", text: "AokB", source: "pty" }]);
});

test("plugin interceptor errors are isolated and do not block following interceptors", async () => {
  const restty = createRestty();
  restty.createInitialPane();
  const errors: unknown[][] = [];
  const prevConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    await restty.use({
      id: "plugin/error-isolation",
      activate(ctx) {
        const d1 = ctx.addInputInterceptor(() => {
          throw new Error("boom");
        });
        const d2 = ctx.addInputInterceptor(({ text }) => `${text}X`);
        return () => {
          d1.dispose();
          d2.dispose();
        };
      },
    });

    restty.sendKeyInput("k");
    expect(activeWrites(restty)).toEqual([{ kind: "key", text: "kX", source: "key" }]);
    expect(errors.length).toBeGreaterThan(0);
  } finally {
    console.error = prevConsoleError;
  }
});

test("destroy unuses plugins and removes interceptors/listeners", async () => {
  const restty = createRestty();
  restty.createInitialPane();
  let cleaned = 0;

  await restty.use({
    id: "plugin/destroy",
    activate(ctx) {
      const d1 = ctx.on("pane:resized", () => {});
      const d2 = ctx.addInputInterceptor(({ text }) => `${text}!`);
      return () => {
        cleaned += 1;
        d1.dispose();
        d2.dispose();
      };
    },
  });

  restty.sendInput("a");
  expect(activeWrites(restty)).toEqual([{ kind: "input", text: "a!", source: "program" }]);

  restty.destroy();
  expect(cleaned).toBe(1);
  expect(restty.plugins()).toEqual([]);
});

test("invalid plugin contracts are rejected", async () => {
  const restty = createRestty();
  await expect(restty.use({} as ResttyPlugin)).rejects.toThrow("plugin id is required");
  await expect(restty.use({ id: "x" } as ResttyPlugin)).rejects.toThrow("must define activate");
  await expect(
    restty.use({
      id: "invalid/api-version",
      apiVersion: RESTTY_PLUGIN_API_VERSION + 1,
      activate() {},
    }),
  ).rejects.toThrow("requires apiVersion");
  await expect(
    restty.use({
      id: "invalid/range",
      requires: { pluginApi: { min: RESTTY_PLUGIN_API_VERSION + 1 } },
      activate() {},
    }),
  ).rejects.toThrow("requires pluginApi range");

  const info = restty.pluginInfo("invalid/range");
  expect(info).not.toBeNull();
  expect(info?.active).toBe(false);
  expect(info?.lastError).toContain("requires pluginApi range");
});
