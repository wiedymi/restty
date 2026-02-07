import { createKittyGraphicsBridge } from "./kitty-graphics-bridge";

const port = Number(Bun.env.PTY_PORT ?? 8787);
const defaultShell = Bun.env.SHELL ?? "fish";
const textDecoder = new TextDecoder();

type PtySocket = {
  url: URL;
  proc?: Bun.Subprocess;
  terminal?: Bun.Terminal;
};

type ShellSpec = {
  cmd: string;
  args: string[];
  label: string;
};

function parseShellSpec(spec: string | null | undefined): ShellSpec | null {
  if (!spec) return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/g);
  return {
    cmd: parts[0] ?? trimmed,
    args: parts.slice(1),
    label: trimmed,
  };
}

function buildShellCandidates(shellParam: string | null): ShellSpec[] {
  const candidates: ShellSpec[] = [];
  const add = (spec: ShellSpec | null) => {
    if (!spec) return;
    if (candidates.some((c) => c.cmd === spec.cmd && c.args.join(" ") === spec.args.join(" "))) return;
    candidates.push(spec);
  };

  add(parseShellSpec(shellParam));
  add(parseShellSpec(Bun.env.SHELL));
  add(parseShellSpec(defaultShell));
  add({ cmd: "/opt/homebrew/bin/fish", args: [], label: "/opt/homebrew/bin/fish" });
  add({ cmd: "/usr/local/bin/fish", args: [], label: "/usr/local/bin/fish" });
  add({ cmd: "/bin/zsh", args: [], label: "/bin/zsh" });
  add({ cmd: "/bin/bash", args: [], label: "/bin/bash" });
  add({ cmd: "/bin/sh", args: [], label: "/bin/sh" });
  add({ cmd: "/usr/bin/zsh", args: [], label: "/usr/bin/zsh" });
  add({ cmd: "/usr/bin/bash", args: [], label: "/usr/bin/bash" });
  add({ cmd: "/usr/bin/env", args: ["zsh"], label: "env zsh" });
  add({ cmd: "/usr/bin/env", args: ["bash"], label: "env bash" });
  add({ cmd: "/usr/bin/env", args: ["sh"], label: "env sh" });
  return candidates;
}

function spawnWithFallbacks(
  candidates: ShellSpec[],
  cols: number,
  rows: number,
  cwd: string,
  env: Record<string, string | undefined>,
  ws: ServerWebSocket<PtySocket>,
) {
  const errors: string[] = [];
  const kittyBridge = createKittyGraphicsBridge({
    trace: Bun.env.WTERM_KITTY_BRIDGE_TRACE === "1",
  });
  const bridgeDebug = Bun.env.WTERM_KITTY_BRIDGE_DEBUG === "1";
  let bridgeRewriteCount = 0;
  const decoder = new TextDecoder();
  const handleOutputText = (text: string) => {
    if (!text) return;
    const rewritten = kittyBridge.transform(text);
    if (bridgeDebug && rewritten !== text) {
      bridgeRewriteCount += 1;
      console.log(`[pty] kitty bridge rewrite #${bridgeRewriteCount}`);
    }
    if (rewritten.length > 0) ws.send(rewritten);
  };

  for (const candidate of candidates) {
    try {
      const proc = Bun.spawn([candidate.cmd, ...candidate.args], {
        cwd,
        env,
        terminal: {
          cols,
          rows,
          data(_term, data) {
            try {
              if (typeof data === "string") {
                handleOutputText(data);
                return;
              }

              if (data instanceof ArrayBuffer) {
                handleOutputText(decoder.decode(data, { stream: true }));
                return;
              }

              if (ArrayBuffer.isView(data)) {
                handleOutputText(decoder.decode(data as Uint8Array, { stream: true }));
                return;
              }
            } catch {}
          },
        },
      });
      if (!proc.terminal) {
        try {
          proc.kill();
        } catch {}
        throw new Error("PTY terminal unavailable");
      }
      return { terminal: proc.terminal, proc, shell: candidate.label, errors };
    } catch (err) {
      errors.push(`${candidate.label}: ${err?.message ?? err}`);
    }
  }
  return { terminal: null, proc: null, shell: "", errors };
}

const server = Bun.serve<PtySocket>({
  port,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/pty" && server.upgrade(req, { data: { url } })) {
      return;
    }
    return new Response("restty pty server");
  },
  websocket: {
    open(ws) {
      const url = ws.data.url;
      const cols = Number(url.searchParams.get("cols") ?? 80);
      const rows = Number(url.searchParams.get("rows") ?? 24);
      const shellParam = url.searchParams.get("shell") ?? defaultShell;
      const cwd = url.searchParams.get("cwd") ?? process.cwd();
      const env = {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "ghostty",
        TERM_PROGRAM_VERSION: "1.0",
        SNACKS_GHOSTTY: "1",
        SNACKS_TMUX: "0",
        SNACKS_ZELLIJ: "0",
        SNACKS_SSH: "0",
        TMUX: undefined,
        ZELLIJ: undefined,
        ZELLIJ_SESSION_NAME: undefined,
        ZELLIJ_PANE_ID: undefined,
      };

      const candidates = buildShellCandidates(shellParam);
      const { terminal, proc, shell, errors } = spawnWithFallbacks(
        candidates,
        Number.isFinite(cols) ? cols : 80,
        Number.isFinite(rows) ? rows : 24,
        cwd,
        env,
        ws,
      );

      if (!terminal || !proc) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Failed to spawn shell",
            errors,
          }),
        );
        ws.close();
        return;
      }

      ws.data.proc = proc;
      ws.data.terminal = terminal;
      try {
        ws.send(JSON.stringify({ type: "status", shell }));
      } catch {}

      proc.exited
        .then((code) => {
          try {
            ws.send(JSON.stringify({ type: "exit", code }));
          } catch {}
          try {
            ws.close();
          } catch {}
        })
        .catch(() => {
          try {
            ws.send(JSON.stringify({ type: "exit", code: 1 }));
          } catch {}
          try {
            ws.close();
          } catch {}
        });
    },
    message(ws, message) {
      const terminal = ws.data.terminal;
      if (!terminal) return;

      if (typeof message === "string") {
        try {
          const msg = JSON.parse(message);
          if (msg?.type === "input" && typeof msg.data === "string") {
            terminal.write(msg.data);
            return;
          }
          if (msg?.type === "resize") {
            const cols = Number(msg.cols);
            const rows = Number(msg.rows);
            if (Number.isFinite(cols) && Number.isFinite(rows)) {
              terminal.resize(cols, rows);
            }
            return;
          }
        } catch {
          terminal.write(message);
          return;
        }
      }

      if (message instanceof ArrayBuffer) {
        terminal.write(textDecoder.decode(message));
      }
    },
    close(ws) {
      const proc = ws.data.proc;
      const terminal = ws.data.terminal;
      if (proc) {
        try {
          proc.kill();
        } catch {}
      }
      if (terminal) {
        try {
          terminal.close();
        } catch {}
      }
    },
  },
});

console.log(`restty pty server running on ws://localhost:${server.port}/pty`);
