export type ResttyDebugWindow = Window &
  typeof globalThis & {
    diagnoseCodepoint?: (cp: number) => void;
    dumpGlyphMetrics?: (cp: number) => { fontIndex: number; glyphId: number } | null;
    dumpAtlasRegion?: (
      fontIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => Promise<ImageData | null>;
    dumpGlyphRender?: (cp: number, constraintWidth?: number) => Promise<unknown>;
  };
