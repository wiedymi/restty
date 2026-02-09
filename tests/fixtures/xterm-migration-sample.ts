import { Terminal, type TerminalAddon, type TerminalResizeEvent } from "../../src/xterm";

export type XtermMigrationSampleCalls = {
  addonActivated: number;
  addonDisposed: number;
  dataEvents: string[];
  resizeEvents: TerminalResizeEvent[];
};

export function runXtermMigrationSample(container: HTMLElement): {
  term: Terminal;
  calls: XtermMigrationSampleCalls;
} {
  const calls: XtermMigrationSampleCalls = {
    addonActivated: 0,
    addonDisposed: 0,
    dataEvents: [],
    resizeEvents: [],
  };

  const fitLikeAddon: TerminalAddon = {
    activate() {
      calls.addonActivated += 1;
    },
    dispose() {
      calls.addonDisposed += 1;
    },
  };

  const term = new Terminal({
    cols: 100,
    rows: 25,
    cursorBlink: true,
    convertEol: true,
  });

  term.onData((data) => {
    calls.dataEvents.push(data);
  });

  term.onResize((size) => {
    calls.resizeEvents.push(size);
  });

  term.loadAddon(fitLikeAddon);
  term.open(container);
  term.write("$ ");
  term.writeln("echo ok");
  term.resize(120, 30);

  return { term, calls };
}
