import type { FontHintTarget } from "./font-controls.ts";
import { getLocalFontSelectValue } from "./font-local-picker.ts";

export type SyncFontFamilyControlsOptions = {
  fontFamilySelect: HTMLSelectElement | null;
  fontFamilyLocalSelect: HTMLSelectElement | null;
  btnLoadLocalFonts: HTMLButtonElement | null;
  selectedFontFamily: string;
  selectedLocalFontMatcher: string;
  supportsLocalFontPicker: boolean;
};

export type SyncHintingControlsOptions = {
  ligaturesSelect: HTMLSelectElement | null;
  fontHintingSelect: HTMLSelectElement | null;
  fontHintTargetSelect: HTMLSelectElement | null;
  selectedLigatures: boolean;
  selectedFontHinting: boolean;
  selectedFontHintTarget: FontHintTarget;
};

export function syncFontFamilyControls(options: SyncFontFamilyControlsOptions) {
  if (options.fontFamilySelect) {
    options.fontFamilySelect.value = options.selectedFontFamily;
  }
  if (options.fontFamilyLocalSelect) {
    options.fontFamilyLocalSelect.value = getLocalFontSelectValue(options.selectedLocalFontMatcher);
  }
  if (!options.supportsLocalFontPicker && options.btnLoadLocalFonts) {
    options.btnLoadLocalFonts.disabled = true;
  }
  if (!options.supportsLocalFontPicker && options.fontFamilyLocalSelect) {
    options.fontFamilyLocalSelect.disabled = true;
  }
}

export function syncHintingControls(options: SyncHintingControlsOptions) {
  if (options.ligaturesSelect) {
    options.ligaturesSelect.value = options.selectedLigatures ? "on" : "off";
  }
  if (options.fontHintingSelect) {
    options.fontHintingSelect.value = options.selectedFontHinting ? "on" : "off";
  }
  if (options.fontHintTargetSelect) {
    options.fontHintTargetSelect.value = options.selectedFontHintTarget;
    options.fontHintTargetSelect.disabled = !options.selectedFontHinting;
  }
}
