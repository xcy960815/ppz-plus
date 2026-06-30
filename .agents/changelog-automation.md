# Changelog 自动化

更新时间：2026-06-30

## 工具

使用 **standard-version** 基于 Conventional Commits 自动生成 `CHANGELOG.md`。

## 分类规则

| commit 前缀               | CHANGELOG 分组   |
| ------------------------- | ---------------- |
| `feat:`                   | Features         |
| `fix:`                    | Bug Fixes        |
| `refactor:` / `chore:` 等 | 不写入 CHANGELOG |

## pnpm 脚本

| 命令                 | 作用                                                   |
| -------------------- | ------------------------------------------------------ |
| `pnpm changelog`     | 仅更新 CHANGELOG.md，不 bump 版本号，不 commit，不 tag |
| `pnpm release:patch` | bump patch → changelog → commit → tag (0.0.1 → 0.0.2)  |
| `pnpm release:minor` | bump minor → changelog → commit → tag (0.0.1 → 0.1.0)  |
| `pnpm release:major` | bump major → changelog → commit → tag (0.0.1 → 1.0.0)  |
| `pnpm release:dry`   | --dry-run 预演，只输出不写入                           |

## 工作流

1. 日常开发保持 commit message 符合 Conventional Commits 规范
2. 准备发版时运行对应 `pnpm release:*` 命令
3. `standard-version` 自动：
   - 根据 commit 历史更新 `CHANGELOG.md`
   - bump `package.json` 中的 `version`
   - 创建 git commit 和 tag
