import type { InputHandler, MouseMode } from "../../input";
import { initWebGPU, initWebGL, type WebGPUState, type WebGLState } from "../../renderer";
import type { PtyTransport } from "../../pty";
import { type GhosttyTheme } from "../../theme";
import {
  copyToClipboard as writeClipboardText,
  pasteFromClipboard as readClipboardText,
} from "../../selection";
import type { ResttyWasm, ResttyWasmExports } from "../../wasm";
import { normalizeNewlines } from "./create-app-io-utils";
import { resolveMaxScrollbackBytes } from "./max-scrollback";
import type {
  ResttyRuntime,
  ResttyAppCallbacks,
  ResttyAppSession,
  ResttyRuntimeEvent,
  ResttyRuntimeLifecycleState,
} from "../types";
import type { PtyInputRuntime } from "./pty-input-runtime";
import type { RuntimeInteraction } from "./interaction-runtime";

export type RuntimeAppApiSharedState = {
  wasm: ResttyWasm | null;
  wasmExports: ResttyWasmExports | null;
  wasmHandle: number;
  wasmReady: boolean;
  activeState: WebGPUState | WebGLState | null;
  needsRender: boolean;
  lastRenderTime: number;
  currentContextType: "webgpu" | "webgl2" | null;
  isFocused: boolean;
  lastKeydownSeq: string;
  lastKeydownSeqAt: number;
};

type RuntimeBackend = "none" | "webgpu" | "webgl2";
type PreferredRenderer = "auto" | "webgpu" | "webgl2";

type RuntimeInternalState = {
  paused: boolean;
  backend: RuntimeBackend;
  preferredRenderer: PreferredRenderer;
  rafId: number;
  frameCount: number;
  lastFpsTime: number;
  nextBlinkTime: number;
};

type RuntimeSendInput = (text: string, source?: string, options?: { skipHooks?: boolean }) => void;

type RuntimePublicApiOptions = {
  setFontSize: ResttyRuntime["setFontSize"];
  setLigatures: ResttyRuntime["setLigatures"];
  setFontHinting: ResttyRuntime["setFontHinting"];
  setFontHintTarget: ResttyRuntime["setFontHintTarget"];
  setFontSources: ResttyRuntime["setFontSources"];
  resetTheme: ResttyRuntime["resetTheme"];
  setSearchQuery: ResttyRuntime["setSearchQuery"];
  clearSearch: ResttyRuntime["clearSearch"];
  searchNext: ResttyRuntime["searchNext"];
  searchPrevious: ResttyRuntime["searchPrevious"];
  getSearchState: ResttyRuntime["getSearchState"];
  resize: ResttyRuntime["resize"];
  focus: ResttyRuntime["focus"];
  blur: ResttyRuntime["blur"];
  updateSize: ResttyRuntime["updateSize"];
  setShaderStages: ResttyRuntime["setShaderStages"];
  getShaderStages: ResttyRuntime["getShaderStages"];
};

export type RuntimeAppApiRuntime = {
  sendInput: RuntimeSendInput;
  createPublicApi: (options: RuntimePublicApiOptions) => ResttyRuntime;
};

type LifecycleThemeRuntime = {
  cancelScheduledSizeUpdate: () => void;
  getActiveTheme: () => GhosttyTheme | null;
};

