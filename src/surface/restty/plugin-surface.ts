import type { ResttyPluginHostApi } from "../plugins/context.types";
import type { ResttySurfacePane } from "./events";
import { createResttyPluginSurfaceApi, type ResttyPluginSurfaceApiSource } from "./controller";

export type ResttyPluginSurfaceBridgeSource = ResttyPluginSurfaceApiSource<ResttySurfacePane>;

export function createResttyPluginSurfaceBridge(
  restty: ResttyPluginSurfaceBridgeSource,
): ResttyPluginHostApi {
  return createResttyPluginSurfaceApi(restty);
}
