# 安装

## 环境要求

- VS Code `^1.125.0`
- 与当前工具链兼容的 Node.js
- `pnpm` `11.7.0`
- 用于手动调试的可访问 MySQL/PostgreSQL 服务或 SQLite3 数据库文件
- 如需验证 MSSQL 连接测试，需要准备真实 SQL Server 实例

项目强制使用 `pnpm`。不要使用 `npm` 或 `yarn`。

## 从 Marketplace 安装

> 即将上线 — 扩展目前处于 `0.0.1` 早期开发阶段。

## 从源码安装

```sh
git clone https://github.com/xcy960815/ppz-plus.git
cd ppz-plus
pnpm install
pnpm compile
```

然后在 VS Code 中按 `F5` 启动扩展开发主机。

## 验证安装

打开 Activity Bar 中的 `PPZ Plus` 视图。如果能看到数据库连接树，说明扩展安装正确。
