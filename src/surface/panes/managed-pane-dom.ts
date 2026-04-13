export type ManagedPaneDom = {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  imeInput: HTMLTextAreaElement;
};

export type CreateManagedPaneDomOptions = {
  doc?: Document;
  paneClassName: string;
  canvasClassName: string;
  imeInputClassName: string;
};

export function createImeInput(className: string, doc: Document = document): HTMLTextAreaElement {
  const imeInput = doc.createElement("textarea");
  imeInput.className = className;
  imeInput.tabIndex = -1;
  imeInput.autocapitalize = "off";
  imeInput.autocomplete = "off";
  imeInput.autocorrect = "off";
  imeInput.spellcheck = false;
  imeInput.style.position = "fixed";
  imeInput.style.left = "0";
  imeInput.style.top = "0";
  imeInput.style.width = "1em";
  imeInput.style.height = "1em";
  imeInput.style.padding = "0";
  imeInput.style.margin = "0";
  imeInput.style.border = "0";
  imeInput.style.outline = "none";
  imeInput.style.background = "transparent";
  imeInput.style.color = "transparent";
  imeInput.style.caretColor = "transparent";
  imeInput.style.overflow = "hidden";
  imeInput.style.resize = "none";
  imeInput.style.opacity = "0";
  imeInput.style.pointerEvents = "none";
  return imeInput;
}

export function createManagedPaneDom(options: CreateManagedPaneDomOptions): ManagedPaneDom {
  const doc = options.doc ?? document;
  const container = doc.createElement("div");
  container.className = options.paneClassName;

  const canvas = doc.createElement("canvas");
  canvas.className = options.canvasClassName;
  canvas.tabIndex = 0;

  const imeInput = createImeInput(options.imeInputClassName, doc);
  container.append(canvas, imeInput);

  return {
    container,
    canvas,
    imeInput,
  };
}
