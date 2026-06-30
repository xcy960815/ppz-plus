---
layout: home

hero:
  name: PPZ Plus
  text: VS Code database import/export extension
  tagline: Manage MySQL, PostgreSQL, and SQLite3 connections directly from your editor — browse schemas, run SQL, import/export data, and edit table rows with confidence.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/install
    - theme: alt
      text: Usage Guide
      link: /guide/usage

features:
  - title: Multi-Engine Support
    details: Connect to MySQL, PostgreSQL, and SQLite3 databases with a unified explorer tree and engine-specific hierarchy.
  - title: SQL Terminal
    details: Execute queries and non-query SQL, view elapsed time, and restore terminal state after VS Code reloads.
  - title: Import & Export
    details: Import SQL/CSV/JSON files into MySQL tables. Export DDL and DML for all supported engines with batch export support.
  - title: Table Data Editor
    details: Page, sort, filter, and edit table rows with guarded insert, edit, delete, and undo flows.
  - title: Clean Architecture
    details: Rebuilt from the ground up with presentation / application / domain / infrastructure layers — no legacy coupling.
  - title: Developer Friendly
    details: Open source under MIT, written in TypeScript, and ready for contributions.
---

## What is PPZ Plus

PPZ Plus is a VS Code extension for working with MySQL, PostgreSQL, and SQLite3 databases from the editor. It is a capability-migration rewrite of the legacy PPZ extension: the product workflows are preserved, while the implementation is rebuilt around clear `presentation / application / domain / infrastructure` boundaries.

## Supported Engines

| Engine     | Connection | Browse | Table Data | SQL Terminal | Import | Export |
| ---------- | ---------- | ------ | ---------- | ------------ | ------ | ------ |
| MySQL      | Yes        | Yes    | Yes        | Yes          | Yes    | Yes    |
| PostgreSQL | Yes        | Yes    | Yes (read) | Yes          | —      | Yes    |
| SQLite3    | Yes        | Yes    | Yes        | Yes          | —      | Yes    |
| MSSQL      | Planned    | —      | —          | —            | —      | —      |

## Next Steps

- [Install and setup](/guide/install)
- [Usage guide](/guide/usage)
- [Architecture overview](/guide/architecture)
