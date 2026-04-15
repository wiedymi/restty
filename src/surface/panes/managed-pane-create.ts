import { createManagedPaneDom } from "./managed-pane-dom";
import { createManagedPaneRuntime } from "./managed-pane-runtime";
import type { ResttyManagedPane } from "./managed-pane-types";
import type { CreateManagedPaneOptions } from "./managed-pane-create.types";

export function createManagedPane(options: CreateManagedPaneOptions): ResttyManagedPane {
  const { container, canvas, imeInput } = createManagedPaneDom(options.dom);
  const context = {
    id: options.id,
    sourcePane: options.sourcePane,
    canvas,
    imeInput,
  };
  const runtime = createManagedPaneRuntime({
    context,
    terminal: options.terminal,
    services: options.services,
    session: options.session,
    autoInit: options.autoInit,
    onSearchState: options.onSearchState,
  });

  return {
    id: options.id,
    container,
    focusTarget: canvas,
    runtime,
    copySelectionToClipboard: () => runtime.interaction.copySelectionToClipboard(),
    pasteFromClipboard: () => runtime.interaction.pasteFromClipboard(),
    clearScreen: () => runtime.terminal.clearScreen(),
    connectPty: (url = "") => runtime.io.connectPty(url),
    disconnectPty: () => runtime.io.disconnectPty(),
    isPtyConnected: () => runtime.io.isPtyConnected(),
    togglePause: () => runtime.terminal.togglePause(),
    initRuntime: () => runtime.lifecycle.init(),
    destroyRuntime: () => runtime.lifecycle.destroy(),
    setSearchQuery: (query) => runtime.search.setQuery(query),
    clearSearch: () => runtime.search.clear(),
    searchNext: () => runtime.search.next(),
    searchPrevious: () => runtime.search.previous(),
    getSearchState: () => runtime.search.getState(),
    canvas,
    imeInput,
  };
}
