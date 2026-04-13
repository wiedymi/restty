import {
  Restty,
  listBuiltinThemeNames,
  parseGhosttyTheme,
  type GhosttyTheme,
  type ResttyShaderStage,
} from "../src/index.ts";
import { createDemoController, type PlaygroundDemoKind } from "./lib/demos.ts";
import {
  applyFontRenderingOptionsToAllPanes,
  applyFontSourcesToAllPanes,
} from "./lib/font-application.ts";
import {
  DEFAULT_FONT_FAMILY,
  FONT_FAMILY_LOCAL_PREFIX,
  detectLocalFonts,
  getCurrentFontSources,
  resolveFontHintTarget,
  supportsLocalFontPicker,
  syncFontFamilyControls,
  syncHintingControls,
  type FontHintTarget,
} from "./lib/font-controls.ts";
import {
  createAdaptivePtyTransport,
  getConnectUrl,
  getConnectionBackend,
  syncConnectionUi,
} from "./lib/pty-connection.ts";
import {
  applyBuiltinThemeToPane,
  applySavedThemeForPane,
  applyThemeToPane,
  resetThemeForPane,
} from "./lib/pane-theme.ts";
import {
  closeSettingsDialog,
  isSettingsDialogOpen,
  openSettingsDialog,
} from "./lib/settings-dialog.ts";
import {
  createPaneState,
  getActivePaneState,
  type PaneState,
  type RendererChoice,
  withPanePaused,
} from "./lib/pane-state.ts";

const paneRoot = document.getElementById("paneRoot") as HTMLElement | null;
if (!paneRoot) {
  throw new Error("missing #paneRoot element");
}

const btnInit = document.getElementById("btnInit");
const btnPause = document.getElementById("btnPause");
const btnClear = document.getElementById("btnClear");
const rendererSelect = document.getElementById("rendererSelect") as HTMLSelectElement | null;
const demoSelect = document.getElementById("demoSelect") as HTMLSelectElement | null;
const btnRunDemo = document.getElementById("btnRunDemo");
const connectionBackendEl = document.getElementById(
  "connectionBackend",
) as HTMLSelectElement | null;
const ptyUrlInput = document.getElementById("ptyUrl") as HTMLInputElement | null;
const wcCommandInput = document.getElementById("wcCommand") as HTMLInputElement | null;
const wcCwdInput = document.getElementById("wcCwd") as HTMLInputElement | null;
const connectionHintEl = document.getElementById("connectionHint") as HTMLElement | null;
const ptyBtn = document.getElementById("btnPty");
const themeSelect = document.getElementById("themeSelect") as HTMLSelectElement | null;
const themeFileInput = document.getElementById("themeFile") as HTMLInputElement | null;
const fontSizeInput = document.getElementById("fontSize") as HTMLInputElement | null;
const fontFamilySelect = document.getElementById("fontFamily") as HTMLSelectElement | null;
const ligaturesSelect = document.getElementById("ligatures") as HTMLSelectElement | null;
const fontHintingSelect = document.getElementById("fontHinting") as HTMLSelectElement | null;
const fontHintTargetSelect = document.getElementById("fontHintTarget") as HTMLSelectElement | null;
const fontFamilyLocalSelect = document.getElementById(
  "fontFamilyLocal",
) as HTMLSelectElement | null;
const btnLoadLocalFonts = document.getElementById("btnLoadLocalFonts") as HTMLButtonElement | null;
const fontFamilyHintEl = document.getElementById("fontFamilyHint");
const mouseModeEl = document.getElementById("mouseMode") as HTMLSelectElement | null;
const shaderPresetEl = document.getElementById("shaderPreset") as HTMLSelectElement | null;
const settingsFab = document.getElementById("settingsFab") as HTMLButtonElement | null;
const settingsDialog = document.getElementById("settingsDialog") as HTMLDialogElement | null;
const settingsClose = document.getElementById("settingsClose") as HTMLButtonElement | null;

const DEFAULT_THEME_NAME = "Aizen Dark";

