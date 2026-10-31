#!/usr/bin/env node
/**
 * 构建可分发的 VSIX：在独立 staging 目录中安装生产依赖后交给 vsce 打包。
 *
 * 背景：仓库使用 pnpm 管理 node_modules（符号链接布局），vsce 的默认依赖解析
 * 依赖 npm list，无法直接工作；而 --no-dependencies 会把 node_modules 整体排除，
 * 导致 mysql2 / pg / mssql / @vscode/sqlite3 不进入安装包，装出的扩展无法连接数据库。
 *
 * 流程：编译（由 package:vsix 先行执行）→ 建 staging → 拷贝运行产物与清单 →
 * npm 安装生产依赖 → vsce 打包 → 把 VSIX 移回仓库根目录。
 *
 * 平台说明：@vscode/sqlite3 为构建期编译的原生绑定，本脚本产出的 VSIX 仅保证在
 * 当前构建平台可用；多平台分发需按 VS Code target 分别构建（见 .agents/todolist.md）。
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const stageDir = path.join(repoRoot, ".vsix-stage");

/**
 * 递归拷贝目录或文件。
 *
 * @param {string} from 源路径。
 * @param {string} to 目标路径。
 */
function copyPath(from, to) {
  fs.cpSync(from, to, { recursive: true, dereference: true });
}

/**
 * 生成 staging 用的 package.json：剥离开发期字段，保留运行时清单与依赖。
 *
 * @returns {object} staging package.json 内容。
 */
function buildStageManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  delete manifest.devDependencies;
  delete manifest.scripts;
  delete manifest["lint-staged"];
  return manifest;
}

/**
 * 在指定目录执行命令，失败时终止脚本。
 *
 * @param {string} command 可执行命令。
 * @param {readonly string[]} args 参数列表。
 * @param {string} cwd 工作目录。
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 在 ${cwd} 中执行失败。`);
  }
}

/**
 * 脚本入口。
 */
function main() {
  if (!fs.existsSync(path.join(repoRoot, "out", "extension.js"))) {
    throw new Error("未找到 out/extension.js，请先执行 pnpm compile。");
  }

  if (fs.rmSync) {
    fs.rmSync(stageDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stageDir, { recursive: true });

  fs.writeFileSync(
    path.join(stageDir, "package.json"),
    `${JSON.stringify(buildStageManifest(), null, 2)}\n`,
  );
  copyPath(path.join(repoRoot, "out"), path.join(stageDir, "out"));
  copyPath(path.join(repoRoot, "resources"), path.join(stageDir, "resources"));
  for (const fileName of ["README.md", "LICENSE", "CHANGELOG.md", ".vscodeignore"]) {
    copyPath(path.join(repoRoot, fileName), path.join(stageDir, fileName));
  }

  console.log("[vsix] 安装生产依赖...");
  run("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], stageDir);

  console.log("[vsix] 调用 vsce 打包...");
  run("npx", ["-y", "@vscode/vsce", "package"], stageDir);

  const produced = fs.readdirSync(stageDir).filter((name) => name.endsWith(".vsix"));
  if (produced.length === 0) {
    throw new Error("vsce 未产出 VSIX 文件。");
  }

  for (const fileName of produced) {
    fs.renameSync(path.join(stageDir, fileName), path.join(repoRoot, fileName));
    console.log(`[vsix] 已生成 ${fileName}`);
  }

  const bindingPlatform = process.platform === "darwin" ? "darwin" : process.platform;
  console.log(
    `[vsix] 注意：包内 @vscode/sqlite3 为当前构建平台（${bindingPlatform}-${process.arch}）的原生绑定，` +
      "多平台分发需按 VS Code target 分别构建。",
  );
}

main();
