# 架构

PPZ Plus 遵循四层架构，从旧 PPZ 代码库重写而来。

## 分层概览

```
presentation → application → domain ← infrastructure
```

### Presentation（`src/presentation`）

VS Code 相关部分：命令、Tree View、Webview 和用户提示。

- 禁止直接包含数据库逻辑
- 负责 VS Code 命令注册和 UI

### Application（`src/application`）

编排领域能力和基础设施能力的用例。

- 协调"打开表数据"、"导出 DDL"等工作流
- 依赖领域模型和基础设施适配器

### Domain（`src/domain`）

数据库无关的模型、任务模型和业务概念。

- 禁止依赖 `vscode`
- 定义连接模型、表元数据、导出格式

### Infrastructure（`src/infrastructure`）

数据库驱动、文件写入、存储适配器等外部细节。

- 隔离在 application 接口之后
- 每种数据库引擎有独立的适配器实现

## 关键边界

| 规则                            | 原因                         |
| ------------------------------- | ---------------------------- |
| Presentation 不能包含数据库逻辑 | 保持 UI 可替换、可测试       |
| Domain 不能依赖 vscode          | 保持业务逻辑可移植           |
| 导入导出是独立子系统            | 防止与树或终端耦合           |
| 不复用旧 PPZ 架构               | 旧代码高耦合，新代码分层清晰 |
| 引擎适配器隔离在接口之后        | 新增数据库只需实现对应适配器 |

## 新增数据库引擎

若要新增数据库引擎（如 MSSQL）：

1. 在 `domain` 中定义引擎能力
2. 在 `infrastructure` 中实现驱动适配器
3. 接入 application 用例
4. 在 `presentation` 中暴露命令

架构设计确保新增引擎不需要修改任何已有引擎的代码。
