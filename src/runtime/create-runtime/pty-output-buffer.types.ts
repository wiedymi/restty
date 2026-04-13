export type PtyOutputBufferControllerOptions = {
  idleMs: number;
  maxMs: number;
  onFlush: (text: string) => void;
};

export type PtyOutputBufferController = {
  queue: (text: string) => void;
  flush: () => void;
  cancel: () => void;
  clear: () => void;
};
