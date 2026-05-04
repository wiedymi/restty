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
    setRenderer: (value) => runtime.terminal.setRenderer(value),
    setPaused: (value) => runtime.terminal.setPaused(value),
    setFontSize: (value) => runtime.terminal.setFontSize(value),
    setLigatures: (value) => runtime.terminal.setLigatures(value),
    setFontHinting: (value) => runtime.terminal.setFontHinting(value),
    setFontHintTarget: (value) => runtime.terminal.setFontHintTarget(value),
    setFonts: (fonts) => runtime.terminal.setFonts(fonts),
    applyTheme: (theme, sourceLabel) => runtime.terminal.applyTheme(theme, sourceLabel),
    resetTheme: () => runtime.terminal.resetTheme(),
    sendInput: (text, source) => runtime.io.sendInput(text, source),
    sendKeyInput: (text, source) => runtime.io.sendKeyInput(text, source),
    copySelectionToClipboard: () => runtime.interaction.copySelectionToClipboard(),
    pasteFromClipboard: () => runtime.interaction.pasteFromClipboard(),
    clearScreen: () => runtime.terminal.clearScreen(),
    connectPty: (url = "") => runtime.io.connectPty(url),
    disconnectPty: () => runtime.io.disconnectPty(),
    isPtyConnected: () => runtime.io.isPtyConnected(),
    togglePause: () => runtime.terminal.togglePause(),
    setMouseMode: (value) => runtime.interaction.setMouseMode(value),
    getMouseStatus: () => runtime.interaction.getMouseStatus(),
    selectWordAtClientPoint: (clientX, clientY) =>
      runtime.interaction.selectWordAtClientPoint(clientX, clientY),
    initRuntime: () => runtime.lifecycle.init(),
    destroyRuntime: () => runtime.lifecycle.destroy(),
    setSearchQuery: (query) => runtime.search.setQuery(query),
    clearSearch: () => runtime.search.clear(),
    searchNext: () => runtime.search.next(),
    searchPrevious: () => runtime.search.previous(),
    getSearchState: () => runtime.search.getState(),
    resize: (cols, rows) => runtime.interaction.resize(cols, rows),
    focus: () => runtime.interaction.focus(),
    blur: () => runtime.interaction.blur(),
    updateSize: (force) => runtime.interaction.updateSize(force),
    getBackend: () => runtime.render.getBackend(),
    setShaderStages: (stages) => runtime.render.setShaderStages(stages),
    getShaderStages: () => runtime.render.getShaderStages(),
    canvas,
    imeInput,
  };
}