type ShaderPreset = "none" | "scanline" | "aurora" | "crt-lite" | "mono-green";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;

const paneStates = new Map<number, PaneState>();
let activePaneId: number | null = null;
let resizeRaf = 0;
let restty: Restty;
let notificationPermissionRequest: Promise<NotificationPermission> | null = null;
let selectedShaderPreset = (shaderPresetEl?.value as ShaderPreset | undefined) ?? "none";

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;
let selectedFontFamily = fontFamilySelect?.value ?? DEFAULT_FONT_FAMILY;
let selectedLocalFontMatcher = "";
const searchParams =
  typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
function isTruthyQueryParam(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function isFalsyQueryParam(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off";
}

let selectedLigatures = !isFalsyQueryParam(searchParams?.get("ligatures"));
let selectedFontHinting = isTruthyQueryParam(searchParams?.get("hinting"));
let selectedFontHintTarget = resolveFontHintTarget(searchParams?.get("hintTarget"));

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shaderStagesForPreset(preset: ShaderPreset): ResttyShaderStage[] {
  if (preset === "scanline") {
    return [
      {
        id: "playground/scanline",
        mode: "after-main",
        uniforms: [0.38, 1.0],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let strength = clamp(params0.x, 0.0, 0.85);
  let speed = max(params0.y, 0.1);
  let stripes = 0.5 + 0.5 * sin(uv.y * 1800.0 + time * 1.8 * speed);
  let darken = 1.0 - strength * (0.15 + 0.85 * stripes);
  let beam = 1.0 + 0.04 * strength * sin(uv.y * 90.0 - time * 5.0 * speed);
  let outColor = color.rgb * darken * beam;
  return vec4f(min(vec3f(1.0), outColor), color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float strength = clamp(params0.x, 0.0, 0.85);
  float speed = max(params0.y, 0.1);
  float stripes = 0.5 + 0.5 * sin(uv.y * 1800.0 + time * 1.8 * speed);
  float darken = 1.0 - strength * (0.15 + 0.85 * stripes);
  float beam = 1.0 + 0.04 * strength * sin(uv.y * 90.0 - time * 5.0 * speed);
  vec3 outColor = color.rgb * darken * beam;
  return vec4(min(vec3(1.0), outColor), color.a);
}
`,
        },
      },
    ];
  }

  if (preset === "aurora") {
    return [
      {
        id: "playground/aurora",
        mode: "after-main",
        uniforms: [0.28, 1.0],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let mixAmount = clamp(params0.x, 0.0, 0.65);
  let speed = max(params0.y, 0.1);
  let phase = time * speed + uv.y * 14.0 + uv.x * 3.5;
  let wave0 = 0.5 + 0.5 * sin(phase);
  let wave1 = 0.5 + 0.5 * sin(phase * 1.37 + 2.1);
  let wave2 = 0.5 + 0.5 * sin(phase * 0.73 + 4.2);
  let tint = vec3f(
    0.12 + wave0 * 0.28,
    0.08 + wave1 * 0.32,
    0.18 + wave2 * 0.24
  );
  let sparkle = 1.0 + 0.06 * sin((uv.x * 120.0 + uv.y * 42.0) + time * 4.0 * speed);
  let boosted = min(vec3f(1.0), color.rgb * sparkle);
  let outColor = mix(color.rgb, min(vec3f(1.0), boosted + tint * 0.35), mixAmount);
  return vec4f(outColor, color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float mixAmount = clamp(params0.x, 0.0, 0.65);
  float speed = max(params0.y, 0.1);
  float phase = time * speed + uv.y * 14.0 + uv.x * 3.5;
  float wave0 = 0.5 + 0.5 * sin(phase);
  float wave1 = 0.5 + 0.5 * sin(phase * 1.37 + 2.1);
  float wave2 = 0.5 + 0.5 * sin(phase * 0.73 + 4.2);
  vec3 tint = vec3(
    0.12 + wave0 * 0.28,
    0.08 + wave1 * 0.32,
    0.18 + wave2 * 0.24
  );
  float sparkle = 1.0 + 0.06 * sin((uv.x * 120.0 + uv.y * 42.0) + time * 4.0 * speed);
  vec3 boosted = min(vec3(1.0), color.rgb * sparkle);
  vec3 outColor = mix(color.rgb, min(vec3(1.0), boosted + tint * 0.35), mixAmount);
  return vec4(outColor, color.a);
}
`,
        },
      },
    ];
  }

  if (preset === "crt-lite") {
    return [
      {
        id: "playground/crt-lite",
        mode: "after-main",
        uniforms: [0.24, 0.12],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let vignetteStrength = clamp(params0.x, 0.0, 0.7);
  let maskStrength = clamp(params0.y, 0.0, 0.35);
  let centered = (uv - vec2f(0.5, 0.5)) * 2.0;
  let vignette = max(0.0, 1.0 - vignetteStrength * dot(centered, centered));
  let scan = 0.92 + 0.08 * (0.5 + 0.5 * sin(uv.y * 1400.0));
  let phase = uv.x * 1400.0;
  let mask = vec3f(
    1.0 + maskStrength * sin(phase),
    1.0 + maskStrength * sin(phase + 2.094),
    1.0 + maskStrength * sin(phase + 4.188)
  );
  let flicker = 1.0 + 0.012 * sin(time * 64.0);
  let outColor = min(vec3f(1.0), color.rgb * vignette * scan * flicker * mask);
  return vec4f(outColor, color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float vignetteStrength = clamp(params0.x, 0.0, 0.7);
  float maskStrength = clamp(params0.y, 0.0, 0.35);
  vec2 centered = (uv - vec2(0.5)) * 2.0;
  float vignette = max(0.0, 1.0 - vignetteStrength * dot(centered, centered));
  float scan = 0.92 + 0.08 * (0.5 + 0.5 * sin(uv.y * 1400.0));
  float phase = uv.x * 1400.0;
  vec3 mask = vec3(
    1.0 + maskStrength * sin(phase),
    1.0 + maskStrength * sin(phase + 2.094),
    1.0 + maskStrength * sin(phase + 4.188)
  );
  float flicker = 1.0 + 0.012 * sin(time * 64.0);
  vec3 outColor = min(vec3(1.0), color.rgb * vignette * scan * flicker * mask);
  return vec4(outColor, color.a);
}
`,
        },
      },
    ];
  }

  if (preset === "mono-green") {
    return [
      {
        id: "playground/mono-green",
        mode: "after-main",
        uniforms: [1.0],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let gain = clamp(params0.x, 0.25, 2.0);
  let luma = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
  return vec4f(luma * 0.12 * gain, luma * 0.95 * gain, luma * 0.35 * gain, color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float gain = clamp(params0.x, 0.25, 2.0);
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  return vec4(luma * 0.12 * gain, luma * 0.95 * gain, luma * 0.35 * gain, color.a);
}
`,
        },
      },
    ];
  }

  return [];
}

