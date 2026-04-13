type DocumentLike = Pick<Document, "getElementById">;

type ButtonLike = HTMLButtonElement | null;
type DialogLike = HTMLDialogElement | null;
type HintLike = HTMLElement | null;
type InputLike = HTMLInputElement | null;
type SelectLike = HTMLSelectElement | null;

export type SharedPlaygroundElements = {
  paneRoot: HTMLElement;
  settingsDialog: DialogLike;
};

export type LegacyPlaygroundElements = {
  btnInit: ButtonLike;
  btnPause: ButtonLike;
  btnClear: ButtonLike;
  rendererSelect: SelectLike;
  demoSelect: SelectLike;
  btnRunDemo: ButtonLike;
  connectionBackendEl: SelectLike;
  ptyUrlInput: InputLike;
  wcCommandInput: InputLike;
  wcCwdInput: InputLike;
  connectionHintEl: HintLike;
  ptyBtn: ButtonLike;
  themeSelect: SelectLike;
  themeFileInput: InputLike;
  fontSizeInput: InputLike;
  fontFamilySelect: SelectLike;
  ligaturesSelect: SelectLike;
  fontHintingSelect: SelectLike;
  fontHintTargetSelect: SelectLike;
  fontFamilyLocalSelect: SelectLike;
  btnLoadLocalFonts: ButtonLike;
  fontFamilyHintEl: HintLike;
  mouseModeEl: SelectLike;
  shaderPresetEl: SelectLike;
  settingsFab: ButtonLike;
  settingsClose: ButtonLike;
};

function getRequiredElement(documentLike: DocumentLike, id: string): HTMLElement {
  const element = documentLike.getElementById(id) as HTMLElement | null;
  if (!element) {
    throw new Error(`missing #${id} element`);
  }
  return element;
}

export function querySharedPlaygroundElements(
  documentLike: DocumentLike,
): SharedPlaygroundElements {
  return {
    paneRoot: getRequiredElement(documentLike, "paneRoot"),
    settingsDialog: documentLike.getElementById("settingsDialog") as HTMLDialogElement | null,
  };
}

export function queryLegacyPlaygroundElements(
  documentLike: DocumentLike,
): LegacyPlaygroundElements {
  return {
    btnInit: documentLike.getElementById("btnInit") as HTMLButtonElement | null,
    btnPause: documentLike.getElementById("btnPause") as HTMLButtonElement | null,
    btnClear: documentLike.getElementById("btnClear") as HTMLButtonElement | null,
    rendererSelect: documentLike.getElementById("rendererSelect") as HTMLSelectElement | null,
    demoSelect: documentLike.getElementById("demoSelect") as HTMLSelectElement | null,
    btnRunDemo: documentLike.getElementById("btnRunDemo") as HTMLButtonElement | null,
    connectionBackendEl: documentLike.getElementById(
      "connectionBackend",
    ) as HTMLSelectElement | null,
    ptyUrlInput: documentLike.getElementById("ptyUrl") as HTMLInputElement | null,
    wcCommandInput: documentLike.getElementById("wcCommand") as HTMLInputElement | null,
    wcCwdInput: documentLike.getElementById("wcCwd") as HTMLInputElement | null,
    connectionHintEl: documentLike.getElementById("connectionHint") as HTMLElement | null,
    ptyBtn: documentLike.getElementById("btnPty") as HTMLButtonElement | null,
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
    fontFamilyHintEl: documentLike.getElementById("fontFamilyHint") as HTMLElement | null,
    mouseModeEl: documentLike.getElementById("mouseMode") as HTMLSelectElement | null,
    shaderPresetEl: documentLike.getElementById("shaderPreset") as HTMLSelectElement | null,
    settingsFab: documentLike.getElementById("settingsFab") as HTMLButtonElement | null,
    settingsClose: documentLike.getElementById("settingsClose") as HTMLButtonElement | null,
  };
}

export function createEmptyLegacyPlaygroundElements(): LegacyPlaygroundElements {
  return {
    btnInit: null,
    btnPause: null,
    btnClear: null,
    rendererSelect: null,
    demoSelect: null,
    btnRunDemo: null,
    connectionBackendEl: null,
    ptyUrlInput: null,
    wcCommandInput: null,
    wcCwdInput: null,
    connectionHintEl: null,
    ptyBtn: null,
    themeSelect: null,
    themeFileInput: null,
    fontSizeInput: null,
    fontFamilySelect: null,
    ligaturesSelect: null,
    fontHintingSelect: null,
    fontHintTargetSelect: null,
    fontFamilyLocalSelect: null,
    btnLoadLocalFonts: null,
    fontFamilyHintEl: null,
    mouseModeEl: null,
    shaderPresetEl: null,
    settingsFab: null,
    settingsClose: null,
  };
}
