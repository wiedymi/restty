import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  createPaneSearchUiController,
  type ResttyPaneSearchUiPane,
} from "../src/surface/pane-search-ui";
import type { ResttySearchState } from "../src/runtime/types";

type Listener = EventListenerOrEventListenerObject;

class FakeStyle {
  private values = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }

  removeProperty(name: string): void {
    this.values.delete(name);
  }

  getPropertyValue(name: string): string {
    return this.values.get(name) ?? "";
  }
}

class FakeClassList {
  private readonly values = new Set<string>();

  setFromString(value: string): void {
    this.values.clear();
    for (const item of value.split(/\s+/)) {
      if (item) this.values.add(item);
    }
  }

  add(...tokens: string[]): void {
    for (const token of tokens) {
      if (token) this.values.add(token);
    }
  }

  remove(...tokens: string[]): void {
    for (const token of tokens) {
      this.values.delete(token);
    }
  }

  contains(token: string): boolean {
    return this.values.has(token);
  }

  toggle(token: string, force?: boolean): boolean {
    if (force === true) {
      this.values.add(token);
      return true;
    }
    if (force === false) {
      this.values.delete(token);
      return false;
    }
    if (this.values.has(token)) {
      this.values.delete(token);
      return false;
    }
    this.values.add(token);
    return true;
  }

  toString(): string {
    return Array.from(this.values).join(" ");
  }
}

class FakeEventTarget {
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

  protected emit(type: string, event: Event): void {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    for (const listener of listeners) {
      if (typeof listener === "function") {
        listener.call(this, event);
      } else {
        listener.handleEvent(event);
      }
      if (event.cancelBubble) return;
    }
  }
}

class FakeNode extends FakeEventTarget {
  parentNode: FakeNode | null = null;
  childNodes: FakeNode[] = [];
  ownerDocument: FakeDocument;

  constructor(ownerDocument: FakeDocument) {
    super();
    this.ownerDocument = ownerDocument;
  }

  appendChild<T extends FakeNode>(child: T): T {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.childNodes.push(child);
    return child;
  }

  append(...children: FakeNode[]): void {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  replaceChildren(...children: FakeNode[]): void {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes = [];
    this.append(...children);
  }

  remove(): void {
    if (!this.parentNode) return;
    const siblings = this.parentNode.childNodes;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentNode = null;
  }

  contains(node: FakeNode | null): boolean {
    if (!node) return false;
    if (node === this) return true;
    for (const child of this.childNodes) {
      if (child.contains(node)) return true;
    }
    return false;
  }

  dispatchEvent(event: Event): boolean {
    defineEventField(event, "target", this);
    const dispatchToNode = (current: FakeNode | null): boolean => {
      if (!current) return false;
      defineEventField(event, "currentTarget", current);
      current.emit(event.type, event);
      if (event.cancelBubble) return true;
      return dispatchToNode(current.parentNode);
    };
    dispatchToNode(this);
    defineEventField(event, "currentTarget", this.ownerDocument.defaultView);
    this.ownerDocument.defaultView.emit(event.type, event);
    return !event.defaultPrevented;
  }
}

class FakeElement extends FakeNode {
  readonly style = new FakeStyle();
  readonly dataset: Record<string, string> = {};
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  readonly tagName: string;
  textContent = "";
  tabIndex = 0;
  value = "";
  type = "";
  placeholder = "";
  spellcheck = false;
  autocapitalize = "";
  autocomplete = "";
  autocorrect = "";
  private _className = "";

  constructor(ownerDocument: FakeDocument, tagName: string) {
    super(ownerDocument);
    this.tagName = tagName.toUpperCase();
  }

  get className(): string {
    return this._className;
  }

  set className(value: string) {
    this._className = value;
    this.classList.setFromString(value);
  }

  get parentElement(): FakeElement | null {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  select(): void {
    this.ownerDocument.activeElement = this;
  }

  querySelector(selector: string): FakeElement | null {
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return this.find((node) => node.classList.contains(className));
    }
    return null;
  }

  private find(predicate: (node: FakeElement) => boolean): FakeElement | null {
    for (const child of this.childNodes) {
      if (!(child instanceof FakeElement)) continue;
      if (predicate(child)) return child;
      const nested = child.find(predicate);
      if (nested) return nested;
    }
    return null;
  }
}

class FakeDocument {
  readonly head: FakeElement;
  readonly body: FakeElement;
  readonly defaultView: FakeWindow;
  activeElement: FakeElement | null = null;

  constructor() {
    this.defaultView = new FakeWindow();
    this.head = new FakeElement(this, "head");
    this.body = new FakeElement(this, "body");
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(this, tagName);
  }

  querySelector(selector: string): FakeElement | null {
    const markerMatch = selector.match(/^style\[(.+?)="(.+)"\]$/);
    if (markerMatch) {
      const [, attribute, value] = markerMatch;
      return this.head.querySelectorByAttribute(attribute, value);
    }
    return this.body.querySelector(selector) ?? this.head.querySelector(selector);
  }
}

class FakeWindow extends FakeEventTarget {}

declare global {
  interface FakeElement {
    querySelectorByAttribute(attribute: string, value: string): FakeElement | null;
  }
}

FakeElement.prototype.querySelectorByAttribute = function querySelectorByAttribute(
  this: FakeElement,
  attribute: string,
  value: string,
): FakeElement | null {
  for (const child of this.childNodes) {
    if (!(child instanceof FakeElement)) continue;
    if (child.getAttribute(attribute) === value) return child;
    const nested = child.querySelectorByAttribute(attribute, value);
    if (nested) return nested;
  }
  return null;
};

function defineEventField(event: Event, field: "target" | "currentTarget", value: unknown): void {
  Object.defineProperty(event, field, {
    configurable: true,
    value,
  });
}

function createKeydownEvent(
  key: string,
  overrides: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    repeat: boolean;
  }> = {},
): KeyboardEvent {
  const event = new Event("keydown", {
    bubbles: true,
    cancelable: true,
  }) as KeyboardEvent;
  Object.assign(event, {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    ...overrides,
  });
  return event;
}

