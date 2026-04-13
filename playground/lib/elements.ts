type DocumentLike = Pick<Document, "getElementById">;

function getRequiredElement(documentLike: DocumentLike, id: string): HTMLElement {
  const element = documentLike.getElementById(id) as HTMLElement | null;
  if (!element) {
    throw new Error(`missing #${id} element`);
  }
  return element;
}

export function queryPlaygroundElements(documentLike: DocumentLike) {
  return {
    paneRoot: getRequiredElement(documentLike, "paneRoot"),
    btnInit: documentLike.getElementById("btnInit"),
    btnPause: documentLike.getElementById("btnPause"),
    btnClear: documentLike.getElementById("btnClear"),
    rendererSelect: documentLike.getElementById("rendererSelect") as HTMLSelectElement | null,
    demoSelect: documentLike.getElementById("demoSelect") as HTMLSelectElement | null,
    btnRunDemo: documentLike.getElementById("btnRunDemo"),
    connectionBackendEl: documentLike.getElementById(
      "connectionBackend",
    ) as HTMLSelectElement | null,
    ptyUrlInput: documentLike.getElementById("ptyUrl") as HTMLInputElement | null,
    wcCommandInput: documentLike.getElementById("wcCommand") as HTMLInputElement | null,
    wcCwdInput: documentLike.getElementById("wcCwd") as HTMLInputElement | null,
    connectionHintEl: documentLike.getElementById("connectionHint") as HTMLElement | null,
    ptyBtn: documentLike.getElementById("btnPty"),
    themeSelect: documentLike.getElementById("themeSelect") as HTMLSelectElement | null,
    themeFileInput: documentLike.getElementById("themeFile") as HTMLInputElement | null,
    fontSizeInput: documentLike.getElementById("fontSize") as HTMLInputElement | null,
    fontFamilySelect: documentLike.getElementById("fontFamily") as HTMLSelectElement | null,
    ligaturesSelect: documentLike.getElementById("ligatures") as HTMLSelectElement | null,
    fontHintingSelect: documentLike.getElementById("fontHinting") as HTMLSelectElement | null,
    fontHintTargetSelect: documentLike.getElementById("fontHintTarget") as HTMLSelectElement | null,
    fontFamilyLocalSelect: documentLike.getElementById(
      "fontFamilyLocal",
    ) as HTMLSelectElement | null,
    btnLoadLocalFonts: documentLike.getElementById("btnLoadLocalFonts") as HTMLButtonElement | null,
    fontFamilyHintEl: documentLike.getElementById("fontFamilyHint"),
    mouseModeEl: documentLike.getElementById("mouseMode") as HTMLSelectElement | null,
    shaderPresetEl: documentLike.getElementById("shaderPreset") as HTMLSelectElement | null,
    settingsFab: documentLike.getElementById("settingsFab") as HTMLButtonElement | null,
    settingsDialog: documentLike.getElementById("settingsDialog") as HTMLDialogElement | null,
    settingsClose: documentLike.getElementById("settingsClose") as HTMLButtonElement | null,
  };
}
