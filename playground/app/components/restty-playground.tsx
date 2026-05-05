import { startTransition, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  getBuiltinTheme,
  listBuiltinThemeNames,
  Restty,
  type ResttyFontHintTarget,
  type GhosttyTheme,
  type ResttyPaneApi,
} from "../../../src/index.ts";
import {
  createAdaptivePtyTransport,
} from "../lib/pty/adaptive-transport.ts";
import {
  DEFAULT_CONNECTION_BACKEND,
  DEFAULT_PTY_URL,
  DEFAULT_WEB_CONTAINER_COMMAND,
  DEFAULT_WEB_CONTAINER_CWD,
  getConnectUrl,
  type PlaygroundConnectionBackend,
} from "../lib/pty/types.ts";
import {
  buildFontsForPreset,
  DEFAULT_FONT_HINT_TARGET,
  DEFAULT_FONT_HINTING,
  DEFAULT_FONT_PRESET,
  DEFAULT_FONT_SIZE,
  DEFAULT_LIGATURES,
  FONT_PRESETS,
  type FontPresetId,
} from "../lib/restty/fonts.ts";
import { createDemoController, type PlaygroundDemoKind } from "../lib/restty/demos.ts";
import {
  SHADER_PRESETS,
  shaderStagesForPreset,
  type ShaderPreset,
} from "../lib/restty/shader-presets.ts";

type RendererMode = "auto" | "webgpu" | "webgl2";

type PlaygroundOptions = {
  backend: PlaygroundConnectionBackend;
  ptyUrl: string;
  webContainerCommand: string;
  webContainerCwd: string;
  renderer: RendererMode;
  fontSize: number;
  fontPreset: FontPresetId;
  localFontFamily: string;
  ligatures: boolean;
  fontHinting: boolean;
  fontHintTarget: ResttyFontHintTarget;
  themeName: string;
  shaderPreset: ShaderPreset;
};

const themeNames = listBuiltinThemeNames();
const defaultThemeName =
  themeNames.find((name) => name === "Aizen Dark") ?? themeNames[0] ?? "Default";

const DEFAULT_OPTIONS: PlaygroundOptions = {
  backend: DEFAULT_CONNECTION_BACKEND,
  ptyUrl: DEFAULT_PTY_URL,
  webContainerCommand: DEFAULT_WEB_CONTAINER_COMMAND,
  webContainerCwd: DEFAULT_WEB_CONTAINER_CWD,
  renderer: "auto",
  fontSize: DEFAULT_FONT_SIZE,
  fontPreset: DEFAULT_FONT_PRESET,
  localFontFamily: "",
  ligatures: DEFAULT_LIGATURES,
  fontHinting: DEFAULT_FONT_HINTING,
  fontHintTarget: DEFAULT_FONT_HINT_TARGET,
  themeName: defaultThemeName,
  shaderPreset: "none",
};

function updateOptionsRef(
  ref: MutableRefObject<PlaygroundOptions>,
  patch: Partial<PlaygroundOptions>,
) {
  ref.current = {
    ...ref.current,
    ...patch,
  };
}

function resolveTheme(themeName: string) {
  return getBuiltinTheme(themeName);
}

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

