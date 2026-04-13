import type {
  PtyOutputBufferController,
  PtyOutputBufferControllerOptions,
} from "./pty-output-buffer.types";

export function createPtyOutputBufferController(
  options: PtyOutputBufferControllerOptions,
): PtyOutputBufferController {
  const { idleMs, maxMs, onFlush } = options;
  let buffer = "";
  let idleTimer = 0;
  let maxTimer = 0;

  const cancel = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = 0;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = 0;
    }
  };

  const flush = () => {
    const output = buffer;
    buffer = "";
    if (!output) return;
    onFlush(output);
  };

  const queue = (text: string) => {
    if (!text) return;
    buffer += text;
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    idleTimer = setTimeout(() => {
      idleTimer = 0;
      if (maxTimer) {
        clearTimeout(maxTimer);
        maxTimer = 0;
      }
      flush();
    }, idleMs);

    if (!maxTimer) {
      maxTimer = setTimeout(() => {
        maxTimer = 0;
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = 0;
        }
        flush();
      }, maxMs);
    }
  };

  const clear = () => {
    buffer = "";
  };

  return {
    queue,
    flush,
    cancel,
    clear,
  };
}
