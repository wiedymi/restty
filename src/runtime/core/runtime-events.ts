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

export type ResttyRuntimeEventListener = (event: ResttyRuntimeEvent) => void;

export type ResttyRuntimeEventHub = {
  emit: (event: ResttyRuntimeEvent) => void;
  subscribe: (listener: ResttyRuntimeEventListener) => () => void;
};

export function createRuntimeEventHub(): ResttyRuntimeEventHub {
  const listeners = new Set<ResttyRuntimeEventListener>();

  return {
    emit: (event) => {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Ignore runtime event listener errors.
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
