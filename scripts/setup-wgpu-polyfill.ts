import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const distDir = join(projectRoot, "node_modules", "wgpu-polyfill", "dist");
const distIndex = join(distDir, "index.js");
const libDir = join(projectRoot, "node_modules", "lib");
const packageLibDir = join(projectRoot, "node_modules", "wgpu-polyfill", "lib");
const libIndex = join(libDir, `${process.platform}-${process.arch}`, "lib");
const packageLibIndex = join(
  packageLibDir,
  `${process.platform}-${process.arch}`,
  "lib",
);

if (
  !existsSync(distIndex) ||
  !existsSync(libIndex) ||
  !existsSync(packageLibIndex)
) {
  const tmpRoot = join(projectRoot, ".tmp");
  const repoDir = join(tmpRoot, "wgpu-polyfill");
  mkdirSync(tmpRoot, { recursive: true });

  if (!existsSync(repoDir)) {
    const clone = Bun.spawnSync(
      [
        "git",
        "clone",
        "--depth",
        "1",
        "https://github.com/wiedymi/wgpu-polyfill",
        repoDir,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    if (clone.exitCode !== 0) {
      throw new Error("failed to clone wgpu-polyfill");
    }
  }

  const install = Bun.spawnSync(["bun", "install"], {
    cwd: repoDir,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (install.exitCode !== 0) {
    throw new Error("failed to install wgpu-polyfill deps");
  }

  const build = Bun.spawnSync(["bun", "run", "build"], {
    cwd: repoDir,
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (build.exitCode !== 0) {
    throw new Error("failed to build wgpu-polyfill");
  }

  mkdirSync(distDir, { recursive: true });
  cpSync(join(repoDir, "dist"), distDir, { recursive: true });
  mkdirSync(libDir, { recursive: true });
  cpSync(join(repoDir, "lib"), libDir, { recursive: true });
  mkdirSync(packageLibDir, { recursive: true });
  cpSync(join(repoDir, "lib"), packageLibDir, { recursive: true });
}
