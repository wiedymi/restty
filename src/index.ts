// restty library - main entry point

// Renderer - shapes, WebGPU, shaders
export {
  // Types
  type Color,
  type RectData,
  type GlyphBox,
  type NerdMetrics,
  type WebGPUState,
  type WebGLState,
  type WebGLAtlasState,
  type AtlasState,
  type RendererState,
  type RendererConfig,
  type ResizeState,
  type ScrollbarState,
  // Constants
  BOX_STYLE_NONE,
  BOX_STYLE_LIGHT,
  BOX_STYLE_HEAVY,
  BOX_STYLE_DOUBLE,
  BOX_LINE_MAP,
  RECT_SHADER,
  GLYPH_SHADER,
  // Classification functions
  isPrivateUse,
  isSpaceCp,
  isBoxDrawing,
  isBlockElement,
  isLegacyComputing,
  isPowerline,
  isBraille,
  isGraphicsElement,
  isSymbolCp,
  // Color utilities
  applyAlpha,
  // Rect helpers
  pushRect,
  pushRectSnapped,
  pushRectBox,
  // Shape drawing
  drawBlockElement,
  drawBoxDrawing,
  drawBraille,
  drawPowerline,
  constrainGlyphBox,
  // WebGPU
  initWebGPU,
  initWebGL,
  ensureInstanceBuffer,
  ensureGLInstanceBuffer,
  configureContext,
  createResizeState,
  createScrollbarState,
} from "./renderer";

// Grid
export {
  type GridState,
  type CellMetrics,
  type GridConfig,
  type FontMetricsProvider,
  type ShapeResult,
  fontHeightUnits,
  computeCellMetrics,
  createGridState,
  updateGridState,
  clamp,
} from "./grid";

// Fonts
export {
  type FontEntry,
  type FontManagerState,
  type ShapedCluster,
  type ShapedGlyph,
  type FallbackFontSource,
  type FontScaleOverride,
  type NerdConstraint,
  type NerdConstraintRange,
  isSymbolFont,
  isNerdSymbolFont,
  fontMaxCellSpan,
  fontScaleOverride,
  fontRasterScale,
  createFontEntry,
  resetFontEntry,
  createFontManagerState,
  fontHasGlyph,
  fontAdvanceUnits,
  glyphWidthUnits,
  pickFontIndexForText,
  tryFetchFontBuffer,
  tryLocalFontBuffer,
  loadPrimaryFontBuffer,
  loadFallbackFontBuffers,
  isNerdSymbolCodepoint,
  NERD_SYMBOL_RANGES,
  getNerdConstraint,
  NERD_CONSTRAINTS,
} from "./fonts";

// Selection
export {
  type SelectionState,
  type SelectionRange,
  type CellTextGetter,
  createSelectionState,
  clearSelection,
  startSelection,
  updateSelection,
  endSelection,
  selectionForRow,
  getSelectionText,
  normalizeSelectionCell,
  positionToCell,
  copyToClipboard,
  pasteFromClipboard,
} from "./selection";
export type { CellPosition } from "./selection";

// IME
export {
  type ImeState,
  createImeState,
  setPreedit,
  clearPreedit,
  startComposition,
  updateComposition,
  endComposition,
  syncImeSelection,
  updateImePosition,
  PREEDIT_BG,
  PREEDIT_ACTIVE_BG,
  PREEDIT_FG,
  PREEDIT_UL,
  PREEDIT_CARET,
} from "./ime";
export type { CursorPosition } from "./ime";

// PTY
export {
  type PtyMessage,
  type PtyStatusMessage,
  type PtyErrorMessage,
  type PtyExitMessage,
  type PtyServerMessage,
  type PtyConnectionState,
  type PtyCallbacks,
  createPtyConnection,
  connectPty,
  disconnectPty,
  sendPtyInput,
  sendPtyResize,
  isPtyConnected,
} from "./pty";

// Input
export { createInputHandler } from "./input";
export type {
  InputHandler,
  InputHandlerConfig,
  InputHandlerOptions,
  MouseMode,
  MouseStatus,
} from "./input";

// WASM runtime
export { loadResttyWasm, ResttyWasm } from "./wasm";
export type {
  WasmAbi,
  WasmAbiKind,
  CursorInfo,
  RenderState,
  ResttyWasmExports,
  ResttyWasmOptions,
} from "./wasm";

// Theme
export {
  parseGhosttyTheme,
  parseGhosttyColor,
  colorToFloats,
  colorToRgbU32,
  listBuiltinThemeNames,
  isBuiltinThemeName,
  getBuiltinThemeSource,
  getBuiltinTheme,
} from "./theme";
export type { GhosttyTheme, ThemeColor, ResttyBuiltinThemeName } from "./theme";

// App / high-level integration
export {
  createResttyApp,
} from "./app";
export type {
  ResttyApp,
  ResttyAppOptions,
  ResttyAppElements,
  ResttyAppCallbacks,
  TextShaper,
} from "./app";
