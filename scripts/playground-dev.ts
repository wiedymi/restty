const children = [
  Bun.spawn(["bun", "run", "playground:pty"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
  Bun.spawn(["bunx", "vite", "--config", "playground/vite.config.ts", "--port", "5173"], {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
];

let shuttingDown = false;

function shutdown(signalCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill();
    }
  }
  process.exit(signalCode);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

const results = await Promise.race(
  children.map((child, index) =>
    child.exited.then((code) => ({
      index,
      code,
    })),
  ),
);

const exitCode = Number.isFinite(results.code) ? results.code : 1;
shutdown(exitCode);
