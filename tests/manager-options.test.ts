import { expect, test } from "bun:test";
import { createMergedPaneServicesConfig } from "../src/surface/restty/manager-options";

test("createMergedPaneServicesConfig captures paneId snapshot for callbacks and hooks", () => {
  const inputPaneIds: number[] = [];
  const outputPaneIds: number[] = [];
  const renderPaneIds: number[] = [];
  const notifyPaneIds: number[] = [];

  const mergedFactory = createMergedPaneServicesConfig({
    services: {
      callbacks: {
        onDesktopNotification: () => {
          // keep user callback wired
        },
      },
      beforeInput: ({ text }) => text,
      beforeRenderOutput: ({ text }) => text,
    },
    onDesktopNotification: (notification) => {
      notifyPaneIds.push(notification.paneId);
    },
    pluginHost: {
      applyInputInterceptors: (paneId, text) => {
        inputPaneIds.push(paneId);
        return text;
      },
      applyOutputInterceptors: (paneId, text) => {
        outputPaneIds.push(paneId);
        return text;
      },
    },
    runRenderHooks: (payload) => {
      renderPaneIds.push(payload.paneId);
    },
  });

  const context = {
    id: 7,
    sourcePane: null,
    canvas: {} as HTMLCanvasElement,
    imeInput: {} as HTMLTextAreaElement,
  };

  const merged = mergedFactory(context);
  context.id = 42;

  merged.beforeInput?.({ text: "A", source: "keyboard" });
  merged.beforeRenderOutput?.({ text: "B", source: "pty" });
  merged.callbacks?.onDesktopNotification?.({
    title: "done",
    body: "ok",
    source: "osc777",
    raw: "notify;done;ok",
  });

  expect(inputPaneIds).toEqual([7]);
  expect(outputPaneIds).toEqual([7]);
  expect(renderPaneIds).toEqual([7, 7]);
  expect(notifyPaneIds).toEqual([7]);
});
