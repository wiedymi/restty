import {
  Restty,
  listBuiltinThemeNames,
  getBuiltinTheme,
  parseGhosttyTheme,
  type GhosttyTheme,
  type ResttyFontSource,
  type ResttyShaderStage,
} from "../src/index.ts";
import { createDemoController, type PlaygroundDemoKind } from "./lib/demos.ts";
import {
  createAdaptivePtyTransport,
  getConnectUrl,
  getConnectionBackend,
  syncConnectionUi,
} from "./lib/pty-connection.ts";
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
const DEFAULT_FONT_FAMILY = "fira-code";
const FONT_FAMILY_LOCAL_PREFIX = "local:";
const FONT_URL_FIRA_CODE = "/playground/public/fonts/FiraCode-Regular.ttf";
const FONT_URL_JETBRAINS_MONO =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf";
const FONT_URL_JETBRAINS_MONO_BOLD =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Bold/JetBrainsMonoNLNerdFontMono-Bold.ttf";
const FONT_URL_JETBRAINS_MONO_ITALIC =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Italic/JetBrainsMonoNLNerdFontMono-Italic.ttf";
const FONT_URL_JETBRAINS_MONO_BOLD_ITALIC =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/BoldItalic/JetBrainsMonoNLNerdFontMono-BoldItalic.ttf";
const FONT_URL_NERD_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf";
const FONT_URL_NOTO_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf";
const FONT_URL_SYMBOLA = "https://cdn.jsdelivr.net/gh/ChiefMikeK/ttf-symbola@master/Symbola.ttf";
const FONT_URL_NOTO_CANADIAN_ABORIGINAL =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansCanadianAboriginal/NotoSansCanadianAboriginal-Regular.ttf";
const FONT_URL_NOTO_COLOR_EMOJI =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf";
const FONT_URL_OPENMOJI =
  "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf";
const FONT_URL_NOTO_CJK_SC =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf";

type ShaderPreset = "none" | "scanline" | "aurora" | "crt-lite" | "mono-green";
type FontHintTarget = "auto" | "light" | "normal";
type FontPresetKey = "fira-code" | "jetbrains";
type LocalFontVariant = {
  suffix: string;
  matchers: string[];
};
type FontPresetConfig = {
  localVariants: LocalFontVariant[];
  bundledFaces?: Array<{ label: string; url: string }>;
};

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;

const paneStates = new Map<number, PaneState>();
let activePaneId: number | null = null;
let resizeRaf = 0;
let restty: Restty;
let notificationPermissionRequest: Promise<NotificationPermission> | null = null;
let selectedShaderPreset = (shaderPresetEl?.value as ShaderPreset | undefined) ?? "none";

const FONT_PRESETS: Record<FontPresetKey, FontPresetConfig> = {
  "fira-code": {
    localVariants: [
      { suffix: "", matchers: ["fira code", "firacode", "fira code regular"] },
      { suffix: "bold", matchers: ["fira code bold", "firacode bold"] },
      { suffix: "italic", matchers: ["fira code italic", "firacode italic"] },
      {
        suffix: "bold italic",
        matchers: ["fira code bold italic", "firacode bold italic", "fira code retina"],
      },
    ],
    bundledFaces: [{ label: "Fira Code Regular", url: FONT_URL_FIRA_CODE }],
  },
  jetbrains: {
    localVariants: [
      {
        suffix: "",
        matchers: [
          "jetbrains mono nl nerd font mono regular",
          "jetbrains mono nl nerd font mono",
          "jetbrains mono nl",
          "jetbrains mono",
        ],
      },
      {
        suffix: "bold",
        matchers: [
          "jetbrains mono nl nerd font mono bold",
          "jetbrains mono nl bold",
          "jetbrains mono bold",
          "jetbrainsmono nerd font mono bold",
        ],
      },
      {
        suffix: "italic",
        matchers: [
          "jetbrains mono nl nerd font mono italic",
          "jetbrains mono nl italic",
          "jetbrains mono italic",
          "jetbrainsmono nerd font mono italic",
        ],
      },
      {
        suffix: "bold italic",
        matchers: [
          "jetbrains mono nl nerd font mono bold italic",
          "jetbrains mono nl bold italic",
          "jetbrains mono bold italic",
          "jetbrains mono nl italic bold",
          "jetbrains mono italic bold",
          "jetbrainsmono nerd font mono bold italic",
        ],
      },
    ],
  },
};

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
const resolveFontHintTarget = (value: string | null | undefined): FontHintTarget => {
  if (value === "light" || value === "normal" || value === "auto") return value;
  return "auto";
};
let selectedFontHintTarget = resolveFontHintTarget(searchParams?.get("hintTarget"));

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function supportsLocalFontPicker() {
  return typeof window !== "undefined" && "queryLocalFonts" in window;
}

