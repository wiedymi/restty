import { expect, mock, test } from "bun:test";
import type { Restty } from "../src/index.ts";

const wiringCalls: string[] = [];

const fakeRestty = {
  setShaderStages: () => {},
} as unknown as Restty;

mock.module("../playground/lib/surface-bootstrap.ts", () => ({
  bootstrapPlaygroundSurface: () => fakeRestty,
}));

mock.module("../playground/lib/playground-wiring.ts", () => ({
  wirePlaygroundControls: () => {
    wiringCalls.push("wired");
  },
}));

mock.module("../playground/lib/playground-session.ts", () => ({
  createPlaygroundSession: ({ deps }: { deps: { getRestty: () => Restty | undefined } }) => ({
    state: {
      paneStates: new Map(),
      setActivePaneId: () => {},
      getActivePaneId: () => null,
    },
    shell: {
      isSettingsDialogOpen: () => false,
      publishConnectionState: () => {},
      paneShellSync: {
        syncPtyButton: () => {},
        renderActivePaneControls: () => {},
      },
    },
    controllers: {
      appearanceController: {
        applyCurrentShaderPreset: () => {
          expect(deps.getRestty()).toBe(fakeRestty);
        },
      },
      connectionController: {},
      paneLifecycle: {},
    },
    notifications: {
      handleDesktopNotification: () => {},
    },
  }),
}));

const { bootstrapPlaygroundOrchestrator } = await import(
  "../playground/lib/playground-orchestrator.ts"
);

test("playground orchestrator applies shader preset after surface bootstrap returns restty", () => {
  wiringCalls.length = 0;

  const result = bootstrapPlaygroundOrchestrator({
    window: {
      location: { search: "" },
    } as unknown as Window & typeof globalThis,
    elements: {
      paneRoot: {} as HTMLElement,
    },
    notificationHost: {} as typeof Notification,
  });

  expect(result).toBe(fakeRestty);
  expect(wiringCalls).toEqual(["wired"]);
});
