---
layout: home

hero:
  name: PPZ Plus
  text: VS Code 数据库导入导出扩展
  tagline: 在编辑器中直接管理 MySQL、PostgreSQL 和 SQLite3 数据库连接 — 浏览结构、执行 SQL、导入导出数据、编辑表行数据。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/install
    - theme: alt
      text: 使用指南
      link: /guide/usage

features:
  - title: 多引擎支持
    details: 连接 MySQL、PostgreSQL 和 SQLite3 数据库，提供统一的资源树和引擎特定的层级结构。
  - title: SQL 终端
    details: 执行查询和非查询 SQL，查看执行耗时，VS Code 重新加载后可恢复终端状态。
  - title: 导入与导出
    details: 导入 SQL/CSV/JSON 文件到 MySQL 表，导出所有支持引擎的 DDL 和 DML，支持批量导出。
  - title: 表数据编辑器
    details: 支持分页、排序、过滤和编辑表行数据，提供带保护限制的新增、编辑、删除和撤销流程。
  - title: 清晰架构
    details: 基于 presentation / application / domain / infrastructure 分层从零重写，告别旧 PPZ 的历史耦合。
  - title: 开发者友好
    details: MIT 开源协议，TypeScript 编写，欢迎贡献。
---

## 什么是 PPZ Plus

PPZ Plus 是一个用于在 VS Code 中操作 MySQL、PostgreSQL 和 SQLite3 数据库的扩展。它不是旧 PPZ 的原地续写，而是一次"能力迁移式重写"：保留旧产品里有价值的工作流，同时用清晰的 `presentation / application / domain / infrastructure` 分层重新实现。

## 数据库支持情况

| 引擎       | 连接   | 浏览 | 表数据       | SQL 终端 | 导入 | 导出 |
| ---------- | ------ | ---- | ------------ | -------- | ---- | ---- |
| MySQL      | 支持   | 支持 | 支持         | 支持     | 支持 | 支持 |
| PostgreSQL | 支持   | 支持 | 支持（只读） | 支持     | —    | 支持 |
| SQLite3    | 支持   | 支持 | 支持         | 支持     | —    | 支持 |
| MSSQL      | 计划中 | —    | —            | —        | —    | —    |

## 下一步

- [安装与配置](/guide/install)
- [使用指南](/guide/usage)
- [架构概览](/guide/architecture)