function setFontFamilyHint(text: string) {
  if (fontFamilyHintEl) fontFamilyHintEl.textContent = text;
}

function createLocalFontSource(baseLabel: string, variant: LocalFontVariant): ResttyFontSource {
  return {
    type: "local",
    label: variant.suffix ? `local:${baseLabel} ${variant.suffix}` : `local:${baseLabel}`,
    matchers: variant.matchers,
  };
}

function buildFontSourcesForSelection(value: string, localMatcher: string): ResttyFontSource[] {
  const sources: ResttyFontSource[] = [];

  if (localMatcher) {
    sources.push({
      type: "local",
      label: `local:${localMatcher}`,
      matchers: [localMatcher],
      required: true,
    });
  }

  const preset = FONT_PRESETS[value as FontPresetKey];
  if (preset) {
    const baseLabel = value.replace("-", " ");
    for (const variant of preset.localVariants) {
      sources.push(createLocalFontSource(baseLabel, variant));
    }
    for (const face of preset.bundledFaces ?? []) {
      sources.push({
        type: "url",
        label: face.label,
        url: face.url,
      });
    }
  }

  sources.push({
    type: "url",
    label: "JetBrains Mono Regular",
    url: FONT_URL_JETBRAINS_MONO,
  });
  sources.push({
    type: "url",
    label: "JetBrains Mono Bold",
    url: FONT_URL_JETBRAINS_MONO_BOLD,
  });
  sources.push({
    type: "url",
    label: "JetBrains Mono Italic",
    url: FONT_URL_JETBRAINS_MONO_ITALIC,
  });
  sources.push({
    type: "url",
    label: "JetBrains Mono Bold Italic",
    url: FONT_URL_JETBRAINS_MONO_BOLD_ITALIC,
  });
  sources.push({
    type: "url",
    label: "Symbols Nerd Font Mono",
    url: FONT_URL_NERD_SYMBOLS,
  });
  sources.push({
    type: "local",
    label: "Apple Symbols",
    matchers: ["apple symbols", "applesymbols", "apple symbols regular"],
    required: true,
  });
  sources.push({
    type: "url",
    label: "Noto Sans Symbols 2",
    url: FONT_URL_NOTO_SYMBOLS,
  });
  sources.push({
    type: "url",
    label: "Symbola",
    url: FONT_URL_SYMBOLA,
  });
  sources.push({
    type: "local",
    label: "Noto Sans Canadian Aboriginal / Euphemia UCAS",
    matchers: [
      "noto sans canadian aboriginal",
      "notosanscanadianaboriginal",
      "euphemia ucas",
      "euphemiaucas",
    ],
  });
  sources.push({
    type: "url",
    label: "Noto Sans Canadian Aboriginal",
    url: FONT_URL_NOTO_CANADIAN_ABORIGINAL,
  });
  sources.push({
    type: "local",
    label: "Apple Color Emoji",
    matchers: ["apple color emoji", "applecoloremoji"],
    required: true,
  });
  sources.push({
    type: "url",
    label: "Noto Color Emoji",
    url: FONT_URL_NOTO_COLOR_EMOJI,
  });
  sources.push({
    type: "url",
    label: "OpenMoji",
    url: FONT_URL_OPENMOJI,
  });
  sources.push({
    type: "url",
    label: "Noto Sans CJK SC",
    url: FONT_URL_NOTO_CJK_SC,
  });

  return sources;
}

function getCurrentFontSources(): ResttyFontSource[] {
  return buildFontSourcesForSelection(selectedFontFamily, selectedLocalFontMatcher);
}