function applyShaderPreset() {
  restty.setShaderStages(shaderStagesForPreset(selectedShaderPreset));
}

function handleDesktopNotification(notification: {
  title: string;
  body: string;
  source: "osc9" | "osc777";
  raw: string;
  paneId: number;
}) {
  const title = notification.title.trim() || "Terminal notification";
  const body = notification.body.trim();
  const prefix = `[notify][pane ${notification.paneId}][${notification.source}]`;
  if (body) {
    console.info(`${prefix} ${title}: ${body}`);
  } else {
    console.info(`${prefix} ${title}`);
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const browserNotification = new Notification(title, body ? { body } : undefined);
      void browserNotification;
    } catch {
      // Ignore browser notification failures in playground mode.
    }
    return;
  }

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    if (!notificationPermissionRequest) {
      notificationPermissionRequest = Notification.requestPermission().catch(() => "denied");
    }
    void notificationPermissionRequest.then((permission) => {
      if (permission !== "granted") return;
      try {
        const browserNotification = new Notification(title, body ? { body } : undefined);
        void browserNotification;
      } catch {
        // Ignore browser notification failures in playground mode.
      }
    });
  }
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function getActivePane(): ManagedPane | null {
  return restty.getActivePane();
}

function syncPauseButton(state: PaneState) {
  if (btnPause) btnPause.textContent = state.paused ? "Resume" : "Pause";
}

