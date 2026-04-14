type TargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

type NullableTarget = TargetLike | null | undefined;

type Disposer = () => void;

type ValueTarget = TargetLike & {
  value?: string;
};

type FileTarget = TargetLike & {
  files?: FileList | ArrayLike<File> | null;
};

function listen(
  target: NullableTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions | boolean,
): Disposer {
  if (!target) return () => {};
  target.addEventListener(type, listener, options);
  return () => {
    target.removeEventListener(type, listener, options);
  };
}

export function bindConnectionControls(options: {
  connectionBackendEl: ValueTarget | null;
  ptyUrlInput: ValueTarget | null;
  wcCommandInput: ValueTarget | null;
  wcCwdInput: ValueTarget | null;
  onBackendChange: (value: string | null | undefined) => void;
  onPtyUrlChange: (value: string | null | undefined) => void;
  onWebContainerCommandChange: (value: string | null | undefined) => void;
  onWebContainerCwdChange: (value: string | null | undefined) => void;
}): Disposer {
  return chainDisposers(
    listen(options.connectionBackendEl, "change", () => {
      options.onPtyUrlChange(options.ptyUrlInput?.value);
      options.onWebContainerCommandChange(options.wcCommandInput?.value);
      options.onWebContainerCwdChange(options.wcCwdInput?.value);
      options.onBackendChange(options.connectionBackendEl?.value);
    }),
    listen(options.ptyUrlInput, "input", () => {
      options.onPtyUrlChange(options.ptyUrlInput?.value);
    }),
    listen(options.ptyUrlInput, "change", () => {
      options.onPtyUrlChange(options.ptyUrlInput?.value);
    }),
    listen(options.wcCommandInput, "input", () => {
      options.onWebContainerCommandChange(options.wcCommandInput?.value);
    }),
    listen(options.wcCommandInput, "change", () => {
      options.onWebContainerCommandChange(options.wcCommandInput?.value);
    }),
    listen(options.wcCwdInput, "input", () => {
      options.onWebContainerCwdChange(options.wcCwdInput?.value);
    }),
    listen(options.wcCwdInput, "change", () => {
      options.onWebContainerCwdChange(options.wcCwdInput?.value);
    }),
  );
}

export function bindTerminalControls(options: {
  btnClear: NullableTarget;
  btnInit: NullableTarget;
  btnPause: NullableTarget;
  btnPty: NullableTarget;
  btnRunDemo: NullableTarget;
  demoSelect: ValueTarget | null;
  fontSizeInput: ValueTarget | null;
  rendererSelect: ValueTarget | null;
  onClear: () => void;
  onDemoRun: (kind: string | null | undefined) => void;
  onFontSizeChange: (value: string | null | undefined) => void;
  onInit: () => void;
  onPauseToggle: () => void;
  onPtyButton: () => void;
  onRendererChange: (value: string | null | undefined) => void;
}): Disposer {
  const applyFontSize = () => {
    options.onFontSizeChange(options.fontSizeInput?.value);
  };

  return chainDisposers(
    listen(options.btnInit, "click", options.onInit),
    listen(options.btnPause, "click", options.onPauseToggle),
    listen(options.btnClear, "click", options.onClear),
    listen(options.btnPty, "click", options.onPtyButton),
    listen(options.btnRunDemo, "click", () => {
      options.onDemoRun(options.demoSelect?.value);
    }),
    listen(options.rendererSelect, "change", () => {
      options.onRendererChange(options.rendererSelect?.value);
    }),
    listen(options.fontSizeInput, "change", applyFontSize),
    listen(options.fontSizeInput, "input", applyFontSize),
  );
}

export function bindAppearanceControls(options: {
  btnLoadLocalFonts: NullableTarget;
  fontFamilyLocalSelect: ValueTarget | null;
  fontFamilySelect: ValueTarget | null;
  fontHintTargetSelect: ValueTarget | null;
  fontHintingSelect: ValueTarget | null;
  ligaturesSelect: ValueTarget | null;
  mouseModeEl: ValueTarget | null;
  shaderPresetEl: ValueTarget | null;
  themeFileInput: FileTarget | null;
  themeSelect: ValueTarget | null;
  onFontFamilyChange: (value: string | null | undefined) => void | Promise<void>;
  onFontFamilyLocalChange: (value: string | null | undefined) => void | Promise<void>;
  onFontHintTargetChange: (value: string | null | undefined) => void;
  onFontHintingChange: (value: string | null | undefined) => void;
  onLigaturesChange: (value: string | null | undefined) => void;
  onLoadLocalFonts: () => void | Promise<void>;
  onMouseModeChange: (value: string | null | undefined) => void;
  onShaderPresetChange: (value: string | null | undefined) => void;
  onThemeFileChange: (file: File | null | undefined) => void | Promise<void>;
  onThemeSelectChange: (value: string | null | undefined) => void;
}): Disposer {
  return chainDisposers(
    listen(options.themeFileInput, "change", () => {
      void options.onThemeFileChange(options.themeFileInput?.files?.[0]);
    }),
    listen(options.themeSelect, "change", () => {
      options.onThemeSelectChange(options.themeSelect?.value);
    }),
    listen(options.mouseModeEl, "change", () => {
      options.onMouseModeChange(options.mouseModeEl?.value);
    }),
    listen(options.shaderPresetEl, "change", () => {
      options.onShaderPresetChange(options.shaderPresetEl?.value);
    }),
    listen(options.fontHintingSelect, "change", () => {
      options.onFontHintingChange(options.fontHintingSelect?.value);
    }),
    listen(options.ligaturesSelect, "change", () => {
      options.onLigaturesChange(options.ligaturesSelect?.value);
    }),
    listen(options.fontHintTargetSelect, "change", () => {
      options.onFontHintTargetChange(options.fontHintTargetSelect?.value);
    }),
    listen(options.fontFamilySelect, "change", () => {
      void options.onFontFamilyChange(options.fontFamilySelect?.value);
    }),
    listen(options.fontFamilyLocalSelect, "change", () => {
      void options.onFontFamilyLocalChange(options.fontFamilyLocalSelect?.value);
    }),
    listen(options.btnLoadLocalFonts, "click", () => {
      void options.onLoadLocalFonts();
    }),
  );
}

function chainDisposers(...disposers: Disposer[]): Disposer {
  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}
