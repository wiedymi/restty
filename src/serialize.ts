import type { Terminal, TerminalAddon } from "./headless";

export type SerializeOptions = {
  includeHardReset?: boolean;
};

const HARD_RESET_SEQUENCE = "\u001bc";

export class SerializeAddon implements TerminalAddon {
  private terminal: Terminal | null = null;

  public activate(terminal: Terminal): void {
    this.terminal = terminal;
  }

  public serialize(options: SerializeOptions = {}): string {
    if (!this.terminal) {
      return "";
    }
    const serialized = this.terminal.serializeReplay();
    if (!serialized) {
      return "";
    }
    if (options.includeHardReset === false || serialized.startsWith(HARD_RESET_SEQUENCE)) {
      return serialized;
    }
    return `${HARD_RESET_SEQUENCE}${serialized}`;
  }

  public dispose(): void {
    this.terminal = null;
  }
}
