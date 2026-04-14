export type PaneShellSyncPane = {
  runtime: {
    io: {
      isPtyConnected: () => boolean;
    };
    interaction: {
      getMouseStatus: () => {
        mode: string;
      };
    };
  };
};

export type ButtonLike = {
  textContent?: string | null;
};

export type SelectLike = {
  value: string;
  options?: ArrayLike<{
    value: string;
  }>;
};

export type TextLike = {
  textContent?: string | null;
};

export type PaneShellSyncElements = {
  btnPause: ButtonLike | null;
  rendererSelect: SelectLike | null;
  fontSizeInput: SelectLike | null;
  ptyBtn: ButtonLike | null;
  themeSelect: SelectLike | null;
  fontFamilySelect: HTMLSelectElement | null;
  fontFamilyLocalSelect: HTMLSelectElement | null;
  btnLoadLocalFonts: HTMLButtonElement | null;
  fontFamilyHintEl: TextLike | null;
  ligaturesSelect: HTMLSelectElement | null;
  fontHintingSelect: HTMLSelectElement | null;
  fontHintTargetSelect: HTMLSelectElement | null;
  mouseModeEl: HTMLSelectElement | null;
  shaderPresetEl: HTMLSelectElement | null;
};
