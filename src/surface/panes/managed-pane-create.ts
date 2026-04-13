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
    canvas,
    imeInput,
  };
}
