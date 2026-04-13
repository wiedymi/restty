import type { ResttyRuntimeCallbacks, ResttyRuntimeSession } from "../../runtime/core/resources";
import type {
  ResttyPaneRuntimeContext,
  ResttyRuntimeServicesConfigInput,
  ResttyTerminalConfigInput,
} from "./managed-pane-types";

export type CreateManagedPaneRuntimeConfigOptions = {
  context: ResttyPaneRuntimeContext;
  terminal?: ResttyTerminalConfigInput;
  services?: ResttyRuntimeServicesConfigInput;
  session: ResttyRuntimeSession;
  onSearchState?: ResttyRuntimeCallbacks["onSearchState"];
};
