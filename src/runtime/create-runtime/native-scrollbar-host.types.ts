export type NativeScrollbarHostOptions = {
  canvas: HTMLCanvasElement;
  getGridState: () => { cellH: number };
  noteScrollActivity: () => void;
  setViewportScrollOffset: (nextOffset: number) => void;
};

export type NativeScrollbarHost = {
  flash: () => void;
  sync: (total: number, offset: number, len: number) => void;
  destroy: () => void;
};