function syncFontFamilyControls() {
  if (fontFamilySelect) {
    fontFamilySelect.value = selectedFontFamily;
  }
  if (fontFamilyLocalSelect) {
    fontFamilyLocalSelect.value = selectedLocalFontMatcher
      ? `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(selectedLocalFontMatcher)}`
      : "";
  }
  if (!supportsLocalFontPicker() && btnLoadLocalFonts) {
    btnLoadLocalFonts.disabled = true;
  }
  if (!supportsLocalFontPicker() && fontFamilyLocalSelect) {
    fontFamilyLocalSelect.disabled = true;
  }
}

function syncHintingControls() {
  if (ligaturesSelect) {
    ligaturesSelect.value = selectedLigatures ? "on" : "off";
  }
  if (fontHintingSelect) {
    fontHintingSelect.value = selectedFontHinting ? "on" : "off";
  }
  if (fontHintTargetSelect) {
    fontHintTargetSelect.value = selectedFontHintTarget;
    fontHintTargetSelect.disabled = !selectedFontHinting;
  }
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

async function applyFontSourcesToAllPanes() {
  try {
    await restty.setFontSources(getCurrentFontSources());
  } catch (err: any) {
    console.error("font source apply failed", err);
  }
}

function applyFontRenderingOptionsToAllPanes() {
  const panes = restty.getPanes();
  for (let i = 0; i < panes.length; i += 1) {
    const pane = panes[i];
    pane.runtime.terminal.setLigatures(selectedLigatures);
    pane.runtime.terminal.setFontHintTarget(selectedFontHintTarget);
    pane.runtime.terminal.setFontHinting(selectedFontHinting);
  }
}

function upsertDetectedLocalFontOption(family: string) {
  if (!fontFamilyLocalSelect) return;
  const matcher = family.trim().toLowerCase();
  if (!matcher) return;
  const value = `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(matcher)}`;
  for (let i = 0; i < fontFamilyLocalSelect.options.length; i += 1) {
    if (fontFamilyLocalSelect.options[i]?.value === value) return;
  }
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `Local Font: ${family}`;
  option.dataset.localDetected = "1";
  fontFamilyLocalSelect.appendChild(option);
}

async function detectLocalFonts() {
  if (!supportsLocalFontPicker()) {
    setFontFamilyHint("Local font picker is not supported in this browser.");
    return;
  }
  try {
    if (fontFamilyLocalSelect) {
      for (let i = fontFamilyLocalSelect.options.length - 1; i >= 0; i -= 1) {
        if (fontFamilyLocalSelect.options[i]?.dataset.localDetected === "1") {
          fontFamilyLocalSelect.remove(i);
        }
      }
    }
    const fonts = await (window as any).queryLocalFonts();
    const seen = new Set<string>();
    let added = 0;
    for (let i = 0; i < fonts.length; i += 1) {
      const family = String(fonts[i]?.family ?? "").trim();
      if (!family) continue;
      const key = family.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      upsertDetectedLocalFontOption(family);
      added += 1;
    }
    if (fontFamilyLocalSelect) {
      fontFamilyLocalSelect.disabled = false;
    }
    setFontFamilyHint(`Detected ${added} local font families.`);
  } catch {
    setFontFamilyHint("Local font access denied or unavailable.");
  }
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

function isSettingsDialogOpen() {
  return Boolean(settingsDialog?.open);
}

function restoreTerminalFocus() {
  const pane = restty.getFocusedPane() ?? restty.getActivePane() ?? restty.getPanes()[0] ?? null;
  if (!pane) return;
  pane.canvas.focus({ preventScroll: true });
}

function openSettingsDialog() {
  restty.hideContextMenu();
  if (!settingsDialog || settingsDialog.open) return;
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
    return;
  }
  settingsDialog.setAttribute("open", "");
}

function closeSettingsDialog() {
  if (!settingsDialog || !settingsDialog.open) return;
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
  restoreTerminalFocus();
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
  syncFontFamilyControls();
  syncHintingControls();
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

function applySavedThemeForPane(pane: ManagedPane, state: PaneState) {
  if (state.theme.selectValue) {
    applyBuiltinThemeToPane(pane, state, state.theme.selectValue, state.theme.sourceLabel);
    return;
  }
  if (!state.theme.theme) return;
  applyThemeToPane(
    pane,
    state,
    state.theme.theme,
    state.theme.sourceLabel || "pane theme",
    state.theme.selectValue,
  );
}

async function initPaneApp(pane: ManagedPane, state: PaneState) {
  await pane.runtime.lifecycle.init();
  applySavedThemeForPane(pane, state);
  await waitForAnimationFrame();
  pane.runtime.interaction.updateSize(true);
  connectPaneIfNeeded(pane);
  if (pane.id === activePaneId) {
    syncPtyButton(pane);
  }
  pane.canvas.focus({ preventScroll: true });
}

function applyThemeToPane(
  pane: ManagedPane,
  state: PaneState,
  theme: GhosttyTheme,
  sourceLabel: string,
  selectValue = "",
): boolean {
  try {
    pane.runtime.terminal.applyTheme(theme, sourceLabel);
    state.theme = {
      selectValue,
      sourceLabel,
      theme,
    };
    if (pane.id === activePaneId && themeSelect) {
      themeSelect.value = selectValue;
    }
    return true;
  } catch (err) {
    console.error("theme apply failed", err);
    return false;
  }
}

function applyBuiltinThemeToPane(
  pane: ManagedPane,
  state: PaneState,
  name: string,
  sourceLabel = name,
): boolean {
  const theme = getBuiltinTheme(name);
  if (!theme) return false;
  return applyThemeToPane(pane, state, theme, sourceLabel, name);
}

function resetThemeForPane(pane: ManagedPane, state: PaneState) {
  pane.runtime.terminal.resetTheme();
  state.theme = {
    selectValue: "",
    sourceLabel: "",
    theme: null,
  };
  if (pane.id === activePaneId && themeSelect) {
    themeSelect.value = "";
  }
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
      fontSources: getCurrentFontSources(),
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
  openSettingsDialog();
});

settingsClose?.addEventListener("click", () => {
  closeSettingsDialog();
});

settingsDialog?.addEventListener("click", (event) => {
  if (event.target !== settingsDialog) return;
  closeSettingsDialog();
});

settingsDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSettingsDialog();
});

