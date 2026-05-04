import { expect, test } from "bun:test";
import type { ResttyConfig } from "../src/index.ts";
import { bootstrapPlaygroundSurface } from "../playground/lib/surface-bootstrap.ts";
import type { PaneState } from "../playground/lib/pane-state.ts";

function createState(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: overrides.id ?? 1,
    renderer: overrides.renderer ?? "auto",
    fontSize: overrides.fontSize ?? 18,
    mouseMode: overrides.mouseMode ?? "auto",
    paused: overrides.paused ?? false,
    theme: overrides.theme ?? {
      selectValue: "",
      sourceLabel: "",
      theme: null,
    },
    demos: overrides.demos ?? null,
  };
}

function createTarget() {
  const rafCallbacks: FrameRequestCallback[] = [];
  const target = Object.assign(new EventTarget(), {
    requestAnimationFrame(callback: FrameRequestCallback) {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
  });

  return { target, rafCallbacks };
}

function createPane(id = 1) {
  const calls: string[] = [];
  const handle = {
    id,
    updateSize: (force?: boolean) => {
      calls.push(`size:${force === true ? "forced" : "normal"}`);
    },
    setMouseMode: (value: string) => {
      calls.push(`mouse:${value}`);
    },
    getMouseStatus: () => ({ mode: "drag" }),
    isPtyConnected: () => false,
  };
  const pane = {
    id,
    paused: false,
    canvas: {
      focus: () => {
        calls.push("focus");
      },
    },
    initRuntime: async () => {
      calls.push("init");
    },
    runtime: {},
  };

  return { handle, pane, calls };
}

test("bootstrapPlaygroundSurface boots the first pane and wires surface events", async () => {
  const paneStates = new Map<number, PaneState>();
  let activePaneId: number | null = null;
  const { target, rafCallbacks } = createTarget();
  const { handle: firstPane, calls: firstPaneCalls } = createPane(1);
  const { handle: secondPaneHandle, pane: secondPane, calls: secondPaneCalls } = createPane(2);
  const paneHandles = new Map<number, typeof firstPane>([
    [1, firstPane],
    [2, secondPaneHandle],
  ]);
  const panes: Array<typeof firstPane> = [];
  const syncCalls: string[] = [];
  const lifecycleCalls: string[] = [];
  const demoStops: number[] = [];
  const transportCalls: string[] = [];
  let capturedConfig: ResttyConfig | null = null;
  let createdWithFocus = false;
  let readyRestty: unknown = null;

  const appearanceController = {
    getRendererDefault: () => "webgpu" as const,
    getFontSizeDefault: () => 20,
    getMouseModeDefault: () => "drag",
    getLigatures: () => true,
    getFontHinting: () => false,
    getFontHintTarget: () => "auto" as const,
    getFonts: () => [],
    getStartupFonts: () => [],
    applyCurrentShaderPreset: () => {},
  };

  const connectionController = {
    getBackend: () => "ws",
    getConnectUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "jsh",
    getWebContainerCwd: () => "/",
  };

  const paneLifecycle = {
    setPanePaused: (id: number, value: boolean) => {
      lifecycleCalls.push(`pause:${id}:${value}`);
    },
    initPane: async (pane: { id: number }, state: PaneState) => {
      lifecycleCalls.push(`init:${pane.id}:${state.mouseMode}`);
    },
  };

  const paneShellSync = {
    syncPtyButton: (pane: { id: number }) => {
      syncCalls.push(`pty:${pane.id}`);
    },
    renderActivePaneControls: (pane: { id: number }, state: PaneState) => {
      syncCalls.push(`render:${pane.id}:${state.renderer}`);
    },
  };

  const restty = bootstrapPlaygroundSurface({
    root: {} as HTMLElement,
    target,
    startup: {
      initialFontSize: 18,
      defaultThemeName: "Aizen Dark",
    },
    state: {
      paneStates,
      setActivePaneId: (id) => {
        activePaneId = id;
      },
    },
    shell: {
      isSettingsDialogOpen: () => false,
      paneShellSync: paneShellSync as unknown as Parameters<
        typeof bootstrapPlaygroundSurface
      >[0]["shell"]["paneShellSync"],
    },
    controllers: {
      appearanceController: appearanceController as unknown as Parameters<
        typeof bootstrapPlaygroundSurface
      >[0]["controllers"]["appearanceController"],
      connectionController: connectionController as unknown as Parameters<
        typeof bootstrapPlaygroundSurface
      >[0]["controllers"]["connectionController"],
      paneLifecycle: paneLifecycle as unknown as Parameters<
        typeof bootstrapPlaygroundSurface
      >[0]["controllers"]["paneLifecycle"],
    },
    onDesktopNotification: () => {},
    createDemoController: () => ({
      run: () => {},
      stop: () => {
        demoStops.push(1);
      },
    }),
    createPtyTransport: ((options) => {
      transportCalls.push(options.getPtyUrl());
      return { kind: "fake-pty" } as never;
    }) as Parameters<typeof bootstrapPlaygroundSurface>[0]["createPtyTransport"],
    createRestty: (config) => {
      capturedConfig = config;
      return {
        getPanes: () => panes as never[],
        pane: (id: number) => paneHandles.get(id) as never,
        forEachPane: (visitor: (pane: (typeof panes)[number]) => void) => {
          for (const pane of panes) visitor(pane);
        },
        createInitialPane: (options?: { focus?: boolean }) => {
          createdWithFocus = options?.focus === true;
          void config.terminal?.({ id: 1, sourcePane: null as never });
          void config.services?.({ id: 1, sourcePane: null as never });
          panes.push(firstPane);
          return firstPane as never;
        },
      } as unknown as ReturnType<typeof bootstrapPlaygroundSurface>;
    },
    onResttyReady: (value) => {
      readyRestty = value;
    },
  });

  expect(restty).toBeTruthy();
  expect(readyRestty).toBe(restty);
  expect(capturedConfig?.surface?.createInitialPane).toBe(false);
  expect(capturedConfig?.surface?.autoInit).toBe(false);
  expect(createdWithFocus).toBe(true);
  expect(activePaneId).toBe(1);
  expect(transportCalls).toEqual(["ws://localhost:8787/pty"]);
  expect(paneStates.get(1)).toMatchObject({
    id: 1,
    renderer: "webgpu",
    fontSize: 20,
    mouseMode: "drag",
  });
  expect(syncCalls).toEqual(["pty:1", "render:1:webgpu"]);
  expect(rafCallbacks).toHaveLength(1);

  rafCallbacks[0]?.(0);
  expect(firstPaneCalls).toEqual(["size:forced"]);

  const surfaceEvents = capturedConfig?.surface?.events;
  expect(surfaceEvents).toBeTruthy();

  paneStates.set(2, createState({ id: 2, paused: true, mouseMode: "on" }));
  surfaceEvents?.onPaneCreated?.(secondPane as never);
  await Promise.resolve();
  expect(secondPane.paused).toBe(true);
  expect(secondPaneCalls).toContain("mouse:on");
  expect(lifecycleCalls).toContain("init:2:on");

  (secondPane as { setPaused?: (value: boolean) => void }).setPaused?.(false);
  expect(lifecycleCalls).toContain("pause:2:false");

  surfaceEvents?.onActivePaneChange?.(secondPane as never);
  expect(activePaneId).toBe(2);
  expect(syncCalls.slice(-2)).toEqual(["pty:2", "render:2:auto"]);

  surfaceEvents?.onPaneClosed?.(secondPane as never);
  expect(demoStops).toEqual([1]);
  expect(paneStates.has(2)).toBe(false);

  surfaceEvents?.onLayoutChanged?.();
  surfaceEvents?.onLayoutChanged?.();
  expect(rafCallbacks).toHaveLength(2);

  expect(capturedConfig?.surface?.defaultContextMenu?.getPtyUrl?.()).toBe(
    "ws://localhost:8787/pty",
  );
});