function syncPtyButton(pane: ManagedPane) {
  if (!ptyBtn) return;
  if (pane.runtime.io.isPtyConnected()) {
    ptyBtn.textContent = "Disconnect";
    return;
  }
  ptyBtn.textContent =
    getConnectionBackend(connectionBackendEl) === "webcontainer"
      ? "Start WebContainer"
      : "Connect PTY";
}

function renderActivePaneControls(pane: ManagedPane, state: PaneState) {
  syncPauseButton(state);
  if (rendererSelect) rendererSelect.value = state.renderer;
  if (fontSizeInput) fontSizeInput.value = `${state.fontSize}`;
  syncFontFamilyControls({
    fontFamilySelect,
    fontFamilyLocalSelect,
    btnLoadLocalFonts,
    selectedFontFamily,
    selectedLocalFontMatcher,
    supportsLocalFontPicker: supportsLocalFontPicker(),
  });
  syncHintingControls({
    ligaturesSelect,
    fontHintingSelect,
    fontHintTargetSelect,
    selectedLigatures,
    selectedFontHinting,
    selectedFontHintTarget,
  });
  state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
  if (mouseModeEl) {
    const hasOption = Array.from(mouseModeEl.options).some(
      (option) => option.value === state.mouseMode,
    );
    mouseModeEl.value = hasOption ? state.mouseMode : "auto";
  }
  if (shaderPresetEl) shaderPresetEl.value = selectedShaderPreset;
  if (themeSelect) themeSelect.value = state.theme.selectValue;
}

function setPanePaused(id: number, value: boolean) {
  const pane = restty.getPaneById(id);
  const state = paneStates.get(id);
  if (!pane || !state) return;
  const nextState = withPanePaused(state, value);
  paneStates.set(id, nextState);
  pane.paused = nextState.paused;
  pane.runtime.terminal.setPaused(nextState.paused);
  if (id === activePaneId) {
    syncPauseButton(nextState);
  }
}

function connectPaneIfNeeded(pane: ManagedPane) {
  if (getConnectionBackend(connectionBackendEl) !== "webcontainer") return;
  if (pane.runtime.io.isPtyConnected()) return;
  pane.runtime.interaction.updateSize(true);
  pane.runtime.io.connectPty(getConnectUrl(connectionBackendEl, ptyUrlInput));
  requestAnimationFrame(() => {
    pane.runtime.interaction.updateSize(true);
  });
}

async function initPaneApp(pane: ManagedPane, state: PaneState) {
  await pane.runtime.lifecycle.init();
  paneStates.set(
    pane.id,
    applySavedThemeForPane({
      pane,
      state,
      activePaneId,
      themeSelect,
    }),
  );
  await waitForAnimationFrame();
  pane.runtime.interaction.updateSize(true);
  connectPaneIfNeeded(pane);
  if (pane.id === activePaneId) {
    syncPtyButton(pane);
  }
  pane.canvas.focus({ preventScroll: true });
}

function queueResizeAllPanes() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    for (const pane of restty.getPanes()) {
      pane.runtime.interaction.updateSize(true);
    }
  });
}

function populateThemeSelect(names: string[]) {
  if (!themeSelect) return;
  const existing = new Set<string>();
  for (const opt of themeSelect.options) {
    if (opt.value) existing.add(opt.value);
  }
  for (const name of names) {
    if (existing.has(name)) continue;
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    themeSelect.appendChild(option);
  }
}

const builtinThemeNames = listBuiltinThemeNames();
populateThemeSelect(builtinThemeNames);
const defaultThemeName = builtinThemeNames.includes(DEFAULT_THEME_NAME) ? DEFAULT_THEME_NAME : "";

