import type { ResttyConfig } from "../../src/index.ts";
import { createAdaptivePtyTransport } from "./pty-connection.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createConnectionController } from "./connection-controller.ts";
import { createPaneState, type PaneState } from "./pane-state.ts";

type PlaygroundSurfaceRuntimeFactoriesOptions = {
  paneStates: Map<number, PaneState>;
  initialFontSize: number;
  defaultThemeName: string;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
  connectionController: ReturnType<typeof createConnectionController>;
  createPtyTransport?: typeof createAdaptivePtyTransport;
};

export function createPlaygroundSurfaceRuntimeFactories({
  paneStates,
  initialFontSize,
  defaultThemeName,
  appearanceController,
  connectionController,
  createPtyTransport = createAdaptivePtyTransport,
}: PlaygroundSurfaceRuntimeFactoriesOptions): Pick<ResttyConfig, "terminal" | "services"> {
  return {
    terminal: ({ id, sourcePane }) => {
      const paneState = createPaneState({
        id,
        sourceState: sourcePane ? (paneStates.get(sourcePane.id) ?? null) : null,
        renderer: appearanceController.getRendererDefault(),
        fontSize: Number.isFinite(appearanceController.getFontSizeDefault())
          ? appearanceController.getFontSizeDefault()
          : Number.isFinite(initialFontSize)
            ? initialFontSize
            : 18,
        mouseMode: appearanceController.getMouseModeDefault(),
        defaultThemeName,
      });
      paneStates.set(id, paneState);
      return {
        renderer: paneState.renderer,
        fontSize: paneState.fontSize,
        ligatures: appearanceController.getLigatures(),
        fontHinting: appearanceController.getFontHinting(),
        fontHintTarget: appearanceController.getFontHintTarget(),
        fontSizeMode: "em",
        alphaBlending: "native",
        fontSources: appearanceController.getFontSources(),
      };
    },
    services: () => ({
      ptyTransport: createPtyTransport({
        getConnectionBackend: () => connectionController.getBackend(),
        getPtyUrl: () => connectionController.getConnectUrl(),
        getWebContainerCommand: () => connectionController.getWebContainerCommand(),
        getWebContainerCwd: () => connectionController.getWebContainerCwd(),
      }),
      callbacks: {},
    }),
  };
}
