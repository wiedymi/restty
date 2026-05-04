import { expect, test } from "bun:test";
import { createJustBashPtyTransport } from "../playground/lib/just-bash-pty.ts";

type FakeExecOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

class FakeBash {
  private cwd = "/home/user";
  private env = { PWD: "/home/user", HOME: "/home/user" };

  constructor(options?: { cwd?: string; env?: Record<string, string> }) {
    this.cwd = options?.cwd ?? this.cwd;
    this.env = { ...this.env, ...(options?.env ?? {}), PWD: this.cwd };
  }

  getCwd() {
    return this.cwd;
  }

  getEnv() {
    return this.env;
  }

  async exec(command: string, options?: FakeExecOptions) {
    const cwd = options?.cwd ?? this.cwd;
    const env = { ...this.env, ...(options?.env ?? {}), PWD: cwd };
    if (command === "pwd") {
      return { stdout: `${cwd}\n`, stderr: "", exitCode: 0, env };
    }
    if (command === "cd /tmp") {
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
        env: { ...env, PWD: "/tmp", OLDPWD: cwd },
      };
    }
    if (command === "ls -la") {
      return { stdout: "total 0\n", stderr: "", exitCode: 0, env };
    }
    return { stdout: `ran:${command}\n`, stderr: "", exitCode: 0, env };
  }
}

async function flushAsyncWork(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

test("createJustBashPtyTransport connects and executes line input", async () => {
  const output: string[] = [];
  const transport = createJustBashPtyTransport({
    loadBash: async () => ({ Bash: FakeBash }),
  });

  await transport.connect({
    url: "",
    callbacks: {
      onData: (data) => output.push(data),
    },
  });

  expect(transport.isConnected()).toBe(true);

  transport.sendInput("pwd");
  transport.sendInput("\r");
  await flushAsyncWork();

  expect(output.join("")).toContain("restty Just Bash");
  expect(output.join("")).toContain("pwd\r\n/home/user\r\n");
});

test("createJustBashPtyTransport persists cwd from exec result and supports ll alias", async () => {
  const output: string[] = [];
  const transport = createJustBashPtyTransport({
    loadBash: async () => ({ Bash: FakeBash }),
  });

  await transport.connect({
    url: "",
    callbacks: {
      onData: (data) => output.push(data),
    },
  });

  transport.sendInput("cd /tmp\rpwd\rll\r");
  await flushAsyncWork(8);

  const text = output.join("");
  expect(text).toContain("\x1b[38;5;75m/tmp\x1b[0m $ /tmp\r\n");
  expect(text).toContain("/tmp\r\n");
  expect(text).toContain("total 0\r\n");
});