restty = new Restty({
  root: paneRoot,
  surface: {
    createInitialPane: false,
    autoInit: false,
    paneStyles: {
      inactivePaneOpacity: 0.9,
    },
    searchUi: {
      styles: {
        offsetTopPx: 14,
        offsetRightPx: 14,
        maxWidthPx: 400,
        borderRadiusPx: 14,
        panelBackground: "rgba(14, 14, 14, 0.92)",
        panelBorderColor: "rgba(255, 255, 255, 0.14)",
        buttonHoverBackground: "rgba(255, 255, 255, 0.18)",
        statusActiveTextColor: "#e0bc72",
      },
    },
    events: {
      onPaneCreated: (pane) => {
        const state = paneStates.get(pane.id);
        if (!state) return;

        pane.paused = state.paused;
        pane.setPaused = (value: boolean) => {
          setPanePaused(pane.id, value);
        };

        state.demos = createDemoController(pane.runtime);
        pane.runtime.interaction.setMouseMode(state.mouseMode);
        void initPaneApp(pane, state);
      },
      onPaneClosed: (pane) => {
        const state = paneStates.get(pane.id);
        state?.demos?.stop();
        paneStates.delete(pane.id);
      },
      onActivePaneChange: (pane) => {
        activePaneId = pane?.id ?? null;
        if (!pane) return;
        const state = paneStates.get(pane.id);
        if (!state) return;
        syncPtyButton(pane);
        renderActivePaneControls(pane, state);
      },
      onLayoutChanged: () => {
        queueResizeAllPanes();
      },
      onDesktopNotification: handleDesktopNotification,
    },
    defaultContextMenu: {
      canOpen: () => !isSettingsDialogOpen(),
      getPtyUrl: () => getConnectUrl(connectionBackendEl, ptyUrlInput),
    },
    shortcuts: {
      enabled: true,
      canHandleEvent: () => !isSettingsDialogOpen(),
    },
  },
  terminal: ({ id, sourcePane }) => {
    const paneState = createPaneState({
      id,
      sourceState: sourcePane ? (paneStates.get(sourcePane.id) ?? null) : null,
      renderer: isRendererChoice(rendererSelect?.value) ? rendererSelect.value : "auto",
      fontSize: parseFontSize(
        fontSizeInput?.value,
        Number.isFinite(initialFontSize) ? initialFontSize : 18,
      ),
      mouseMode: mouseModeEl?.value || "auto",
      defaultThemeName,
    });
    paneStates.set(id, paneState);
    return {
      renderer: paneState.renderer,
      fontSize: paneState.fontSize,
      ligatures: selectedLigatures,
      fontHinting: selectedFontHinting,
      fontHintTarget: selectedFontHintTarget,
      // Ghostty parity: use EM sizing semantics and native alpha blending.
      fontSizeMode: "em",
      alphaBlending: "native",
      fontSources: getCurrentFontSources(selectedFontFamily, selectedLocalFontMatcher),
    };
  },
  services: ({ id }) => ({
    ptyTransport: createAdaptivePtyTransport({
      getConnectionBackend: () => getConnectionBackend(connectionBackendEl),
      getPtyUrl: () => getConnectUrl(connectionBackendEl, ptyUrlInput),
      getWebContainerCommand: () => wcCommandInput?.value?.trim() || "jsh",
      getWebContainerCwd: () => wcCwdInput?.value?.trim() || "/",
    }),
    callbacks: {},
  }),
});
applyShaderPreset();

settingsFab?.addEventListener("click", () => {
  openSettingsDialog({ host: restty, settingsDialog });
});

settingsClose?.addEventListener("click", () => {
  closeSettingsDialog({ host: restty, settingsDialog });
});

settingsDialog?.addEventListener("click", (event) => {
  if (event.target !== settingsDialog) return;
  closeSettingsDialog({ host: restty, settingsDialog });
});

settingsDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSettingsDialog({ host: restty, settingsDialog });
});

window.addEventListener(
  "keydown",
  (event) => {
    if (isSettingsDialogOpen(settingsDialog) && event.key === "Escape") {
      event.preventDefault();
      closeSettingsDialog({ host: restty, settingsDialog });
    }
  },
  { capture: true },
);

