import { Restty } from "../../src/index.ts";
import { createAdaptivePtyTransport } from "./pty-connection.ts";
import { createDemoController, stopPaneDemo } from "./demos.ts";
import type { PlaygroundDesktopNotification } from "./desktop-notifications.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createConnectionController } from "./connection-controller.ts";
import type { createPaneLifecycleController } from "./pane-lifecycle.ts";
import { createPaneState, type PaneState } from "./pane-state.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";

export type PlaygroundSurfaceStartupConfig = {
  initialFontSize: number;
  defaultThemeName: string;
};

export type PlaygroundSurfaceState = {
  paneStates: Map<number, PaneState>;
  setActivePaneId: (id: number | null) => void;
};

export type PlaygroundSurfaceShell = {
  isSettingsDialogOpen: () => boolean;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
};

export type PlaygroundSurfaceControllers = {
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
  connectionController: ReturnType<typeof createConnectionController>;
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
};

type PlaygroundSurfaceStartupBridge = {
  queueResizeAllPanes: () => void;
};

export type CreatePlaygroundSurfaceAssemblyOptions = {
  root: HTMLElement;
  startup: PlaygroundSurfaceStartupConfig;
  state: PlaygroundSurfaceState;
  shell: PlaygroundSurfaceShell;
  controllers: PlaygroundSurfaceControllers;
  onDesktopNotification: (notification: PlaygroundDesktopNotification) => void;
  surfaceStartup: PlaygroundSurfaceStartupBridge;
  createRestty?: (config: ConstructorParameters<typeof Restty>[0]) => Restty;
  createPtyTransport?: typeof createAdaptivePtyTransport;
  createDemoController?: typeof createDemoController;
};

export function assemblePlaygroundSurface({
  root,
  startup: { initialFontSize, defaultThemeName },
  state: { paneStates, setActivePaneId },
  shell: { isSettingsDialogOpen, paneShellSync },
  controllers: { appearanceController, connectionController, paneLifecycle },
  onDesktopNotification,
  surfaceStartup,
  createRestty = (config) => new Restty(config),
  createPtyTransport = createAdaptivePtyTransport,
  createDemoController: createDemoControllerForPane = createDemoController,
}: CreatePlaygroundSurfaceAssemblyOptions): Restty {
  return createRestty({
    root,
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
            paneLifecycle.setPanePaused(pane.id, value);
          };

          state.demos = createDemoControllerForPane(pane.runtime);
          pane.runtime.interaction.setMouseMode(state.mouseMode);
          void paneLifecycle.initPane(pane, state);
        },
        onPaneClosed: (pane) => {
          const state = paneStates.get(pane.id);
          stopPaneDemo(state);
          paneStates.delete(pane.id);
        },
        onActivePaneChange: (pane) => {
          setActivePaneId(pane?.id ?? null);
          if (!pane) return;
          const state = paneStates.get(pane.id);
          if (!state) return;
          paneShellSync.syncPtyButton(pane);
          paneShellSync.renderActivePaneControls(pane, state);
        },
        onLayoutChanged: () => {
          surfaceStartup.queueResizeAllPanes();
        },
        onDesktopNotification,
      },
      defaultContextMenu: {
        canOpen: () => !isSettingsDialogOpen(),
        getPtyUrl: () => connectionController.getConnectUrl(),
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
  });
}