function themeColorToCss(
  color: NonNullable<GhosttyTheme["colors"]["background"]>,
): string {
  const r = clampColorChannel(color.r);
  const g = clampColorChannel(color.g);
  const b = clampColorChannel(color.b);
  const alpha = color.a === undefined ? 1 : clampColorChannel(color.a) / 255;

  if (alpha >= 1) {
    return `rgb(${r} ${g} ${b})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
}

function themeBackgroundCss(theme: GhosttyTheme): string | null {
  const background = theme.colors.background;
  return background ? themeColorToCss(background) : null;
}

function setPlaygroundBackground(root: HTMLElement | null, background: string) {
  root?.style.setProperty("--playground-terminal-background", background);
  root?.ownerDocument.documentElement.style.setProperty(
    "--playground-terminal-background",
    background,
  );
}

function clearPlaygroundBackground(root: HTMLElement | null) {
  root?.style.removeProperty("--playground-terminal-background");
  root?.ownerDocument.documentElement.style.removeProperty("--playground-terminal-background");
}

function applyTheme(restty: Restty, themeName: string, root: HTMLElement | null = null) {
  const theme = resolveTheme(themeName);
  if (!theme) return;

  const background = themeBackgroundCss(theme);
  if (background) {
    setPlaygroundBackground(root, background);
    restty.setPaneStyleOptions({
      splitBackground: background,
      paneBackground: background,
    });
  }

  restty.forEachPane((pane) => pane.applyTheme(theme, themeName));
}

function applyTerminalOptions(restty: Restty, options: PlaygroundOptions) {
  restty.forEachPane((pane) => {
    pane.setRenderer(options.renderer);
    pane.setFontSize(options.fontSize);
    pane.setLigatures(options.ligatures);
    pane.setFontHinting(options.fontHinting);
    pane.setFontHintTarget(options.fontHintTarget);
    pane.setShaderStages(shaderStagesForPreset(options.shaderPreset));
  });
}

function connectPane(pane: ResttyPaneApi | null, options: PlaygroundOptions) {
  if (!pane) return;
  pane.connectPty(getConnectUrl(options.backend, options.ptyUrl));
}

function disconnectPane(pane: ResttyPaneApi | null) {
  if (!pane) return;
  pane.disconnectPty();
}

export function ResttyPlayground() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const resttyRef = useRef<Restty | null>(null);
  const optionsRef = useRef<PlaygroundOptions>(DEFAULT_OPTIONS);
  const demoControllersRef = useRef(new Map<number, ReturnType<typeof createDemoController>>());
  const [options, setOptions] = useState<PlaygroundOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState("idle");
  const [paneIds, setPaneIds] = useState<number[]>([]);
  const [activePaneId, setActivePaneId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const syncPanes = () => {
    const restty = resttyRef.current;
    if (!restty) return;
    startTransition(() => {
      setPaneIds(restty.panes().map((pane) => pane.id));
      setActivePaneId(restty.activePane()?.id ?? null);
    });
  };

  const setupPane = (id: number) => {
    const restty = resttyRef.current;
    const pane = restty?.pane(id);
    if (!restty || !pane) return;
    demoControllersRef.current.set(id, createDemoController(pane));
    applyTerminalOptions(restty, optionsRef.current);
    applyTheme(restty, optionsRef.current.themeName, rootRef.current);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const restty = new Restty({
      root,
      surface: {
        createInitialPane: false,
        shortcuts: true,
        paneStyles: true,
        searchUi: true,
        defaultContextMenu: {
          getPtyUrl: () =>
            getConnectUrl(optionsRef.current.backend, optionsRef.current.ptyUrl),
        },
        events: {
          onPaneCreated: (pane) => {
            queueMicrotask(() => {
              setupPane(pane.id);
              syncPanes();
            });
          },
          onPaneClosed: (pane) => {
            demoControllersRef.current.get(pane.id)?.stop();
            demoControllersRef.current.delete(pane.id);
            syncPanes();
          },
          onActivePaneChange: (pane) => {
            startTransition(() => setActivePaneId(pane?.id ?? null));
          },
        },
      },
      terminal: () => ({
        renderer: optionsRef.current.renderer,
        fontSize: optionsRef.current.fontSize,
        ligatures: optionsRef.current.ligatures,
        fontHinting: optionsRef.current.fontHinting,
        fontHintTarget: optionsRef.current.fontHintTarget,
        theme: resolveTheme(optionsRef.current.themeName) ?? undefined,
        fonts: buildFontsForPreset(
          optionsRef.current.fontPreset,
          optionsRef.current.localFontFamily,
        ),
        shaderStages: shaderStagesForPreset(optionsRef.current.shaderPreset),
        alphaBlending: "native",
        autoResize: true,
      }),
      services: () => ({
        ptyTransport: createAdaptivePtyTransport({
          getConnectionBackend: () => optionsRef.current.backend,
          getPtyUrl: () => optionsRef.current.ptyUrl,
          getWebContainerCommand: () => optionsRef.current.webContainerCommand,
          getWebContainerCwd: () => optionsRef.current.webContainerCwd,
          onStatusChange: (nextStatus) => startTransition(() => setStatus(nextStatus)),
        }),
      }),
    });

    resttyRef.current = restty;
    applyTheme(restty, optionsRef.current.themeName, root);
    const initialPane = restty.createInitialPane({ focus: true });
    setupPane(initialPane.id);
    syncPanes();
    requestAnimationFrame(() => connectPane(restty.activePane(), optionsRef.current));

    const resize = () => {
      restty.forEachPane((pane) => pane.updateSize(true));
    };
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      for (const controller of demoControllersRef.current.values()) {
        controller.stop();
      }
      demoControllersRef.current.clear();
      clearPlaygroundBackground(root);
      restty.destroy();
      resttyRef.current = null;
    };
  }, []);

  const updateOptions = (patch: Partial<PlaygroundOptions>) => {
    updateOptionsRef(optionsRef, patch);
    setOptions(optionsRef.current);
  };

  const applyFonts = async (patch: Partial<PlaygroundOptions>) => {
    updateOptions(patch);
    const restty = resttyRef.current;
    if (!restty) return;
    await restty.setFonts(
      buildFontsForPreset(optionsRef.current.fontPreset, optionsRef.current.localFontFamily),
    );
  };

  const applyRenderer = (renderer: RendererMode) => {
    updateOptions({ renderer });
    resttyRef.current?.forEachPane((pane) => pane.setRenderer(renderer));
  };

  const applyFontSize = (fontSize: number) => {
    updateOptions({ fontSize });
    resttyRef.current?.forEachPane((pane) => pane.setFontSize(fontSize));
  };

  const applyLigatures = (ligatures: boolean) => {
    updateOptions({ ligatures });
    resttyRef.current?.forEachPane((pane) => pane.setLigatures(ligatures));
  };

  const applyFontHinting = (fontHinting: boolean) => {
    updateOptions({ fontHinting });
    resttyRef.current?.forEachPane((pane) => pane.setFontHinting(fontHinting));
  };

  const applyFontHintTarget = (fontHintTarget: ResttyFontHintTarget) => {
    updateOptions({ fontHintTarget });
    resttyRef.current?.forEachPane((pane) => pane.setFontHintTarget(fontHintTarget));
  };

  const applyThemeName = (themeName: string) => {
    updateOptions({ themeName });
    const restty = resttyRef.current;
    if (restty) applyTheme(restty, themeName, rootRef.current);
  };

  const applyShaderPreset = (shaderPreset: ShaderPreset) => {
    updateOptions({ shaderPreset });
    resttyRef.current?.setShaderStages(shaderStagesForPreset(shaderPreset));
  };

  const activePane = () => resttyRef.current?.activePane() ?? null;

  const reconnect = () => {
    const pane = activePane();
    disconnectPane(pane);
    connectPane(pane, optionsRef.current);
  };

  const runDemo = (kind: PlaygroundDemoKind) => {
    const pane = activePane();
    if (!pane) return;
    demoControllersRef.current.get(pane.id)?.run(kind);
  };

  const splitPane = (direction: "vertical" | "horizontal") => {
    const created = resttyRef.current?.splitActivePane(direction);
    if (!created) return;
    setupPane(created.id);
    syncPanes();
    requestAnimationFrame(() =>
      connectPane(resttyRef.current?.pane(created.id) ?? null, optionsRef.current),
    );
  };

  return (
    <section className="playground-screen" aria-label="restty playground">
      <div ref={rootRef} className="restty-root" />

      <div className="settings-fab-stack" aria-label="Playground links and settings">
        <a
          className="settings-fab settings-fab-social settings-fab-text"
          href="/docs"
          title="Docs"
        >
          docs
        </a>
        <a
          className="settings-fab settings-fab-social"
          href="https://github.com/wiedymi/restty"
          title="GitHub"
        >
          <svg className="settings-fab-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.69c-2.78.6-3.37-1.18-3.37-1.18-.46-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.64.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.02c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
            />
          </svg>
        </a>
        <a
          className="settings-fab settings-fab-social settings-fab-text"
          href="https://www.npmjs.com/package/restty"
          title="npm"
        >
          npm
        </a>
        <button
          className="settings-fab"
          type="button"
          aria-expanded={settingsOpen}
          aria-controls="playground-settings"
          title="Settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <svg className="settings-fab-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.27 7.27 0 0 0-1.69-.98L14.5 2.42A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.5.42L9.12 5.07c-.61.24-1.18.56-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65a7.93 7.93 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.13.22.39.31.61.22l2.49-1c.51.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.24 1.18-.56 1.69-.98l2.49 1c.23.08.48 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.12-1.65ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
            />
          </svg>
        </button>
      </div>

      {settingsOpen ? (
        <button
          className="settings-scrim"
          type="button"
          aria-label="Close settings"
          onClick={() => setSettingsOpen(false)}
        />
      ) : null}

      <aside
        id="playground-settings"
        className={`settings-dialog${settingsOpen ? " open" : ""}`}
        aria-label="Playground settings"
        aria-hidden={!settingsOpen}
      >
        <header className="settings-header">
          <div>
            <p className="panel-eyebrow">restty</p>
            <p className="panel-title">Settings</p>
          </div>
          <button
            className="float-button icon"
            type="button"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            X
          </button>
        </header>

        <div className="panel-scroll">
          <section className="control-card">
            <h2>Connection</h2>
            <div className="field">
              <label htmlFor="backend">Backend</label>
              <select
                id="backend"
                value={options.backend}
                onChange={(event) =>
                  updateOptions({
                    backend: event.currentTarget.value as PlaygroundConnectionBackend,
                  })
                }
              >
                <option value="just-bash">Just Bash</option>
                <option value="webcontainer">WebContainer</option>
                <option value="ws">OS PTY websocket</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ptyUrl">PTY websocket URL</label>
              <input
                id="ptyUrl"
                value={options.ptyUrl}
                disabled={options.backend !== "ws"}
                onChange={(event) => updateOptions({ ptyUrl: event.currentTarget.value })}
              />
            </div>
            <div className="inline-grid">
              <div className="inline-field">
                <label htmlFor="webContainerCommand">WebContainer command</label>
                <input
                  id="webContainerCommand"
                  value={options.webContainerCommand}
                  disabled={options.backend !== "webcontainer"}
                  onChange={(event) =>
                    updateOptions({ webContainerCommand: event.currentTarget.value })
                  }
                />
              </div>
              <div className="inline-field">
                <label htmlFor="webContainerCwd">cwd</label>
                <input
                  id="webContainerCwd"
                  value={options.webContainerCwd}
                  disabled={options.backend !== "webcontainer"}
                  onChange={(event) => updateOptions({ webContainerCwd: event.currentTarget.value })}
                />
              </div>
            </div>
            <div className="button-row">
              <button className="action-button primary" type="button" onClick={reconnect}>
                Connect
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => disconnectPane(activePane())}
              >
                Disconnect
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => activePane()?.clearScreen()}
              >
                Clear
              </button>
            </div>
            <p className="status-line">
              Status: <strong>{status}</strong>
            </p>
          </section>

          <section className="control-card">
            <h2>Terminal</h2>
            <div className="inline-grid">
              <div className="inline-field">
                <label htmlFor="renderer">Renderer</label>
                <select
                  id="renderer"
                  value={options.renderer}
                  onChange={(event) => applyRenderer(event.currentTarget.value as RendererMode)}
                >
                  <option value="auto">Auto</option>
                  <option value="webgpu">WebGPU</option>
                  <option value="webgl2">WebGL2</option>
                </select>
              </div>
              <div className="inline-field">
                <label htmlFor="fontSize">Font size</label>
                <input
                  id="fontSize"
                  type="number"
                  min="10"
                  max="32"
                  value={options.fontSize}
                  onChange={(event) => applyFontSize(Number(event.currentTarget.value) || 18)}
                />
              </div>
            </div>
            <div className="button-row">
              <button
                className="action-button"
                type="button"
                onClick={() => activePane()?.togglePause()}
              >
                Pause
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => activePane()?.toggleSearch()}
              >
                Search
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => splitPane("vertical")}
              >
                Split Right
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => splitPane("horizontal")}
              >
                Split Down
              </button>
              <button
                className="action-button"
                type="button"
                onClick={() => {
                  const id = activePaneId;
                  if (id !== null) resttyRef.current?.closePane(id);
                  syncPanes();
                }}
              >
                Close Pane
              </button>
            </div>
            <p className="status-line">
              Active pane: <strong>{activePaneId ?? "none"}</strong> · Panes:{" "}
              <strong>{paneIds.join(", ") || "none"}</strong>
            </p>
          </section>

          <section className="control-card">
            <h2>Fonts</h2>
            <div className="field">
              <label htmlFor="fontPreset">Bundled preset</label>
              <select
                id="fontPreset"
                value={options.fontPreset}
                onChange={(event) =>
                  void applyFonts({
                    fontPreset: event.currentTarget.value as FontPresetId,
                  })
                }
              >
                {FONT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="localFontFamily">Optional local family</label>
              <input
                id="localFontFamily"
                placeholder="e.g. Berkeley Mono"
                value={options.localFontFamily}
                onChange={(event) =>
                  void applyFonts({ localFontFamily: event.currentTarget.value })
                }
              />
            </div>
            <div className="inline-grid">
              <div className="inline-field">
                <label htmlFor="fontHintTarget">Hint target</label>
                <select
                  id="fontHintTarget"
                  value={options.fontHintTarget}
                  onChange={(event) =>
                    applyFontHintTarget(event.currentTarget.value as ResttyFontHintTarget)
                  }
                >
                  <option value="auto">Auto</option>
                  <option value="light">Light</option>
                  <option value="normal">Normal</option>
                </select>
              </div>
              <div className="inline-field">
                <label htmlFor="fontHinting">Hinting</label>
                <select
                  id="fontHinting"
                  value={options.fontHinting ? "on" : "off"}
                  onChange={(event) => applyFontHinting(event.currentTarget.value === "on")}
                >
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </select>
              </div>
            </div>
            <div className="button-row">
              <button
                className="action-button"
                type="button"
                onClick={() => applyLigatures(!options.ligatures)}
              >
                Ligatures: {options.ligatures ? "On" : "Off"}
              </button>
            </div>
          </section>

          <section className="control-card">
            <h2>Appearance</h2>
            <div className="field">
              <label htmlFor="theme">Theme</label>
              <select
                id="theme"
                value={options.themeName}
                onChange={(event) => applyThemeName(event.currentTarget.value)}
              >
                {themeNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="shader">Shader preset</label>
              <select
                id="shader"
                value={options.shaderPreset}
                onChange={(event) => applyShaderPreset(event.currentTarget.value as ShaderPreset)}
              >
                {SHADER_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="control-card">
            <h2>Demos</h2>
            <div className="button-row">
              <button className="action-button" type="button" onClick={() => runDemo("basic")}>
                Basics
              </button>
              <button className="action-button" type="button" onClick={() => runDemo("palette")}>
                Palette
              </button>
              <button className="action-button" type="button" onClick={() => runDemo("unicode")}>
                Unicode
              </button>
              <button className="action-button" type="button" onClick={() => runDemo("anim")}>
                Animation
              </button>
            </div>
          </section>
        </div>
      </aside>
    </section>
  );
}