window.addEventListener("resize", () => {
  queueResizeAllPanes();
});

connectionBackendEl?.addEventListener("change", () => {
  syncConnectionUi({
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    connectionHintEl,
  });
  for (const pane of restty.getPanes()) {
    if (pane.runtime.io.isPtyConnected()) {
      pane.runtime.io.disconnectPty();
    }
  }
  if (getConnectionBackend(connectionBackendEl) === "webcontainer") {
    for (const pane of restty.getPanes()) {
      connectPaneIfNeeded(pane);
    }
  }

  const activePane = getActivePane();
  if (activePane) {
    syncPtyButton(activePane);
  }
});

btnInit?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  setPanePaused(pane.id, false);
  state.demos?.stop();
  void initPaneApp(pane, state);
});

btnPause?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  setPanePaused(pane.id, !state.paused);
});

btnClear?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  state.demos?.stop();
  pane.runtime.terminal.clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  state.demos?.run((demoSelect?.value as PlaygroundDemoKind | string) ?? "basic");
});

ptyBtn?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  if (pane.runtime.io.isPtyConnected()) {
    pane.runtime.io.disconnectPty();
  } else {
    pane.runtime.io.connectPty(getConnectUrl(connectionBackendEl, ptyUrlInput));
  }
  syncPtyButton(pane);
});

rendererSelect?.addEventListener("change", () => {
  const pane = getActivePane();
  const state = getActivePaneState(paneStates, activePaneId);
  if (!pane || !state) return;
  const value = rendererSelect.value;
  if (!isRendererChoice(value)) return;
  state.renderer = value;
  pane.runtime.terminal.setRenderer(value);
});

if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    const pane = getActivePane();
    const state = getActivePaneState(paneStates, activePaneId);
    const file = themeFileInput.files?.[0];
    if (!pane || !state || !file) return;
    file
      .text()
      .then((text) => {
        const theme: GhosttyTheme = parseGhosttyTheme(text);
        const nextState = applyThemeToPane({
          pane,
          state,
          theme,
          sourceLabel: file.name || "theme file",
          activePaneId,
          themeSelect,
        });
        if (nextState) {
          paneStates.set(pane.id, nextState);
        }
      })
      .catch((err) => {
        console.error("theme load failed", err);
      })
      .finally(() => {
        themeFileInput.value = "";
      });
  });
}

if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    const pane = getActivePane();
    const state = getActivePaneState(paneStates, activePaneId);
    if (!pane || !state) return;
    const name = themeSelect.value;
    if (!name) {
      paneStates.set(
        pane.id,
        resetThemeForPane({
          pane,
          state,
          activePaneId,
          themeSelect,
        }),
      );
      return;
    }
    const nextState = applyBuiltinThemeToPane({
      pane,
      state,
      name,
      activePaneId,
      themeSelect,
    });
    if (nextState) {
      paneStates.set(pane.id, nextState);
    }
  });
}

if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    const pane = getActivePane();
    const state = getActivePaneState(paneStates, activePaneId);
    if (!pane || !state) return;
    const value = mouseModeEl.value;
    pane.runtime.interaction.setMouseMode(value);
    state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
    if (pane.id === activePaneId) {
      mouseModeEl.value = state.mouseMode;
    }
  });
}

if (shaderPresetEl) {
  shaderPresetEl.addEventListener("change", () => {
    const value = shaderPresetEl.value;
    if (
      value !== "none" &&
      value !== "scanline" &&
      value !== "aurora" &&
      value !== "crt-lite" &&
      value !== "mono-green"
    ) {
      selectedShaderPreset = "none";
      shaderPresetEl.value = "none";
    } else {
      selectedShaderPreset = value;
    }
    applyShaderPreset();
  });
}

if (fontSizeInput) {
  const applyFontSize = () => {
    const pane = getActivePane();
    const state = getActivePaneState(paneStates, activePaneId);
    if (!pane || !state) return;
    const value = Number(fontSizeInput.value);
    if (!Number.isFinite(value)) return;
    state.fontSize = value;
    pane.runtime.terminal.setFontSize(value);
  };

  fontSizeInput.addEventListener("change", applyFontSize);
  fontSizeInput.addEventListener("input", applyFontSize);
}

