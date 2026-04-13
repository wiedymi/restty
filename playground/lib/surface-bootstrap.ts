import { Restty } from "../../src/index.ts";
import { createAdaptivePtyTransport } from "./pty-connection.ts";
import { createDemoController } from "./demos.ts";
import type { PlaygroundDesktopNotification } from "./desktop-notifications.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createConnectionController } from "./connection-controller.ts";
import type { createPaneLifecycleController } from "./pane-lifecycle.ts";
import { createPaneState, type PaneState } from "./pane-state.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";

type AnimationFrameHost = Pick<Window, "addEventListener" | "requestAnimationFrame">;

type BootstrapPlaygroundSurfaceOptions = {
  root: HTMLElement;
  target: AnimationFrameHost;
  initialFontSize: number;
  defaultThemeName: string;
  paneStates: Map<number, PaneState>;
  setActivePaneId: (id: number | null) => void;
  isSettingsDialogOpen: () => boolean;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
  connectionController: ReturnType<typeof createConnectionController>;
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  onDesktopNotification: (notification: PlaygroundDesktopNotification) => void;
};

export function bootstrapPlaygroundSurface({
  root,
  target,
  initialFontSize,
  defaultThemeName,
  paneStates,
  setActivePaneId,
  isSettingsDialogOpen,
  appearanceController,
  connectionController,
  paneLifecycle,
  paneShellSync,
  onDesktopNotification,
}: BootstrapPlaygroundSurfaceOptions) {
  let resizeRaf = 0;
  let restty!: Restty;

  const queueResizeAllPanes = () => {
    if (resizeRaf) return;
    resizeRaf = target.requestAnimationFrame(() => {
      resizeRaf = 0;
      for (const pane of restty.getPanes()) {
        pane.runtime.interaction.updateSize(true);
      }
    });
  };

  restty = new Restty({
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

          state.demos = createDemoController(pane.runtime);
          pane.runtime.interaction.setMouseMode(state.mouseMode);
          void paneLifecycle.initPane(pane, state);
        },
        onPaneClosed: (pane) => {
          const state = paneStates.get(pane.id);
          state?.demos?.stop();
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
          queueResizeAllPanes();
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
      ptyTransport: createAdaptivePtyTransport({
        getConnectionBackend: () => connectionController.getBackend(),
        getPtyUrl: () => connectionController.getConnectUrl(),
        getWebContainerCommand: () => connectionController.getWebContainerCommand(),
        getWebContainerCwd: () => connectionController.getWebContainerCwd(),
      }),
      callbacks: {},
    }),
  });

  appearanceController.applyCurrentShaderPreset();

  target.addEventListener("resize", () => {
    queueResizeAllPanes();
  });

  const firstPane = restty.createInitialPane({ focus: true });
  setActivePaneId(firstPane.id);
  const firstState = paneStates.get(firstPane.id);
  if (firstState) {
    paneShellSync.syncPtyButton(firstPane);
    paneShellSync.renderActivePaneControls(firstPane, firstState);
  }
  queueResizeAllPanes();

  return restty;
}
