import {
  createDefaultResttyPaneContextMenuItems,
  createResttyPaneManager,
  type ResttyPaneContextMenuOptions,
  type ResttyPaneManager,
  type ResttyPaneShortcutsOptions,
  type ResttyPaneWithApp,
} from "./panes";
import { getDefaultResttyAppSession } from "./session";
import { createResttyApp } from "./index";
import type { ResttyAppOptions, ResttyAppSession } from "./types";

export type ResttyManagedAppPane = ResttyPaneWithApp & {
  canvas: HTMLCanvasElement;
  imeInput: HTMLTextAreaElement;
  termDebugEl: HTMLPreElement;
};

export type ResttyPaneDomDefaults = {
  paneClassName?: string;
  canvasClassName?: string;
  imeInputClassName?: string;
  termDebugClassName?: string;
};

export type ResttyPaneAppOptionsInput = Omit<ResttyAppOptions, "canvas" | "imeInput" | "session">;

export type ResttyDefaultPaneContextMenuOptions = {
  enabled?: boolean;
  canOpen?: (event: MouseEvent, pane: ResttyManagedAppPane) => boolean;
  modKeyLabel?: string;
  getPtyUrl?: () => string | null | undefined;
};

export type CreateResttyAppPaneManagerOptions = {
  root: HTMLElement;
  session?: ResttyAppSession;
  appOptions?:
    | ResttyPaneAppOptionsInput
    | ((context: {
        id: number;
        sourcePane: ResttyManagedAppPane | null;
        canvas: HTMLCanvasElement;
        imeInput: HTMLTextAreaElement;
        termDebugEl: HTMLPreElement;
      }) => ResttyPaneAppOptionsInput);
  paneDom?: ResttyPaneDomDefaults;
  autoInit?: boolean;
  minPaneSize?: number;
  shortcuts?: boolean | ResttyPaneShortcutsOptions;
  contextMenu?: ResttyPaneContextMenuOptions<ResttyManagedAppPane> | null;
  defaultContextMenu?: boolean | ResttyDefaultPaneContextMenuOptions;
  onPaneCreated?: (pane: ResttyManagedAppPane) => void;
  onPaneClosed?: (pane: ResttyManagedAppPane) => void;
  onPaneSplit?: (
    sourcePane: ResttyManagedAppPane,
    createdPane: ResttyManagedAppPane,
    direction: "vertical" | "horizontal",
  ) => void;
  onActivePaneChange?: (pane: ResttyManagedAppPane | null) => void;
  onLayoutChanged?: () => void;
};

function createImeInput(className: string): HTMLTextAreaElement {
  const imeInput = document.createElement("textarea");
  imeInput.className = className;
  imeInput.autocapitalize = "off";
  imeInput.autocomplete = "off";
  imeInput.autocorrect = "off";
  imeInput.spellcheck = false;
  imeInput.setAttribute("aria-hidden", "true");
  imeInput.style.position = "fixed";
  imeInput.style.left = "0";
  imeInput.style.top = "0";
  imeInput.style.width = "1px";
  imeInput.style.height = "1px";
  imeInput.style.opacity = "0";
  imeInput.style.pointerEvents = "none";
  return imeInput;
}

function defaultInputTargetPredicate(target: HTMLElement): boolean {
  return (
    target.classList.contains("pane-ime-input") ||
    target.classList.contains("restty-pane-ime-input")
  );
}

export function createResttyAppPaneManager(
  options: CreateResttyAppPaneManagerOptions,
): ResttyPaneManager<ResttyManagedAppPane> {
  const session = options.session ?? getDefaultResttyAppSession();
  const autoInit = options.autoInit ?? true;

  const paneClassName = options.paneDom?.paneClassName ?? "pane";
  const canvasClassName = options.paneDom?.canvasClassName ?? "pane-canvas";
  const imeInputClassName =
    options.paneDom?.imeInputClassName ?? "pane-ime-input restty-pane-ime-input";
  const termDebugClassName = options.paneDom?.termDebugClassName ?? "pane-term-debug";

  let contextMenu = options.contextMenu ?? null;
  if (!contextMenu) {
    const defaultMenuConfig = options.defaultContextMenu;
    const enabled =
      defaultMenuConfig === undefined
        ? true
        : typeof defaultMenuConfig === "boolean"
          ? defaultMenuConfig
          : (defaultMenuConfig.enabled ?? true);

    if (enabled) {
      const config =
        typeof defaultMenuConfig === "object" && defaultMenuConfig ? defaultMenuConfig : undefined;
      contextMenu = {
        canOpen: config?.canOpen,
        getItems: (pane, manager) =>
          createDefaultResttyPaneContextMenuItems({
            pane,
            manager,
            modKeyLabel: config?.modKeyLabel,
            getPtyUrl: config?.getPtyUrl,
          }),
      };
    }
  }

  let shortcuts = options.shortcuts;
  if (shortcuts === undefined || shortcuts === true) {
    shortcuts = {
      enabled: true,
      isAllowedInputTarget: defaultInputTargetPredicate,
    };
  } else if (typeof shortcuts === "object" && !shortcuts.isAllowedInputTarget) {
    shortcuts = {
      ...shortcuts,
      isAllowedInputTarget: defaultInputTargetPredicate,
    };
  }

  let managerRef: ResttyPaneManager<ResttyManagedAppPane> | null = null;

  const manager = createResttyPaneManager<ResttyManagedAppPane>({
    root: options.root,
    minPaneSize: options.minPaneSize,
    shortcuts,
    contextMenu,
    createPane: ({ id, sourcePane }) => {
      const container = document.createElement("div");
      container.className = paneClassName;

      const canvas = document.createElement("canvas");
      canvas.className = canvasClassName;
      canvas.tabIndex = 0;

      const imeInput = createImeInput(imeInputClassName);

      const termDebugEl = document.createElement("pre");
      termDebugEl.className = termDebugClassName;
      termDebugEl.setAttribute("aria-live", "polite");

      container.append(canvas, imeInput, termDebugEl);

      const baseOptions =
        typeof options.appOptions === "function"
          ? options.appOptions({ id, sourcePane, canvas, imeInput, termDebugEl })
          : (options.appOptions ?? {});

      const mergedElements = {
        ...baseOptions.elements,
        termDebugEl: baseOptions.elements?.termDebugEl ?? termDebugEl,
      };

      const app = createResttyApp({
        ...baseOptions,
        canvas,
        imeInput,
        session,
        elements: mergedElements,
      });

      if (autoInit) {
        void app.init();
      }

      return {
        id,
        container,
        focusTarget: canvas,
        app,
        canvas,
        imeInput,
        termDebugEl,
      };
    },
    destroyPane: (pane) => {
      pane.app.destroy();
    },
    onPaneCreated: options.onPaneCreated,
    onPaneClosed: options.onPaneClosed,
    onPaneSplit: options.onPaneSplit,
    onActivePaneChange: options.onActivePaneChange,
    onLayoutChanged: () => {
      if (managerRef) {
        for (const pane of managerRef.getPanes()) {
          pane.app.updateSize(true);
        }
      }
      options.onLayoutChanged?.();
    },
  });

  managerRef = manager;
  return manager;
}
