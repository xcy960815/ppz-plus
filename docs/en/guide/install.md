# Install

## Prerequisites

- VS Code `^1.125.0`
- Node.js compatible with the project toolchain
- `pnpm` `11.7.0`
- A reachable MySQL/PostgreSQL server or SQLite3 database file for manual testing
- A real SQL Server instance is required when validating the staged MSSQL connection-test path

This project enforces `pnpm`. Do not use `npm` or `yarn`.

## Install from Marketplace

> Coming soon — the extension is currently in early `0.0.1` development.

## Install from Source

```sh
git clone https://github.com/xcy960815/ppz-plus.git
cd ppz-plus
pnpm install
pnpm compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Verify Installation

Open the `PPZ Plus` activity bar view. If you see the database connections tree, the extension is installed correctly.
