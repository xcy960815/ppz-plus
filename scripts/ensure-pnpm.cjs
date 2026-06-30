#!/usr/bin/env node

/**
 * 校验当前安装命令是否由 pnpm 发起。
 */
const userAgent = process.env.npm_config_user_agent || "";

if (!userAgent.startsWith("pnpm/")) {
  console.error('PPZ Plus requires pnpm. Please run "pnpm install".');
  process.exit(1);
}
