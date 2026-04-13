import { expect, test } from "bun:test";
import { createPaneInteractions } from "../src/surface/panes/pane-interactions";
import type {
  ResttyPaneContextMenuOptions,
  ResttyPaneDefinition,
  ResttyPaneManager,
} from "../src/surface/panes/types";

type Listener = EventListenerOrEventListenerObject;

class FakeDiv {
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set<Listener>();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }
}

function createContextMenuEvent(defaultPrevented = false): {
  event: MouseEvent;
  prevented: () => boolean;
  stopped: () => boolean;
} {
  let prevented = false;
  let stopped = false;
  const event = {
    clientX: 16,
    clientY: 24,
    defaultPrevented,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
  } as MouseEvent;
  return {
    event,
    prevented: () => prevented,
    stopped: () => stopped,
  };
}

test("createPaneInteractions ignores context menu events already handled by children", () => {
  const container = new FakeDiv();
  const pane: ResttyPaneDefinition = {
    id: 11,
    container: container as unknown as HTMLDivElement,
    focusTarget: null,
  };
  const managerStub = {} as ResttyPaneManager<ResttyPaneDefinition>;

  let canOpenCalls = 0;
  const contextMenu: ResttyPaneContextMenuOptions<ResttyPaneDefinition> = {
    canOpen: () => {
      canOpenCalls += 1;
      return true;
    },
    getItems: () => [],
  };

  let showCalls = 0;
  const interactions = createPaneInteractions({
    contextMenu,
    contextMenuController: {
      element: {} as HTMLDivElement,
      isOpen: () => false,
      containsTarget: () => false,
      show: () => {
        showCalls += 1;
      },
      hide: () => {},
      destroy: () => {},
    },
    getManager: () => managerStub,
    markPaneFocused: () => {},
  });

  interactions.bindPaneInteractions(pane);

  const event = createContextMenuEvent(true);
  container.emit("contextmenu", event.event as unknown as Event);

  expect(canOpenCalls).toBe(0);
  expect(showCalls).toBe(0);
  expect(event.prevented()).toBe(false);
  expect(event.stopped()).toBe(false);
});

test("createPaneInteractions opens context menu for non-prevented events", () => {
  const container = new FakeDiv();
  const pane: ResttyPaneDefinition = {
    id: 7,
    container: container as unknown as HTMLDivElement,
    focusTarget: null,
  };
  const managerStub = {} as ResttyPaneManager<ResttyPaneDefinition>;

  let focusedPaneId: number | null = null;
  let showCalls = 0;

  const interactions = createPaneInteractions({
    contextMenu: {
      canOpen: () => true,
      getItems: () => [],
    },
    contextMenuController: {
      element: {} as HTMLDivElement,
      isOpen: () => false,
      containsTarget: () => false,
      show: () => {
        showCalls += 1;
      },
      hide: () => {},
      destroy: () => {},
    },
    getManager: () => managerStub,
    markPaneFocused: (id) => {
      focusedPaneId = id;
    },
  });

  interactions.bindPaneInteractions(pane);

  const event = createContextMenuEvent(false);
  container.emit("contextmenu", event.event as unknown as Event);

  expect(focusedPaneId).toBe(7);
  expect(showCalls).toBe(1);
  expect(event.prevented()).toBe(true);
  expect(event.stopped()).toBe(true);
});
