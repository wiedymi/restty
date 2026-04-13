import { expect, test } from "bun:test";
import { createLifecycleCanvasHandlers } from "../src/runtime/create-runtime/lifecycle-theme-size/canvas";

type FakeDoc = {
  activeElement: unknown;
};

class FakeFocusable {
  focusCalls = 0;
  blurCalls = 0;
  width = 1;
  height = 1;
  id = "";
  className = "";
  parentElement: HTMLElement | null = null;
  tabIndex = 0;

  constructor(
    private readonly doc: FakeDoc,
    private readonly focusPredicate: (callCount: number) => boolean = () => true,
  ) {}

  focus(): void {
    this.focusCalls += 1;
    if (this.focusPredicate(this.focusCalls)) {
      this.doc.activeElement = this;
    }
  }

  blur(): void {
    this.blurCalls += 1;
    if (this.doc.activeElement === this) {
      this.doc.activeElement = null;
    }
  }

  addEventListener(): void {}

  removeEventListener(): void {}
}

test("focusTypingInput retries IME focus when first focus attempt is ignored", () => {
  const fakeDocument: FakeDoc = { activeElement: null };
  const originalDocument = (globalThis as { document?: Document }).document;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalSetTimeout = globalThis.setTimeout;

  (globalThis as { document?: Document }).document = fakeDocument as unknown as Document;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  }) as typeof requestAnimationFrame;
  globalThis.setTimeout = ((handler: TimerHandler) => {
    if (typeof handler === "function") {
      handler();
    }
    return 1 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const canvas = new FakeFocusable(fakeDocument);
    const imeInput = new FakeFocusable(fakeDocument, (callCount) => callCount >= 2);
    const handlers = createLifecycleCanvasHandlers({
      getCanvas: () => canvas as unknown as HTMLCanvasElement,
      imeInput: imeInput as unknown as HTMLTextAreaElement,
    } as never);

    handlers.focusTypingInput();

    expect(canvas.focusCalls).toBeGreaterThan(0);
    expect(imeInput.focusCalls).toBeGreaterThanOrEqual(2);
    expect(fakeDocument.activeElement).toBe(imeInput);
  } finally {
    (globalThis as { document?: Document }).document = originalDocument;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.setTimeout = originalSetTimeout;
  }
});
