import { startTransition, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  getBuiltinTheme,
  listBuiltinThemeNames,
  Restty,
  type ResttyFontHintTarget,
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

function applyTheme(restty: Restty, themeName: string) {
  const theme = getBuiltinTheme(themeName);
  if (!theme) return;
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
    applyTheme(restty, optionsRef.current.themeName);
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
    if (restty) applyTheme(restty, themeName);
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
    requestAnimationFrame(() => connectPane(resttyRef.current?.pane(created.id) ?? null, optionsRef.current));
  };

  return (
    <section className="playground-layout" aria-label="restty playground">
      <div className="terminal-stage">
        <div ref={rootRef} className="restty-root" />
      </div>

      <aside className="playground-panel" aria-label="Playground controls">
        <div className="panel-header">
          <p className="panel-title">restty playground</p>
          <p className="panel-subtitle">
            Public API consumer with Just Bash by default, plus WebContainer and OS PTY options.
          </p>
        </div>

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
              <button className="action-button" type="button" onClick={() => disconnectPane(activePane())}>
                Disconnect
              </button>
              <button className="action-button" type="button" onClick={() => activePane()?.clearScreen()}>
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
              <button className="action-button" type="button" onClick={() => activePane()?.togglePause()}>
                Pause
              </button>
              <button className="action-button" type="button" onClick={() => activePane()?.toggleSearch()}>
                Search
              </button>
              <button className="action-button" type="button" onClick={() => splitPane("vertical")}>
                Split Right
              </button>
              <button className="action-button" type="button" onClick={() => splitPane("horizontal")}>
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
                onChange={(event) => void applyFonts({ fontPreset: event.currentTarget.value as FontPresetId })}
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
                onChange={(event) => void applyFonts({ localFontFamily: event.currentTarget.value })}
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
