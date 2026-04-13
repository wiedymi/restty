import type { ResttySearchState } from "../../runtime/types";
import {
  applySearchUiStyleOptions,
  clearSearchUiStyleOptions,
  ensurePaneSearchUiStyles,
  normalizeSearchUiStyleOptions,
} from "./styles";
import type {
  CreatePaneSearchUiControllerOptions,
  PaneSearchUiController,
  PaneSearchUiState,
  ResttyPaneSearchUiCloseOptions,
  ResttyPaneSearchUiOpenOptions,
  ResttyPaneSearchUiShortcutOptions,
} from "./types";

function defaultStatusFormatter(state: ResttySearchState): string {
  if (!state.query) return "";
  if (state.pending) return "…";
  if (state.total <= 0) return "0";
  if (state.selectedIndex !== null) {
    return `${state.selectedIndex + 1}/${state.total}`;
  }
  return `${state.total}`;
}

function isNodeWithinRoot(root: HTMLElement, target: EventTarget | null): boolean {
  return target instanceof Node && root.contains(target);
}

export function createPaneSearchUiController(
  options: CreatePaneSearchUiControllerOptions,
): PaneSearchUiController {
  const enabled = options.enabled ?? true;
  const paneStates = new Map<number, PaneSearchUiState>();
  const ownerDoc = options.root.ownerDocument ?? document;
  const ownerWin = ownerDoc.defaultView ?? window;
  let styleOptions = normalizeSearchUiStyleOptions(options.styles);

  const shortcutOptions: ResttyPaneSearchUiShortcutOptions =
    typeof options.shortcut === "object"
      ? options.shortcut
      : { enabled: options.shortcut !== false };
  const statusFormatter = options.statusFormatter ?? defaultStatusFormatter;
  const placeholder = options.placeholder ?? "Find in scrollback";
  const previousButtonText = options.previousButtonText ?? "↑";
  const nextButtonText = options.nextButtonText ?? "↓";
  const clearButtonText = options.clearButtonText ?? "Clear";
  const closeButtonText = options.closeButtonText ?? "×";

  if (enabled) {
    ensurePaneSearchUiStyles(ownerDoc);
    applySearchUiStyleOptions(options.root, styleOptions);
  }

  function getOpenPaneId(): number | null {
    for (const [paneId, state] of paneStates) {
      if (state.open) return paneId;
    }
    return null;
  }

  function syncPaneUi(paneState: PaneSearchUiState): void {
    const { input, prevButton, nextButton, clearButton, root, status, state } = paneState;
    if (ownerDoc.activeElement !== input) {
      input.value = state.query;
    }
    const hasMatches = state.active && state.total > 0;
    prevButton.disabled = !hasMatches;
    nextButton.disabled = !hasMatches;
    clearButton.disabled = !state.query;
    root.dataset.open = paneState.open ? "1" : "0";
    status.textContent = statusFormatter(state);
    status.dataset.active = state.active ? "1" : "0";
    status.dataset.complete = state.complete ? "1" : "0";
    status.dataset.empty = status.textContent ? "0" : "1";
  }

  function restoreFocus(paneState: PaneSearchUiState | undefined): void {
    const target = paneState?.pane.focusTarget ?? paneState?.pane.container ?? null;
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
    }
  }

  function closeAllExcept(paneId: number | null): void {
    for (const [id, paneState] of paneStates) {
      if (id === paneId || !paneState.open) continue;
      paneState.open = false;
      syncPaneUi(paneState);
    }
  }

  function focusSearchInput(paneState: PaneSearchUiState, selectAll = false): void {
    paneState.input.focus({ preventScroll: true });
    if (selectAll) paneState.input.select();
  }

  function open(paneId: number, config: ResttyPaneSearchUiOpenOptions = {}): void {
    if (!enabled) return;
    const paneState = paneStates.get(paneId);
    if (!paneState) return;
    closeAllExcept(paneId);
    paneState.open = true;
    paneState.state = { ...paneState.pane.app.search.getState() };
    syncPaneUi(paneState);
    focusSearchInput(paneState, config.selectAll ?? true);
  }

  function close(paneId: number, config: ResttyPaneSearchUiCloseOptions = {}): void {
    const paneState = paneStates.get(paneId);
    if (!paneState || !paneState.open) return;
    paneState.open = false;
    syncPaneUi(paneState);
    if (config.restoreFocus !== false) {
      restoreFocus(paneState);
    }
  }

  function toggle(
    paneId: number,
    config: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions = {},
  ): void {
    if (paneStates.get(paneId)?.open) {
      close(paneId, config);
      return;
    }
    open(paneId, config);
  }

  function registerPane(pane: PaneSearchUiState["pane"]): void {
    if (!enabled) return;
    const root = ownerDoc.createElement("div");
    root.className = "restty-pane-search";
    root.dataset.open = "0";
    root.setAttribute("role", "search");
    root.setAttribute("aria-label", "Search terminal scrollback");

    const row = ownerDoc.createElement("div");
    row.className = "restty-pane-search-row";

    const input = ownerDoc.createElement("input");
    input.className = "restty-pane-search-input";
    input.type = "text";
    input.placeholder = placeholder;
    input.spellcheck = false;
    input.autocapitalize = "off";
    input.autocomplete = "off";
    input.autocorrect = "off";

    const prevButton = ownerDoc.createElement("button");
    prevButton.className = "restty-pane-search-button";
    prevButton.type = "button";
    prevButton.textContent = previousButtonText;
    prevButton.title = "Match above";

    const nextButton = ownerDoc.createElement("button");
    nextButton.className = "restty-pane-search-button";
    nextButton.type = "button";
    nextButton.textContent = nextButtonText;
    nextButton.title = "Match below";

    const clearButton = ownerDoc.createElement("button");
    clearButton.className = "restty-pane-search-button";
    clearButton.type = "button";
    clearButton.textContent = clearButtonText;

    const closeButton = ownerDoc.createElement("button");
    closeButton.className = "restty-pane-search-button";
    closeButton.type = "button";
    closeButton.textContent = closeButtonText;
    closeButton.title = "Close search";
    closeButton.setAttribute("aria-label", "Close search");

    const status = ownerDoc.createElement("div");
    status.className = "restty-pane-search-status";

    row.append(input, status, prevButton, nextButton, clearButton, closeButton);

    root.append(row);
    if (!pane.container.style.position) {
      pane.container.style.position = "relative";
    }
    pane.container.appendChild(root);

    const paneState: PaneSearchUiState = {
      pane,
      root,
      input,
      prevButton,
      nextButton,
      clearButton,
      closeButton,
      status,
      cleanupFns: [],
      state: { ...pane.app.search.getState() },
      open: false,
    };

    const onInput = () => {
      pane.app.search.setQuery(input.value);
    };
    input.addEventListener("input", onInput);
    paneState.cleanupFns.push(() => {
      input.removeEventListener("input", onInput);
    });

    const onInputKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey) {
          pane.app.search.next();
        } else {
          pane.app.search.previous();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close(pane.id);
      }
    };
    input.addEventListener("keydown", onInputKeyDown);
    paneState.cleanupFns.push(() => {
      input.removeEventListener("keydown", onInputKeyDown);
    });

    const onPrev = () => {
      pane.app.search.next();
      focusSearchInput(paneState);
    };
    prevButton.addEventListener("click", onPrev);
    paneState.cleanupFns.push(() => {
      prevButton.removeEventListener("click", onPrev);
    });

    const onNext = () => {
      pane.app.search.previous();
      focusSearchInput(paneState);
    };
    nextButton.addEventListener("click", onNext);
    paneState.cleanupFns.push(() => {
      nextButton.removeEventListener("click", onNext);
    });

    const onClear = () => {
      pane.app.search.clear();
      paneState.state = { ...pane.app.search.getState() };
      syncPaneUi(paneState);
      focusSearchInput(paneState);
    };
    clearButton.addEventListener("click", onClear);
    paneState.cleanupFns.push(() => {
      clearButton.removeEventListener("click", onClear);
    });

    const onClose = () => {
      close(pane.id);
    };
    closeButton.addEventListener("click", onClose);
    paneState.cleanupFns.push(() => {
      closeButton.removeEventListener("click", onClose);
    });

    paneStates.set(pane.id, paneState);
    syncPaneUi(paneState);
  }

  function unregisterPane(paneId: number): void {
    const paneState = paneStates.get(paneId);
    if (!paneState) return;
    for (const cleanup of paneState.cleanupFns) {
      cleanup();
    }
    paneState.root.remove();
    paneStates.delete(paneId);
  }

  function handleSearchState(paneId: number, state: ResttySearchState): void {
    const paneState = paneStates.get(paneId);
    if (!paneState) return;
    paneState.state = { ...state };
    syncPaneUi(paneState);
  }

  function handleActivePaneChange(paneId: number | null): void {
    const openPaneId = getOpenPaneId();
    if (openPaneId !== null && openPaneId !== paneId) {
      close(openPaneId, { restoreFocus: false });
    }
  }

  function isOpen(paneId: number): boolean {
    return paneStates.get(paneId)?.open ?? false;
  }

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!enabled) return;
    if (shortcutOptions.enabled === false) return;

    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const primaryModifier = isMac ? event.metaKey : event.ctrlKey;
    if (!primaryModifier || event.altKey || event.repeat || event.key.toLowerCase() !== "f") {
      return;
    }

    if (
      !isNodeWithinRoot(options.root, event.target) &&
      !isNodeWithinRoot(options.root, ownerDoc.activeElement)
    ) {
      return;
    }

    const pane = options.getFocusedPane() ?? options.getActivePane();
    if (!pane) return;
    if (shortcutOptions.canOpen && !shortcutOptions.canOpen(event, pane.id)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    open(pane.id, { selectAll: true });
  };

  ownerWin.addEventListener("keydown", onWindowKeyDown, { capture: true });

  return {
    registerPane,
    unregisterPane,
    handleSearchState,
    handleActivePaneChange,
    open,
    close,
    toggle,
    isOpen,
    getStyleOptions: () => ({ ...styleOptions }),
    setStyleOptions: (next) => {
      styleOptions = normalizeSearchUiStyleOptions({
        ...styleOptions,
        ...next,
      });
      if (enabled) {
        applySearchUiStyleOptions(options.root, styleOptions);
      }
    },
    destroy: () => {
      ownerWin.removeEventListener("keydown", onWindowKeyDown, { capture: true });
      for (const paneId of Array.from(paneStates.keys())) {
        unregisterPane(paneId);
      }
      if (enabled) {
        clearSearchUiStyleOptions(options.root);
      }
    },
  };
}
