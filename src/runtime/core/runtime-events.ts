import type { ResttySearchState } from "../types";
import type { ResttyRuntimeLifecycleState } from "./lifecycle";

/**
 * Event emitted by a single runtime instance.
 */
export type ResttyRuntimeEvent =
  | {
      type: "state";
      state: ResttyRuntimeLifecycleState;
    }
  | {
      type: "backend";
      backend: string;
    }
  | {
      type: "pty-status";
      status: string;
    }
  | {
      type: "search-state";
      state: ResttySearchState;
    };