type CreateRuntimeAppApiOptions = {
  session: ResttyAppSession;
  ptyTransport: PtyTransport;
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  interaction: RuntimeInteraction;
  lifecycleThemeSizeRuntime: LifecycleThemeRuntime;
  cleanupFns: Array<() => void>;
  cleanupCanvasFns: Array<() => void>;
  callbacks?: ResttyAppCallbacks;
  fpsEl: HTMLElement | null;
  backendEl: HTMLElement | null;
  inputDebugEl: HTMLElement | null;
  imeInput: HTMLTextAreaElement | null;
  attachWindowEvents: boolean;
  isMacPlatform: boolean;
  textEncoder: TextEncoder;
  readState: () => RuntimeAppApiSharedState;
  writeState: (patch: Partial<RuntimeAppApiSharedState>) => void;
  appendLog: (line: string) => void;
  shouldSuppressWasmLog: (text: string) => boolean;
  runBeforeInputHook: (text: string, source: string) => string | null;
  runBeforeRenderOutputHook: (text: string, source: string) => string | null;
  getSelectionText: () => string;
  initialPreferredRenderer: PreferredRenderer;
  maxScrollbackBytes?: number;
  maxScrollback?: number;
  CURSOR_BLINK_MS: number;
  RESIZE_ACTIVE_MS: number;
  TARGET_RENDER_FPS: number;
  BACKGROUND_RENDER_FPS: number;
  KITTY_FLAG_REPORT_EVENTS: number;
  resizeState: { lastAt: number };
  tickWebGPU: (state: WebGPUState) => void;
  tickWebGL: (state: WebGLState) => void;
  updateGrid: () => void;
  gridState: { cols: number; rows: number };
  getCanvas: () => HTMLCanvasElement;
  applyTheme: ResttyRuntime["applyTheme"];
  ensureFont: () => Promise<void>;
  updateSize: ResttyRuntime["updateSize"];
  log: (line: string) => void;
  replaceCanvas: () => void;
  rebuildWebGPUShaderStages: (state: WebGPUState) => void;
  rebuildWebGLShaderStages: (state: WebGLState) => void;
  setShaderStagesDirty: (dirty: boolean) => void;
  clearWebGPUShaderStages: () => void;
  destroyWebGPUStageTargets: () => void;
  clearWebGLShaderStages: (state?: WebGLState) => void;
  destroyWebGLStageTargets: (state?: WebGLState) => void;
  markSearchDirty: () => void;
  handleSearchWasmReset: () => void;
};