window.addEventListener(
  "keydown",
  (event) => {
    if (isSettingsDialogOpen() && event.key === "Escape") {
      event.preventDefault();
      closeSettingsDialog();
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
        if (applyThemeToPane(pane, state, theme, file.name || "theme file", "") && themeSelect) {
          themeSelect.value = "";
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
      resetThemeForPane(pane, state);
      return;
    }
    applyBuiltinThemeToPane(pane, state, name);
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
    syncHintingControls();
    applyFontRenderingOptionsToAllPanes();
  });
}

if (ligaturesSelect) {
  ligaturesSelect.addEventListener("change", () => {
    selectedLigatures = ligaturesSelect.value === "on";
    syncHintingControls();
    applyFontRenderingOptionsToAllPanes();
  });
}

if (fontHintTargetSelect) {
  fontHintTargetSelect.addEventListener("change", () => {
    selectedFontHintTarget = resolveFontHintTarget(fontHintTargetSelect.value);
    syncHintingControls();
    applyFontRenderingOptionsToAllPanes();
  });
}

if (fontFamilySelect) {
  fontFamilySelect.addEventListener("change", () => {
    selectedFontFamily = fontFamilySelect.value || DEFAULT_FONT_FAMILY;
    syncFontFamilyControls();
    void applyFontSourcesToAllPanes();
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
    syncFontFamilyControls();
    void applyFontSourcesToAllPanes();
  });
}

if (btnLoadLocalFonts) {
  btnLoadLocalFonts.addEventListener("click", () => {
    void detectLocalFonts();
  });
}

syncConnectionUi({
  connectionBackendEl,
  ptyUrlInput,
  wcCommandInput,
  wcCwdInput,
  connectionHintEl,
});
syncFontFamilyControls();
syncHintingControls();
if (supportsLocalFontPicker()) {
  setFontFamilyHint("Select a base font, then pick a local font from the local picker.");
} else {
  setFontFamilyHint("Local font picker is not supported in this browser.");
}

const firstPane = restty.createInitialPane({ focus: true });
activePaneId = firstPane.id;
const firstState = paneStates.get(firstPane.id);
if (firstState) {
  syncPtyButton(firstPane);
  renderActivePaneControls(firstPane, firstState);
}
queueResizeAllPanes();
