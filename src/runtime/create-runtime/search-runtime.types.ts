import type { ResttyWasm, SearchViewportMatch } from "../../wasm";
import type { ResttySearchState } from "../core/models";
import type { ResttyAppCallbacks } from "../core/resources";
import type { ResttyRuntimeEvent } from "../core/runtime-events";

export type RuntimeSearchOptions = {
  callbacks?: ResttyAppCallbacks;
  cleanupFns: Array<() => void>;
  emitRuntimeEvent?: (event: Extract<ResttyRuntimeEvent, { type: "search-state" }>) => void;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  markNeedsRender: () => void;
};

export type RuntimeSearch = {
  setQuery: (query: string) => void;
  clear: () => void;
  next: () => void;
  previous: () => void;
  getState: () => ResttySearchState;
  getViewportMatches: () => SearchViewportMatch[];
  markDirty: () => void;
  handleWasmReset: () => void;
};
