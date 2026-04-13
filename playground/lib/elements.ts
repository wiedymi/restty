type DocumentLike = Pick<Document, "getElementById">;

type QueryPlaygroundElementsOptions = {
  includeLegacyControls?: boolean;
};

function getRequiredElement(documentLike: DocumentLike, id: string): HTMLElement {
  const element = documentLike.getElementById(id) as HTMLElement | null;
  if (!element) {
    throw new Error(`missing #${id} element`);
  }
  return element;
}

export function queryPlaygroundElements(
  documentLike: DocumentLike,
  { includeLegacyControls = true }: QueryPlaygroundElementsOptions = {},
) {
  return {
    paneRoot: getRequiredElement(documentLike, "paneRoot"),
    btnInit: includeLegacyControls ? documentLike.getElementById("btnInit") : null,
    btnPause: includeLegacyControls ? documentLike.getElementById("btnPause") : null,
    btnClear: includeLegacyControls ? documentLike.getElementById("btnClear") : null,
    rendererSelect: includeLegacyControls
      ? (documentLike.getElementById("rendererSelect") as HTMLSelectElement | null)
      : null,
    demoSelect: includeLegacyControls
      ? (documentLike.getElementById("demoSelect") as HTMLSelectElement | null)
      : null,
    btnRunDemo: includeLegacyControls ? documentLike.getElementById("btnRunDemo") : null,
    connectionBackendEl: includeLegacyControls
      ? (documentLike.getElementById("connectionBackend") as HTMLSelectElement | null)
      : null,
    ptyUrlInput: includeLegacyControls
      ? (documentLike.getElementById("ptyUrl") as HTMLInputElement | null)
      : null,
    wcCommandInput: includeLegacyControls
      ? (documentLike.getElementById("wcCommand") as HTMLInputElement | null)
      : null,
    wcCwdInput: includeLegacyControls
      ? (documentLike.getElementById("wcCwd") as HTMLInputElement | null)
      : null,
    connectionHintEl: includeLegacyControls
      ? (documentLike.getElementById("connectionHint") as HTMLElement | null)
      : null,
    ptyBtn: includeLegacyControls ? documentLike.getElementById("btnPty") : null,
    themeSelect: includeLegacyControls
      ? (documentLike.getElementById("themeSelect") as HTMLSelectElement | null)
      : null,
    themeFileInput: includeLegacyControls
      ? (documentLike.getElementById("themeFile") as HTMLInputElement | null)
      : null,
    fontSizeInput: includeLegacyControls
      ? (documentLike.getElementById("fontSize") as HTMLInputElement | null)
      : null,
    fontFamilySelect: includeLegacyControls
      ? (documentLike.getElementById("fontFamily") as HTMLSelectElement | null)
      : null,
    ligaturesSelect: includeLegacyControls
      ? (documentLike.getElementById("ligatures") as HTMLSelectElement | null)
      : null,
    fontHintingSelect: includeLegacyControls
      ? (documentLike.getElementById("fontHinting") as HTMLSelectElement | null)
      : null,
    fontHintTargetSelect: includeLegacyControls
      ? (documentLike.getElementById("fontHintTarget") as HTMLSelectElement | null)
      : null,
    fontFamilyLocalSelect: includeLegacyControls
      ? (documentLike.getElementById("fontFamilyLocal") as HTMLSelectElement | null)
      : null,
    btnLoadLocalFonts: includeLegacyControls
      ? (documentLike.getElementById("btnLoadLocalFonts") as HTMLButtonElement | null)
      : null,
    fontFamilyHintEl: includeLegacyControls ? documentLike.getElementById("fontFamilyHint") : null,
    mouseModeEl: includeLegacyControls
      ? (documentLike.getElementById("mouseMode") as HTMLSelectElement | null)
      : null,
    shaderPresetEl: includeLegacyControls
      ? (documentLike.getElementById("shaderPreset") as HTMLSelectElement | null)
      : null,
    settingsFab: includeLegacyControls
      ? (documentLike.getElementById("settingsFab") as HTMLButtonElement | null)
      : null,
    settingsDialog: documentLike.getElementById("settingsDialog") as HTMLDialogElement | null,
    settingsClose: includeLegacyControls
      ? (documentLike.getElementById("settingsClose") as HTMLButtonElement | null)
      : null,
  };
}
