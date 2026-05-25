import type { PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../../../../src/index.ts";
import {
  PLAYGROUND_SHELL_FILE_MODE,
  PLAYGROUND_SHELL_COMMANDS,
  PLAYGROUND_SHELL_SCRIPTS,
  PLAYGROUND_SHELL_WELCOME,
} from "./playground-shell-scripts.ts";

type JustBashExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  env?: Record<string, string>;
};

type JustBashInstance = {
  exec: (
    commandLine: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      signal?: AbortSignal;
    },
  ) => Promise<JustBashExecResult>;
  getCwd: () => string;
  getEnv: () => Record<string, string>;
};

type JustBashInitialFile = string | { content: string; mode?: number };

type JustBashConstructor = new (options?: {
  cwd?: string;
  env?: Record<string, string>;
  files?: Record<string, JustBashInitialFile>;
}) => JustBashInstance;

type JustBashModule = {
  Bash: JustBashConstructor;
};

type JustBashPtyOptions = {
  loadBash?: () => Promise<JustBashModule>;
};

const DEFAULT_FILES = {
  "/home/user/README.md": [
    "# restty browser shell",
    "",
    "Just Bash and WebContainer expose the same shell demo scripts.",
    "",
    "Run ./demo.sh to start.",
    "",
  ].join("\n"),
  ...Object.fromEntries(
    PLAYGROUND_SHELL_SCRIPTS.map((script) => [
      `/home/user/${script.target}`,
      { content: script.fallback, mode: PLAYGROUND_SHELL_FILE_MODE },
    ]),
  ),
};

const COMPLETABLE_COMMANDS = [
  "cat",
  "cd",
  "clear",
  "echo",
  "help",
  "la",
  "ll",
  "ls",
  "pwd",
  ...PLAYGROUND_SHELL_COMMANDS,
];

const COMPLETABLE_FILES = [
  "README.md",
  ...PLAYGROUND_SHELL_SCRIPTS.map((script) => script.target),
];

function normalizeTerminalNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}

function formatPrompt(cwd: string): string {
  return `\x1b[38;5;75m${cwd || "/home/user"}\x1b[0m $ `;
}

