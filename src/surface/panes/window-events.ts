import type { ResttyPaneShortcutsOptions, ResttyPaneSplitDirection } from "./types";

export function attachPaneManagerWindowEvents(options: {
  contextMenuController?: {
    isOpen: () => boolean;
    containsTarget: (target: EventTarget | null) => boolean;
  } | null;
  hideContextMenu: () => void;
  shortcutOptions: ResttyPaneShortcutsOptions;
  splitActivePane: (direction: ResttyPaneSplitDirection) => void;
}): () => void {
  const onWindowPointerDown = (event: PointerEvent) => {
    if (!options.contextMenuController?.isOpen()) return;
    if (options.contextMenuController.containsTarget(event.target)) return;
    options.hideContextMenu();
  };

  const onWindowBlur = () => {
    options.hideContextMenu();
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (options.contextMenuController?.isOpen() && event.key === "Escape") {
      options.hideContextMenu();
      return;
    }

    if (options.shortcutOptions.enabled === false) return;
    if (options.shortcutOptions.canHandleEvent && !options.shortcutOptions.canHandleEvent(event)) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
      const allowed = options.shortcutOptions.isAllowedInputTarget?.(target) ?? false;
      if (!allowed) return;
    }

    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const hasCommandModifier = isMac ? event.metaKey : event.ctrlKey;
    if (!hasCommandModifier || event.altKey || event.code !== "KeyD" || event.repeat) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    options.splitActivePane(event.shiftKey ? "horizontal" : "vertical");
  };

  window.addEventListener("pointerdown", onWindowPointerDown);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("keydown", onWindowKeyDown, { capture: true });

  return () => {
    window.removeEventListener("pointerdown", onWindowPointerDown);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("keydown", onWindowKeyDown, { capture: true });
  };
}
