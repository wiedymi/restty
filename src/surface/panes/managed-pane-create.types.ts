import type { ResttyRuntimeCallbacks, ResttyRuntimeSession } from "../../runtime/core/resources";
import type {
  ResttyManagedPane,
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
  sourcePane: ResttyManagedPane | null;
  dom: ManagedPaneDomClassNames;
  terminal?: ResttyTerminalConfigInput;
  services?: ResttyRuntimeServicesConfigInput;
  session: ResttyRuntimeSession;
  autoInit?: boolean;
  onSearchState?: ResttyRuntimeCallbacks["onSearchState"];
};