function createSearchState(overrides: Partial<ResttySearchState> = {}): ResttySearchState {
  return {
    query: "",
    active: false,
    pending: false,
    complete: false,
    total: 0,
    selectedIndex: null,
    ...overrides,
  };
}

const originalGlobals = {
  document: globalThis.document,
  window: globalThis.window,
  navigator: globalThis.navigator,
  Node: globalThis.Node,
  HTMLElement: globalThis.HTMLElement,
  HTMLDivElement: globalThis.HTMLDivElement,
  HTMLInputElement: globalThis.HTMLInputElement,
  HTMLButtonElement: globalThis.HTMLButtonElement,
};

let fakeDocument: FakeDocument;

function installFakeDom(): void {
  fakeDocument = new FakeDocument();
  Object.assign(globalThis, {
    document: fakeDocument,
    window: fakeDocument.defaultView,
    navigator: { platform: "MacIntel" },
    Node: FakeNode,
    HTMLElement: FakeElement,
    HTMLDivElement: FakeElement,
    HTMLInputElement: FakeElement,
    HTMLButtonElement: FakeElement,
  });
}

function restoreGlobals(): void {
  Object.assign(globalThis, originalGlobals);
}

function setupController() {
  const root = fakeDocument.createElement("div");
  const container = fakeDocument.createElement("div");
  const focusTarget = fakeDocument.createElement("button");
  container.appendChild(focusTarget);
  root.appendChild(container);
  fakeDocument.body.appendChild(root);

  const calls: string[] = [];
  let searchState = createSearchState();

  const pane: ResttyPaneSearchUiPane = {
    id: 1,
    container: container as unknown as HTMLDivElement,
    focusTarget: focusTarget as unknown as HTMLElement,
    app: {
      setSearchQuery: (query) => {
        calls.push(`set:${query}`);
        searchState = createSearchState({
          query,
          active: query.length > 0,
          pending: query.length > 0,
        });
      },
      clearSearch: () => {
        calls.push("clear");
        searchState = createSearchState();
      },
      searchNext: () => {
        calls.push("next");
      },
      searchPrevious: () => {
        calls.push("prev");
      },
      getSearchState: () => searchState,
    },
  };

  const controller = createPaneSearchUiController({
    root: root as unknown as HTMLElement,
    getActivePane: () => pane,
    getFocusedPane: () => pane,
  });
  controller.registerPane(pane);

  const input = container.querySelector(".restty-pane-search-input");
  const status = container.querySelector(".restty-pane-search-status");

  if (!input || !status) {
    throw new Error("expected pane search UI elements");
  }

  return {
    root,
    pane,
    calls,
    controller,
    input,
    status,
  };
}

beforeEach(() => {
  installFakeDom();
});

afterEach(() => {
  restoreGlobals();
});

test("pane search ui opens from Cmd/Ctrl+F and routes search controls to the pane app", () => {
  const { pane, calls, controller, input, status } = setupController();

  const shortcutEvent = createKeydownEvent("f", {
    ctrlKey: true,
    metaKey: true,
  });
  (pane.focusTarget as unknown as FakeElement).dispatchEvent(shortcutEvent);

  expect(shortcutEvent.defaultPrevented).toBe(true);
  expect(controller.isOpen(pane.id)).toBe(true);

  input.value = "error";
  input.dispatchEvent(new Event("input", { bubbles: true }));

  controller.handleSearchState(
    pane.id,
    createSearchState({
      query: "error",
      active: true,
      pending: false,
      complete: true,
      total: 3,
      selectedIndex: 1,
    }),
  );

  expect(calls).toContain("set:error");
  expect(status.textContent).toBe("2/3");

  input.dispatchEvent(createKeydownEvent("Enter"));
  input.dispatchEvent(createKeydownEvent("Enter", { shiftKey: true }));

  expect(calls.slice(-2)).toEqual(["prev", "next"]);

  input.dispatchEvent(createKeydownEvent("Escape"));
  expect(controller.isOpen(pane.id)).toBe(false);
});

test("pane search ui style updates apply via root CSS variables and active pane changes close it", () => {
  const { root, pane, controller } = setupController();

  controller.open(pane.id);
  expect(controller.isOpen(pane.id)).toBe(true);

  controller.setStyleOptions({
    offsetTopPx: 18,
    offsetRightPx: 22,
    panelBackground: "rgba(1, 2, 3, 0.9)",
  });

  expect(root.style.getPropertyValue("--restty-search-ui-top")).toBe("18px");
  expect(root.style.getPropertyValue("--restty-search-ui-right")).toBe("22px");
  expect(root.style.getPropertyValue("--restty-search-ui-background")).toBe("rgba(1, 2, 3, 0.9)");

  controller.handleActivePaneChange(99);
  expect(controller.isOpen(pane.id)).toBe(false);
});
