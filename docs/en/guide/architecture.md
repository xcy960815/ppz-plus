# Architecture

PPZ Plus follows a four-layer architecture rebuilt from the legacy PPZ codebase.

## Layer Overview

```
presentation → application → domain ← infrastructure
```

### Presentation (`src/presentation`)

VS Code-specific concerns: commands, tree views, webviews, and user-facing presenters.

- Must not contain database logic
- Handles VS Code command registration and UI

### Application (`src/application`)

Use cases that orchestrate domain and infrastructure capabilities.

- Coordinates workflows like "open table data" or "export DDL"
- Depends on domain models and infrastructure adapters

### Domain (`src/domain`)

Database-agnostic models, task models, and business concepts.

- Must not depend on `vscode`
- Defines connection models, table metadata, export formats

### Infrastructure (`src/infrastructure`)

Database driver integration, file writing, storage adapters, and other external details.

- Isolated behind application interfaces
- Each database engine has its own adapter

## Key Boundaries

| Rule                              | Reason                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| Presentation ≠ database logic     | Keeps UI replaceable and testable                             |
| Domain ≠ vscode                   | Keeps business logic portable                                 |
| Import/export is independent      | Prevents coupling to tree or terminal                         |
| No legacy PPZ architecture        | Old code was tightly coupled; new code is layered             |
| Engine adapters behind interfaces | Adding a new database is a matter of implementing the adapter |

## Adding a New Engine

To add support for a new database engine (e.g., MSSQL):

1. Define engine capabilities in `domain`
2. Implement the driver adapter in `infrastructure`
3. Wire up application use cases
4. Expose commands in `presentation`

The architecture is designed so that adding an engine does not require changing any existing engine's code.