function resolveShellAlias(command: string): string {
  const trimmed = command.trim();
  if (trimmed === "ll") return "ls -la";
  if (trimmed === "la") return "ls -A";
  return command;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function commonPrefix(values: string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0] ?? "";
  for (const value of values.slice(1)) {
    while (prefix && !value.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}

async function loadJustBashModule(): Promise<JustBashModule> {
  return await import("just-bash/browser");
}

export function createJustBashPtyTransport(options: JustBashPtyOptions = {}): PtyTransport {
  const loadBash = options.loadBash ?? loadJustBashModule;

  let bash: JustBashInstance | null = null;
  let callbacks: PtyConnectOptions["callbacks"] | null = null;
  let connected = false;
  let cwd = "/home/user";
  let env: Record<string, string> = {};
  let inputBuffer = "";
  let commandQueue: Promise<void> = Promise.resolve();
  let activeAbortController: AbortController | null = null;
  let connectionToken = 0;

  const write = (text: string) => {
    callbacks?.onData?.(text);
  };

  const writePrompt = () => {
    write(formatPrompt(cwd));
  };

  const completeInputBuffer = () => {
    const tokenMatch = inputBuffer.match(/(?:^|\s)(\S*)$/);
    const token = tokenMatch?.[1] ?? "";
    if (!token) return;

    const tokenStart = inputBuffer.length - token.length;
    const isFirstToken = inputBuffer.slice(0, tokenStart).trim().length === 0;
    const fileCandidates = [
      ...COMPLETABLE_FILES,
      ...COMPLETABLE_FILES.map((file) => `./${file}`),
    ];
    const candidates = uniqueSorted(
      (isFirstToken ? [...COMPLETABLE_COMMANDS, ...fileCandidates] : fileCandidates).filter(
        (candidate) => candidate.startsWith(token),
      ),
    );
    if (candidates.length === 0) return;

    const completion = candidates.length === 1 ? candidates[0]! : commonPrefix(candidates);
    if (!completion || completion.length <= token.length) return;

    const suffix = completion.slice(token.length);
    inputBuffer += suffix;
    write(suffix);
  };

  const resetSessionState = (instance: JustBashInstance) => {
    bash = instance;
    cwd = instance.getCwd();
    env = { ...instance.getEnv() };
    inputBuffer = "";
  };

  const runCommand = async (commandLine: string, token: number) => {
    const instance = bash;
    if (!instance || !connected || token !== connectionToken) return;
    const command = resolveShellAlias(commandLine);
    const trimmed = command.trim();
    if (!trimmed) {
      writePrompt();
      return;
    }
    if (trimmed === "exit" || trimmed === "logout") {
      write("exit\r\n");
      callbacks?.onExit?.(0);
      callbacks?.onDisconnect?.();
      connected = false;
      return;
    }

    activeAbortController = new AbortController();
    try {
      const result = await instance.exec(command, {
        cwd,
        env,
        signal: activeAbortController.signal,
      });
      if (!connected || token !== connectionToken) return;
      if (result.env) {
        env = { ...result.env };
        cwd = result.env.PWD || cwd;
      }
      if (result.stdout) write(normalizeTerminalNewlines(result.stdout));
      if (result.stderr) write(`\x1b[31m${normalizeTerminalNewlines(result.stderr)}\x1b[0m`);
    } catch (error) {
      if (!connected || token !== connectionToken) return;
      const message = error instanceof Error ? error.message : String(error);
      if (message !== "AbortError") {
        callbacks?.onError?.("just-bash command failed", [message]);
        write(`\x1b[31m${normalizeTerminalNewlines(message)}\x1b[0m\r\n`);
      }
    } finally {
      if (activeAbortController?.signal.aborted) {
        write("^C\r\n");
      }
      activeAbortController = null;
      if (connected && token === connectionToken) writePrompt();
    }
  };

  const submitInputBuffer = () => {
    const commandLine = inputBuffer;
    inputBuffer = "";
    write("\r\n");
    const token = connectionToken;
    commandQueue = commandQueue.then(() => runCommand(commandLine, token));
  };

  const handleControlInput = (data: string): boolean => {
    if (data === "\x03") {
      activeAbortController?.abort();
      if (!activeAbortController) {
        inputBuffer = "";
        write("^C\r\n");
        writePrompt();
      }
      return true;
    }
    if (data === "\x0c") {
      write("\x1b[2J\x1b[H");
      writePrompt();
      return true;
    }
    return false;
  };

  return {
    connect: async ({ callbacks: cb }: PtyConnectOptions) => {
      connectionToken += 1;
      const token = connectionToken;
      callbacks = cb;
      connected = false;
      activeAbortController?.abort();
      activeAbortController = null;

      const { Bash } = await loadBash();
      if (token !== connectionToken) return;

      resetSessionState(new Bash({ cwd: "/home/user", files: DEFAULT_FILES }));
      connected = true;
      cb.onConnect?.();
      cb.onStatus?.("just-bash");
      write(PLAYGROUND_SHELL_WELCOME);
      writePrompt();
    },
    disconnect: () => {
      if (!connected && !callbacks) return;
      connectionToken += 1;
      activeAbortController?.abort();
      activeAbortController = null;
      inputBuffer = "";
      connected = false;
      const cb = callbacks;
      callbacks = null;
      cb?.onDisconnect?.();
    },
    sendInput: (data: string) => {
      if (!connected) return false;
      if (!data) return true;
      if (data === "\t") {
        completeInputBuffer();
        return true;
      }
      if (handleControlInput(data)) return true;

      for (let i = 0; i < data.length; i += 1) {
        const ch = data[i];
        if (ch === "\r" || ch === "\n") {
          submitInputBuffer();
          continue;
        }
        if (ch === "\t") {
          completeInputBuffer();
          continue;
        }
        if (ch === "\x7f" || ch === "\b") {
          if (!inputBuffer) continue;
          inputBuffer = inputBuffer.slice(0, -1);
          write("\b \b");
          continue;
        }
        if (ch.charCodeAt(0) === 0x1b) {
          const next = data[i + 1];
          const direction = data[i + 2];
          if (next === "[" && !!direction && "ABCD".includes(direction)) {
            i += 2;
            continue;
          }
        }
        if (ch < " " && ch !== "\t") continue;
        inputBuffer += ch;
        write(ch);
      }
      return true;
    },
    resize: (_cols: number, _rows: number, _meta?: PtyResizeMeta) => connected,
    isConnected: () => connected,
    destroy: () => {
      connectionToken += 1;
      activeAbortController?.abort();
      activeAbortController = null;
      callbacks = null;
      connected = false;
      bash = null;
      inputBuffer = "";
    },
  };
}
