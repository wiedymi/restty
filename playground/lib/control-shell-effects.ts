import {
  listenAppearanceInput,
  listenConnectionInput,
  listenShellCommand,
  listenTerminalAction,
} from "./shell-bridge.ts";

type TargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

type Disposer = () => void;

export function bindConnectionShellEffects(options: {
  target: TargetLike;
  onBackendChange: (value: string | null | undefined) => void;
  onPtyUrlChange: (value: string | null | undefined) => void;
  onWebContainerCommandChange: (value: string | null | undefined) => void;
  onWebContainerCwdChange: (value: string | null | undefined) => void;
}): Disposer {
  return listenConnectionInput(options.target, (detail) => {
    if (detail?.backend !== undefined) {
      options.onBackendChange(detail.backend);
    }
    if (detail?.ptyUrl !== undefined) {
      options.onPtyUrlChange(detail.ptyUrl);
    }
    if (detail?.webContainerCommand !== undefined) {
      options.onWebContainerCommandChange(detail.webContainerCommand);
    }
    if (detail?.webContainerCwd !== undefined) {
      options.onWebContainerCwdChange(detail.webContainerCwd);
    }
  });
}

export function bindTerminalShellEffects(options: {
  target: TargetLike;
  onClear: () => void;
  onDemoRun: (kind: string | null | undefined) => void;
  onFontSizeChange: (value: string | null | undefined) => void;
  onInit: () => void;
  onPauseToggle: () => void;
  onPtyButton: () => void;
  onRendererChange: (value: string | null | undefined) => void;
}): Disposer {
  const disposeCommand = listenShellCommand(options.target, (detail) => {
    switch (detail?.command) {
      case "pty-button":
        options.onPtyButton();
        break;
      case "run-demo":
        options.onDemoRun(detail.demoKind);
        break;
    }
  });

  const disposeAction = listenTerminalAction(options.target, (detail) => {
    switch (detail?.command) {
      case "init":
        options.onInit();
        break;
      case "pause":
        options.onPauseToggle();
        break;
      case "clear":
        options.onClear();
        break;
    }

    if (detail?.renderer !== undefined) {
      options.onRendererChange(detail.renderer);
    }
    if (detail?.fontSize !== undefined) {
      options.onFontSizeChange(String(detail.fontSize));
    }
  });

  return () => {
    disposeCommand();
    disposeAction();
  };
}

export function bindAppearanceShellEffects(options: {
  target: TargetLike;
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
  return listenAppearanceInput(options.target, (detail) => {
    if (detail?.themeFile !== undefined) {
      void options.onThemeFileChange(detail.themeFile);
    }
    if (detail?.themeSelectValue !== undefined) {
      options.onThemeSelectChange(detail.themeSelectValue);
    }
    if (detail?.mouseMode !== undefined) {
      options.onMouseModeChange(detail.mouseMode);
    }
    if (detail?.shaderPreset !== undefined) {
      options.onShaderPresetChange(detail.shaderPreset);
    }
    if (detail?.fontHinting !== undefined) {
      options.onFontHintingChange(detail.fontHinting);
    }
    if (detail?.ligatures !== undefined) {
      options.onLigaturesChange(detail.ligatures);
    }
    if (detail?.fontHintTarget !== undefined) {
      options.onFontHintTargetChange(detail.fontHintTarget);
    }
    if (detail?.fontFamily !== undefined) {
      void options.onFontFamilyChange(detail.fontFamily);
    }
    if (detail?.localFontValue !== undefined) {
      void options.onFontFamilyLocalChange(detail.localFontValue);
    }
    if (detail?.action === "load-local-fonts") {
      void options.onLoadLocalFonts();
    }
  });
}
