import type { ResttyPaneContextMenuOptions, ResttyPaneShortcutsOptions } from "../panes-types";
import { createDefaultResttyPaneContextMenuItems } from "./default-context-menu-items";
import type { CreateResttyAppPaneManagerOptions, ResttyManagedAppPane } from "./managed-pane-types";

export function defaultManagedPaneInputTargetPredicate(target: HTMLElement): boolean {
  return (
    target.classList.contains("pane-ime-input") ||
    target.classList.contains("restty-pane-ime-input")
  );
}

export function resolveManagedPaneContextMenu(
  options: Pick<CreateResttyAppPaneManagerOptions, "contextMenu" | "defaultContextMenu">,
): ResttyPaneContextMenuOptions<ResttyManagedAppPane> | null {
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

  return contextMenu;
}

export function resolveManagedPaneShortcuts(
  shortcuts: CreateResttyAppPaneManagerOptions["shortcuts"],
): boolean | ResttyPaneShortcutsOptions | undefined {
  if (shortcuts === undefined || shortcuts === true) {
    return {
      enabled: true,
      isAllowedInputTarget: defaultManagedPaneInputTargetPredicate,
    };
  }

  if (typeof shortcuts === "object" && !shortcuts.isAllowedInputTarget) {
    return {
      ...shortcuts,
      isAllowedInputTarget: defaultManagedPaneInputTargetPredicate,
    };
  }

  return shortcuts;
}
