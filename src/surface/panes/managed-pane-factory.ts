import { createManagedPaneDom } from "./managed-pane-dom";
import { createManagedPaneRuntime } from "./managed-pane-runtime";
import type { ResttyAppCallbacks, ResttyAppSession } from "../../runtime/types";
import type { CreateResttyAppPaneManagerOptions, ResttyManagedAppPane } from "./managed-pane-types";

type ResolvedManagedPaneDomOptions = {
  paneClassName: string;
  canvasClassName: string;
  imeInputClassName: string;
  termDebugClassName: string;
};

export type CreateManagedPaneOptions = {
  id: number;
  sourcePane: ResttyManagedAppPane | null;
  dom: ResolvedManagedPaneDomOptions;
  terminal?: CreateResttyAppPaneManagerOptions["terminal"];
  services?: CreateResttyAppPaneManagerOptions["services"];
  session: ResttyAppSession;
  autoInit?: boolean;
  onSearchState?: ResttyAppCallbacks["onSearchState"];
};

export function createManagedPane(options: CreateManagedPaneOptions): ResttyManagedAppPane {
  const { container, canvas, imeInput, termDebugEl } = createManagedPaneDom(options.dom);
  const context = {
    id: options.id,
    sourcePane: options.sourcePane,
    canvas,
    imeInput,
    termDebugEl,
  };
  const app = createManagedPaneRuntime({
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
    app,
    canvas,
    imeInput,
    termDebugEl,
  };
}