if (fontHintingSelect) {
  fontHintingSelect.addEventListener("change", () => {
    selectedFontHinting = fontHintingSelect.value === "on";
    syncHintingControls({
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
    applyFontRenderingOptionsToAllPanes({
      host: restty,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
  });
}

if (ligaturesSelect) {
  ligaturesSelect.addEventListener("change", () => {
    selectedLigatures = ligaturesSelect.value === "on";
    syncHintingControls({
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
    applyFontRenderingOptionsToAllPanes({
      host: restty,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
  });
}

if (fontHintTargetSelect) {
  fontHintTargetSelect.addEventListener("change", () => {
    selectedFontHintTarget = resolveFontHintTarget(fontHintTargetSelect.value);
    syncHintingControls({
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
    applyFontRenderingOptionsToAllPanes({
      host: restty,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
  });
}

if (fontFamilySelect) {
  fontFamilySelect.addEventListener("change", () => {
    selectedFontFamily = fontFamilySelect.value || DEFAULT_FONT_FAMILY;
    syncFontFamilyControls({
      fontFamilySelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      selectedFontFamily,
      selectedLocalFontMatcher,
      supportsLocalFontPicker: supportsLocalFontPicker(),
    });
    void applyFontSourcesToAllPanes({
      host: restty,
      selectedFontFamily,
      selectedLocalFontMatcher,
      onError: (error) => {
        console.error("font source apply failed", error);
      },
    });
  });
}

if (fontFamilyLocalSelect) {
  fontFamilyLocalSelect.addEventListener("change", () => {
    const value = fontFamilyLocalSelect.value;
    if (!value) {
      selectedLocalFontMatcher = "";
    } else if (value.startsWith(FONT_FAMILY_LOCAL_PREFIX)) {
      const encoded = value.slice(FONT_FAMILY_LOCAL_PREFIX.length);
      selectedLocalFontMatcher = decodeURIComponent(encoded).trim().toLowerCase();
    } else {
      selectedLocalFontMatcher = "";
    }
    syncFontFamilyControls({
      fontFamilySelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      selectedFontFamily,
      selectedLocalFontMatcher,
      supportsLocalFontPicker: supportsLocalFontPicker(),
    });
    void applyFontSourcesToAllPanes({
      host: restty,
      selectedFontFamily,
      selectedLocalFontMatcher,
      onError: (error) => {
        console.error("font source apply failed", error);
      },
    });
  });
}

if (btnLoadLocalFonts) {
  btnLoadLocalFonts.addEventListener("click", () => {
    void detectLocalFonts({
      fontFamilyLocalSelect,
      fontFamilyHintEl,
    });
  });
}

syncConnectionUi({
  connectionBackendEl,
  ptyUrlInput,
  wcCommandInput,
  wcCwdInput,
  connectionHintEl,
});
syncFontFamilyControls({
  fontFamilySelect,
  fontFamilyLocalSelect,
  btnLoadLocalFonts,
  selectedFontFamily,
  selectedLocalFontMatcher,
  supportsLocalFontPicker: supportsLocalFontPicker(),
});
syncHintingControls({
  ligaturesSelect,
  fontHintingSelect,
  fontHintTargetSelect,
  selectedLigatures,
  selectedFontHinting,
  selectedFontHintTarget,
});
if (supportsLocalFontPicker()) {
  if (fontFamilyHintEl) {
    fontFamilyHintEl.textContent =
      "Select a base font, then pick a local font from the local picker.";
  }
} else {
  if (fontFamilyHintEl) {
    fontFamilyHintEl.textContent = "Local font picker is not supported in this browser.";
  }
}

const firstPane = restty.createInitialPane({ focus: true });
activePaneId = firstPane.id;
const firstState = paneStates.get(firstPane.id);
if (firstState) {
  syncPtyButton(firstPane);
  renderActivePaneControls(firstPane, firstState);
}
queueResizeAllPanes();
