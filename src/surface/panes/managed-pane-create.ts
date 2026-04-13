import { createManagedPaneDom } from "./managed-pane-dom";
import { createManagedPaneRuntime } from "./managed-pane-runtime";
import type { ResttyRuntimeCallbacks, ResttyRuntimeSession } from "../../runtime/core/resources";
import type {
  ResttyManagedAppPane,
  ResttyRuntimeServicesConfigInput,
  ResttyTerminalConfigInput,
} from "./managed-pane-types";

export type ManagedPaneDomClassNames = {
  paneClassName: string;
  canvasClassName: string;
  imeInputClassName: string;
};

export type CreateManagedPaneOptions = {
  id: number;
  sourcePane: ResttyManagedAppPane | null;
  dom: ManagedPaneDomClassNames;
  terminal?: ResttyTerminalConfigInput;
  services?: ResttyRuntimeServicesConfigInput;
  session: ResttyRuntimeSession;
  autoInit?: boolean;
  onSearchState?: ResttyRuntimeCallbacks["onSearchState"];
};

export function createManagedPane(options: CreateManagedPaneOptions): ResttyManagedAppPane {
  const { container, canvas, imeInput } = createManagedPaneDom(options.dom);
  const context = {
    id: options.id,
    sourcePane: options.sourcePane,
    canvas,
    imeInput,
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
  };
}
