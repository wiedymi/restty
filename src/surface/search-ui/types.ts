import type { ResttySearchState } from "../../runtime/types";

type SearchUiPaneApp = {
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  searchNext: () => void;
  searchPrevious: () => void;
  getSearchState: () => ResttySearchState;
};

export type ResttyPaneSearchUiPane = {
  id: number;
  container: HTMLDivElement;
  focusTarget?: HTMLElement | null;
  app: SearchUiPaneApp;
};

export type ResttyPaneSearchUiStyleOptions = {
  offsetTopPx?: number;
  offsetRightPx?: number;
  minWidthPx?: number;
  maxWidthPx?: number;
  zIndex?: number;
  borderRadiusPx?: number;
  backdropBlurPx?: number;
  panelBackground?: string;
  panelBorderColor?: string;
  panelTextColor?: string;
  panelShadow?: string;
  inputBackground?: string;
  inputTextColor?: string;
  inputPlaceholderColor?: string;
  buttonBackground?: string;
  buttonTextColor?: string;
  buttonHoverBackground?: string;
  buttonDisabledOpacity?: number;
  statusTextColor?: string;
  statusActiveTextColor?: string;
  statusCompleteTextColor?: string;
};

export type ResttyPaneSearchUiShortcutOptions = {
  enabled?: boolean;
  canOpen?: (event: KeyboardEvent, paneId: number) => boolean;
};

export type ResttyPaneSearchUiOptions = {
  enabled?: boolean;
  placeholder?: string;
  previousButtonText?: string;
  nextButtonText?: string;
  clearButtonText?: string;
  closeButtonText?: string;
  statusFormatter?: (state: ResttySearchState) => string;
  shortcut?: boolean | ResttyPaneSearchUiShortcutOptions;
  styles?: ResttyPaneSearchUiStyleOptions;
};

export type ResttyPaneSearchUiOpenOptions = {
  selectAll?: boolean;
};

export type ResttyPaneSearchUiCloseOptions = {
  restoreFocus?: boolean;
};

export type PaneSearchUiController = {
  registerPane: (pane: ResttyPaneSearchUiPane) => void;
  unregisterPane: (paneId: number) => void;
  handleSearchState: (paneId: number, state: ResttySearchState) => void;
  handleActivePaneChange: (paneId: number | null) => void;
  open: (paneId: number, options?: ResttyPaneSearchUiOpenOptions) => void;
  close: (paneId: number, options?: ResttyPaneSearchUiCloseOptions) => void;
  toggle: (
    paneId: number,
    options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions,
  ) => void;
  isOpen: (paneId: number) => boolean;
  getStyleOptions: () => Readonly<Required<ResttyPaneSearchUiStyleOptions>>;
  setStyleOptions: (options: ResttyPaneSearchUiStyleOptions) => void;
  destroy: () => void;
};

export type CreatePaneSearchUiControllerOptions = {
  root: HTMLElement;
  enabled?: boolean;
  placeholder?: string;
  previousButtonText?: string;
  nextButtonText?: string;
  clearButtonText?: string;
  closeButtonText?: string;
  statusFormatter?: (state: ResttySearchState) => string;
  shortcut?: boolean | ResttyPaneSearchUiShortcutOptions;
  styles?: ResttyPaneSearchUiStyleOptions;
  getPaneById: (paneId: number) => ResttyPaneSearchUiPane | null;
  getActivePane: () => ResttyPaneSearchUiPane | null;
  getFocusedPane: () => ResttyPaneSearchUiPane | null;
};

export type PaneSearchUiState = {
  pane: ResttyPaneSearchUiPane;
  root: HTMLDivElement;
  input: HTMLInputElement;
  prevButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  clearButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  status: HTMLDivElement;
  cleanupFns: Array<() => void>;
  state: ResttySearchState;
  open: boolean;
};
