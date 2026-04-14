import { Restty } from "../../src/index.ts";
import { createDemoController } from "./demos.ts";
import type { PlaygroundDesktopNotification } from "./desktop-notifications.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createConnectionController } from "./connection-controller.ts";
import type { createPaneLifecycleController } from "./pane-lifecycle.ts";
import type { PaneState } from "./pane-state.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";
import { createPlaygroundSurfaceEvents } from "./surface-bootstrap-events.ts";
import { createPlaygroundSurfaceRuntimeFactories } from "./surface-bootstrap-runtime.ts";

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
  createPtyTransport?: Parameters<
    typeof createPlaygroundSurfaceRuntimeFactories
  >[0]["createPtyTransport"];
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
  createDemoController: createDemoControllerForPane = createDemoController,
  createPtyTransport,
}: CreatePlaygroundSurfaceAssemblyOptions): Restty {
  const surfaceEvents = createPlaygroundSurfaceEvents({
    paneStates,
    setActivePaneId,
    paneShellSync,
    paneLifecycle,
    queueResizeAllPanes: surfaceStartup.queueResizeAllPanes,
    onDesktopNotification,
    createDemoController: createDemoControllerForPane,
  });
  const runtimeFactories = createPlaygroundSurfaceRuntimeFactories({
    paneStates,
    initialFontSize,
    defaultThemeName,
    appearanceController,
    connectionController,
    createPtyTransport,
  });

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
      events: surfaceEvents,
      defaultContextMenu: {
        canOpen: () => !isSettingsDialogOpen(),
        getPtyUrl: () => connectionController.getConnectUrl(),
      },
      shortcuts: {
        enabled: true,
        canHandleEvent: () => !isSettingsDialogOpen(),
      },
    },
    ...runtimeFactories,
  });
}