export function createRuntimeAppApi(options: CreateRuntimeAppApiOptions): RuntimeAppApiRuntime {
  const {
    session,
    ptyTransport,
    inputHandler,
    ptyInputRuntime,
    interaction,
    lifecycleThemeSizeRuntime,
    cleanupFns,
    cleanupCanvasFns,
    callbacks,
    fpsEl,
    backendEl,
    inputDebugEl,
    imeInput,
    attachWindowEvents,
    isMacPlatform,
    textEncoder,
    readState,
    writeState,
    appendLog,
    shouldSuppressWasmLog,
    runBeforeInputHook,
    runBeforeRenderOutputHook,
    CURSOR_BLINK_MS,
    RESIZE_ACTIVE_MS,
    TARGET_RENDER_FPS,
    BACKGROUND_RENDER_FPS,
    KITTY_FLAG_REPORT_EVENTS,
    resizeState,
    tickWebGPU,
    tickWebGL,
    updateGrid,
    gridState,
    getCanvas,
    applyTheme,
    ensureFont,
    updateSize,
    log,
    replaceCanvas,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    clearWebGPUShaderStages,
    destroyWebGPUStageTargets,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    markSearchDirty,
    handleSearchWasmReset,
  } = options;

  let lifecycleState: ResttyRuntimeLifecycleState = "created";
  let lifecycleEpoch = 0;
  const eventListeners = new Set<(event: ResttyRuntimeEvent) => void>();

  const isCurrentLifecycleEpoch = (epoch: number) =>
    lifecycleState !== "destroyed" && epoch === lifecycleEpoch;

  const emitRuntimeEvent = (event: ResttyRuntimeEvent) => {
    for (const listener of eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore runtime event listener errors.
      }
    }
  };

  const setLifecycleState = (next: ResttyRuntimeLifecycleState) => {
    if (lifecycleState === next) return;
    lifecycleState = next;
    emitRuntimeEvent({ type: "state", state: next });
  };

  const internalState: RuntimeInternalState = {
    paused: false,
    backend: "none",
    preferredRenderer: options.initialPreferredRenderer,
    rafId: 0,
    frameCount: 0,
    lastFpsTime: performance.now(),
    nextBlinkTime: performance.now() + CURSOR_BLINK_MS,
  };
  const maxScrollbackBytes = resolveMaxScrollbackBytes(options);

  function updateFps() {
    internalState.frameCount += 1;
    const now = performance.now();
    if (now - internalState.lastFpsTime >= 500) {
      const fps = Math.round((internalState.frameCount * 1000) / (now - internalState.lastFpsTime));
      if (fpsEl) fpsEl.textContent = `${fps}`;
      callbacks?.onFps?.(fps);
      internalState.frameCount = 0;
      internalState.lastFpsTime = now;
    }
  }

  function canRenderFrame(shared: RuntimeAppApiSharedState): boolean {
    return Boolean(shared.wasmReady && shared.wasm && shared.wasmHandle);
  }

  function loop(state: WebGPUState | WebGLState) {
    if (!internalState.paused) {
      const now = performance.now();
      if (now >= internalState.nextBlinkTime) {
        internalState.nextBlinkTime = now + CURSOR_BLINK_MS;
        writeState({ needsRender: true });
      }
      const resizeActive = now - resizeState.lastAt <= RESIZE_ACTIVE_MS;
      if (resizeActive) {
        writeState({ needsRender: true });
      }
      const hidden =
        typeof document !== "undefined" &&
        typeof document.visibilityState === "string" &&
        document.visibilityState !== "visible";
      const targetRenderFps = hidden ? BACKGROUND_RENDER_FPS : TARGET_RENDER_FPS;
      const nextShared = readState();
      const renderBudget = resizeActive
        ? true
        : now - nextShared.lastRenderTime >= 1000 / targetRenderFps;
      if (nextShared.needsRender && renderBudget) {
        // Avoid presenting a cleared frame before the terminal core has a live handle.
        // Leaving needsRender=true retries immediately once startup finishes.
        if (canRenderFrame(nextShared)) {
          if (internalState.backend === "webgpu" && "device" in state) tickWebGPU(state);
          if (internalState.backend === "webgl2" && "gl" in state) tickWebGL(state);
          writeState({ lastRenderTime: now, needsRender: false });
          updateFps();
        }
      }
    }
    internalState.rafId = requestAnimationFrame(() => loop(state));
  }

  const onWasmLog = (text: string) => {
    if (shouldSuppressWasmLog(text)) return;
    console.log(`[wasm] ${text}`);
    appendLog(`[wasm] ${text}`);
  };
  if (session.addWasmLogListener) {
    session.addWasmLogListener(onWasmLog);
    cleanupFns.push(() => session.removeWasmLogListener?.(onWasmLog));
  }

  function destroyWasmHandle(instance: ResttyWasm, handle: number) {
    try {
      instance.destroy(handle);
    } catch {
      // ignore wasm destroy errors
    }
  }

  async function initWasm(initEpoch: number) {
    const shared = readState();
    if (shared.wasmReady && shared.wasm) return shared.wasm;
    const instance = await session.getWasm();
    if (!isCurrentLifecycleEpoch(initEpoch)) return null;
    writeState({
      wasm: instance,
      wasmExports: instance.exports,
      wasmReady: true,
    });
    return instance;
  }

  function writeToWasm(handle: number, text: string) {
    const shared = readState();
    if (!shared.wasm) return;
    shared.wasm.write(handle, text);
  }

  function flushWasmOutputToPty() {
    const shared = readState();
    if (!shared.wasm || !shared.wasmHandle) return;
    if (!ptyTransport.isConnected()) return;

    let iterations = 0;
    while (iterations < 32) {
      const out = shared.wasm.drainOutput(shared.wasmHandle);
      if (!out) break;
      ptyTransport.sendInput(out);
      iterations += 1;
    }
  }

  function sendInput(text: string, source = "program", config: { skipHooks?: boolean } = {}) {
    const shared = readState();
    if (!shared.wasmReady || !shared.wasm || !shared.wasmHandle) return;
    if (!text) return;
    let intercepted = text;
    if (!config.skipHooks) {
      intercepted =
        source === "pty"
          ? runBeforeRenderOutputHook(text, source)
          : runBeforeInputHook(text, source);
    }
    if (!intercepted) return;
    const normalized = source === "pty" ? intercepted : normalizeNewlines(intercepted);
    if (source === "key") {
      const bytes = textEncoder.encode(normalized);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
      const debugText = `${hex} (${bytes.length})`;
      if (inputDebugEl) inputDebugEl.textContent = debugText;
      callbacks?.onInputDebug?.(debugText);
    }
    if (source === "key") {
      let before = "";
      if (
        shared.wasmExports?.restty_active_cursor_x &&
        shared.wasmExports?.restty_active_cursor_y
      ) {
        const bx = shared.wasmExports.restty_active_cursor_x(shared.wasmHandle);
        const by = shared.wasmExports.restty_active_cursor_y(shared.wasmHandle);
        before = ` cursor=${bx},${by}`;
      }
      appendLog(`[key] ${JSON.stringify(normalized)}${before}`);
    }
    if (
      source === "key" &&
      (interaction.selectionState.active || interaction.selectionState.dragging)
    ) {
      interaction.clearSelection();
    }
    if (source === "pty" && interaction.linkState.hoverId) interaction.updateLinkHover(null);
    const canvas = getCanvas();
    shared.wasm.setPixelSize(shared.wasmHandle, canvas.width, canvas.height);
    writeToWasm(shared.wasmHandle, normalized);
    flushWasmOutputToPty();
    markSearchDirty();
    if (source === "pty" && inputHandler.isSynchronizedOutput?.()) {
      ptyInputRuntime.scheduleSyncOutputReset();
      return;
    }
    ptyInputRuntime.cancelSyncOutputReset();
    shared.wasm.renderUpdate(shared.wasmHandle);
    if (
      source === "key" &&
      shared.wasmExports?.restty_active_cursor_x &&
      shared.wasmExports?.restty_active_cursor_y
    ) {
      const ax = shared.wasmExports.restty_active_cursor_x(shared.wasmHandle);
      const ay = shared.wasmExports.restty_active_cursor_y(shared.wasmHandle);
      appendLog(`[key] after cursor=${ax},${ay}`);
    }
    writeState({ needsRender: true });
  }

  async function copySelectionToClipboard() {
    const text = options.getSelectionText();
    if (!text) return false;
    const copied = await writeClipboardText(text);
    if (copied) {
      appendLog("[ui] selection copied");
      return true;
    }
    appendLog("[ui] copy failed");
    return false;
  }

  async function pasteFromClipboard() {
    const text = await readClipboardText();
    if (text === null) {
      appendLog("[ui] paste failed");
      return false;
    }
    if (text) {
      ptyInputRuntime.sendPasteText(text);
      return true;
    }
    return false;
  }

  function clearScreen() {
    sendInput("\x1b[2J\x1b[H");
  }

  if (attachWindowEvents) {
    const hasInputFocus = () => {
      if (typeof document === "undefined") return true;
      const active = document.activeElement;
      const canvas = getCanvas();
      return active === canvas || (imeInput ? active === imeInput : false);
    };
    const ensureImeInputFocus = () => {
      if (!imeInput || typeof document === "undefined") return;
      if (document.activeElement === imeInput) return;
      imeInput.focus({ preventScroll: true });
    };

    const isMacInputSourceShortcut = (event: KeyboardEvent) =>
      isMacPlatform &&
      event.ctrlKey &&
      !event.metaKey &&
      (event.code === "Space" || event.key === " " || event.key === "Spacebar");

    const shouldSkipKeyEvent = (event: KeyboardEvent) => {
      const imeActive =
        typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== imeInput &&
        ["BUTTON", "SELECT", "INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        return true;
      }
      if (target === imeInput) {
        if (interaction.imeState.composing || event.isComposing) return true;
        if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !event.repeat)
          return true;
      }
      if (
        imeInput &&
        imeActive &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.length === 1 &&
        !event.repeat &&
        !event.isComposing &&
        !interaction.imeState.composing
      ) {
        return true;
      }
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isMacInputSourceShortcut(event)) {
        if (hasInputFocus()) ensureImeInputFocus();
        return;
      }
      if (shouldSkipKeyEvent(event)) return;
      if (!hasInputFocus()) return;
      ensureImeInputFocus();
      writeState({ isFocused: true });
      const shared = readState();
      if (!shared.wasmReady || !shared.wasmHandle) return;

      const key = event.key?.toLowerCase?.() ?? "";
      const hasPrimaryShortcutModifier = isMacPlatform ? event.metaKey : event.ctrlKey;
      const wantsCopy =
        hasPrimaryShortcutModifier &&
        !event.altKey &&
        (key === "c" || (event.shiftKey && key === "c"));
      const wantsPaste =
        hasPrimaryShortcutModifier &&
        !event.altKey &&
        (key === "v" || (event.shiftKey && key === "v"));

      if (wantsCopy && interaction.selectionState.active) {
        event.preventDefault();
        void copySelectionToClipboard();
        return;
      }
      if (wantsPaste) {
        if (imeInput) {
          ensureImeInputFocus();
          return;
        }
        event.preventDefault();
        const seq = inputHandler.encodeKeyEvent(event);
        if (seq) {
          ptyInputRuntime.sendKeyInput(seq);
        }
        return;
      }

      const seq = inputHandler.encodeKeyEvent(event);
      if (seq) {
        if (
          event.type === "keydown" &&
          ["Backspace", "Delete", "Del", "Enter"].includes(event.key)
        ) {
          writeState({
            lastKeydownSeq: seq,
            lastKeydownSeqAt: performance.now(),
          });
        }
        event.preventDefault();
        ptyInputRuntime.sendKeyInput(seq);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isMacInputSourceShortcut(event)) return;
      const shared = readState();
      if (!shared.wasm || !shared.wasmHandle) return;
      if ((shared.wasm.getKittyKeyboardFlags(shared.wasmHandle) & KITTY_FLAG_REPORT_EVENTS) === 0) {
        return;
      }
      if (shouldSkipKeyEvent(event)) return;
      if (!hasInputFocus()) return;
      writeState({ isFocused: true });
      const nextShared = readState();
      if (!nextShared.wasmReady || !nextShared.wasmHandle) return;

      const seq = inputHandler.encodeKeyEvent(event);
      if (seq) {
        event.preventDefault();
        ptyInputRuntime.sendKeyInput(seq);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cleanupFns.push(() => window.removeEventListener("keydown", onKeyDown));
    cleanupFns.push(() => window.removeEventListener("keyup", onKeyUp));
  }

  async function initWasmHarness(initEpoch: number) {
    try {
      const instance = await initWasm(initEpoch);
      if (!instance || !isCurrentLifecycleEpoch(initEpoch)) return;
      const shared = readState();
      if (shared.wasmHandle) {
        destroyWasmHandle(instance, shared.wasmHandle);
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        writeState({ wasmHandle: 0 });
      }
      updateGrid();
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      const cols = gridState.cols || 80;
      const rows = gridState.rows || 24;
      const wasmHandle = instance.create(cols, rows, maxScrollbackBytes);
      if (!wasmHandle) {
        throw new Error("restty create failed (restty_create returned 0)");
      }
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        return;
      }
      const canvas = getCanvas();
      instance.setPixelSize(wasmHandle, canvas.width, canvas.height);
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        return;
      }
      const activeTheme = lifecycleThemeSizeRuntime.getActiveTheme();
      if (activeTheme && isCurrentLifecycleEpoch(initEpoch)) {
        applyTheme(activeTheme, activeTheme.name ?? "cached theme");
      }
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        return;
      }
      instance.renderUpdate(wasmHandle);
      writeState({ wasmHandle, needsRender: true });
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        if (readState().wasmHandle === wasmHandle) {
          writeState({ wasmHandle: 0 });
        }
        return;
      }
      handleSearchWasmReset();
    } catch (err) {
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`restty error: ${message}`);
      throw err;
    }
  }

  async function init() {
    if (lifecycleState === "destroyed") return;
    lifecycleEpoch += 1;
    const initEpoch = lifecycleEpoch;
    setLifecycleState("initializing");

    try {
      cancelAnimationFrame(internalState.rafId);
      updateSize();

      log("initializing...");
      await ensureFont();
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      updateGrid();
      const wasmPromise = initWasmHarness(initEpoch);

      const shared = readState();
      if (internalState.preferredRenderer !== "webgl2") {
        if (shared.currentContextType === "webgl2") {
          replaceCanvas();
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
        }
        const canvas = getCanvas();
        const gpuCore = await session.getWebGPUCore(canvas);
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        const gpuState = gpuCore ? await initWebGPU(canvas, { core: gpuCore }) : null;
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        if (gpuState) {
          internalState.backend = "webgpu";
          writeState({
            activeState: gpuState,
            currentContextType: "webgpu",
            needsRender: true,
          });
          if (backendEl) backendEl.textContent = "webgpu";
          emitRuntimeEvent({ type: "backend", backend: "webgpu" });
          callbacks?.onBackend?.("webgpu");
          log("webgpu ready");
          clearWebGLShaderStages();
          destroyWebGLStageTargets();
          gpuState.context.configure({
            device: gpuState.device,
            format: gpuState.format,
            alphaMode: "opaque",
          });
          rebuildWebGPUShaderStages(gpuState);
          setShaderStagesDirty(false);
          updateGrid();
          await wasmPromise;
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
          setLifecycleState("ready");
          internalState.rafId = requestAnimationFrame(() => loop(gpuState));
          return;
        }
      }

      if (internalState.preferredRenderer !== "webgpu") {
        const nextShared = readState();
        if (nextShared.currentContextType === "webgpu") {
          replaceCanvas();
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
        }
        const canvas = getCanvas();
        const glState = initWebGL(canvas);
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        if (glState) {
          internalState.backend = "webgl2";
          writeState({
            activeState: glState,
            currentContextType: "webgl2",
            needsRender: true,
          });
          if (backendEl) backendEl.textContent = "webgl2";
          emitRuntimeEvent({ type: "backend", backend: "webgl2" });
          callbacks?.onBackend?.("webgl2");
          log("webgl2 ready");
          clearWebGPUShaderStages();
          destroyWebGPUStageTargets();
          rebuildWebGLShaderStages(glState);
          setShaderStagesDirty(false);
          updateGrid();
          await wasmPromise;
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
          setLifecycleState("ready");
          internalState.rafId = requestAnimationFrame(() => loop(glState));
          return;
        }
      }

      internalState.backend = "none";
      if (backendEl) backendEl.textContent = "none";
      emitRuntimeEvent({ type: "backend", backend: "none" });
      callbacks?.onBackend?.("none");
      log("no GPU backend available");
      writeState({ activeState: null, currentContextType: null });
      await wasmPromise;
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      setLifecycleState("ready");
    } catch (error) {
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      setLifecycleState("failed");
      throw error;
    }
  }

  function destroy() {
    if (lifecycleState === "destroyed") return;
    lifecycleEpoch += 1;
    setLifecycleState("destroyed");
    cancelAnimationFrame(internalState.rafId);
    internalState.backend = "none";
    lifecycleThemeSizeRuntime.cancelScheduledSizeUpdate();
    ptyInputRuntime.cancelSyncOutputReset();
    ptyInputRuntime.disconnectPty();
    ptyTransport.destroy?.();
    if (backendEl) backendEl.textContent = "none";
    const shared = readState();
    if (shared.wasm && shared.wasmHandle) {
      destroyWasmHandle(shared.wasm, shared.wasmHandle);
      writeState({ wasmHandle: 0 });
    }
    clearWebGPUShaderStages();
    destroyWebGPUStageTargets();
    const activeState = readState().activeState;
    if (activeState && "gl" in activeState) {
      clearWebGLShaderStages(activeState);
      destroyWebGLStageTargets(activeState);
    } else {
      clearWebGLShaderStages();
      destroyWebGLStageTargets();
    }
    writeState({
      activeState: null,
      currentContextType: null,
      needsRender: false,
    });
    for (const cleanup of cleanupCanvasFns) cleanup();
    cleanupCanvasFns.length = 0;
    for (const cleanup of cleanupFns) cleanup();
    cleanupFns.length = 0;
  }

  function setRenderer(value: "auto" | "webgpu" | "webgl2") {
    if (lifecycleState === "destroyed") return;
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    internalState.preferredRenderer = value;
    void init();
  }

  function setPaused(value: boolean) {
    internalState.paused = Boolean(value);
  }

  function togglePause() {
    internalState.paused = !internalState.paused;
  }

  function setMouseMode(value: MouseMode) {
    inputHandler.setMouseMode(value);
    ptyInputRuntime.updateMouseStatus();
  }

  function getMouseStatus() {
    return inputHandler.getMouseStatus();
  }

  function createPublicApi(publicApiOptions: RuntimePublicApiOptions): ResttyRuntime {
    ptyInputRuntime.setPtyStatus("disconnected");
    ptyInputRuntime.updateMouseStatus();

    return {
      init,
      destroy,
      getLifecycleState: () => lifecycleState,
      events: {
        subscribe: (listener) => {
          eventListeners.add(listener);
          try {
            listener({ type: "state", state: lifecycleState });
          } catch {
            // Ignore runtime event listener errors.
          }
          return () => {
            eventListeners.delete(listener);
          };
        },
      },
      setRenderer,
      setPaused,
      togglePause,
      setFontSize: publicApiOptions.setFontSize,
      setLigatures: publicApiOptions.setLigatures,
      setFontHinting: publicApiOptions.setFontHinting,
      setFontHintTarget: publicApiOptions.setFontHintTarget,
      setFontSources: publicApiOptions.setFontSources,
      applyTheme,
      resetTheme: publicApiOptions.resetTheme,
      sendInput,
      sendKeyInput: ptyInputRuntime.sendKeyInput,
      clearScreen,
      connectPty: ptyInputRuntime.connectPty,
      disconnectPty: ptyInputRuntime.disconnectPty,
      isPtyConnected: () => ptyTransport.isConnected(),
      setMouseMode,
      getMouseStatus,
      copySelectionToClipboard,
      pasteFromClipboard,
      selectWordAtClientPoint: interaction.selectWordAtClientPoint,
      setSearchQuery: publicApiOptions.setSearchQuery,
      clearSearch: publicApiOptions.clearSearch,
      searchNext: publicApiOptions.searchNext,
      searchPrevious: publicApiOptions.searchPrevious,
      getSearchState: publicApiOptions.getSearchState,
      resize: publicApiOptions.resize,
      focus: publicApiOptions.focus,
      blur: publicApiOptions.blur,
      updateSize: publicApiOptions.updateSize,
      getBackend: () => internalState.backend,
      setShaderStages: publicApiOptions.setShaderStages,
      getShaderStages: publicApiOptions.getShaderStages,
    };
  }

  return {
    sendInput,
    createPublicApi,
  };
}
