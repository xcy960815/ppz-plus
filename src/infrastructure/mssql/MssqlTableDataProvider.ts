import type { MssqlConnectionConfig } from "../../domain/connections/ConnectionConfig";
import type {
  TableCellValue,
  TableColumnMetadata,
  TableFilterCondition,
  TableQueryOptions,
  TableRowPage,
} from "../../application/shared/TableDataTypes";
import type { MssqlTableDataProvider as MssqlTableDataProviderContract } from "../../application/mssql/MssqlTableDataProvider";
import { MssqlConnectionAdapter } from "./MssqlConnectionAdapter";
import { MssqlRuntimeLoader } from "./MssqlRuntimeLoader";
import type { MssqlDriverOptions, MssqlRuntimeConnectionPool } from "./MssqlRuntimeTypes";

/**
 * 描述 MSSQL SQL 片段及参数。
 */
interface MssqlQueryFragment {
  readonly sql: string;
  readonly displaySql: string;
  readonly values: readonly unknown[];
}

/**
 * 通过 mssql 驱动读取 MSSQL 表结构和只读分页数据。
 */
export class MssqlTableDataProvider implements MssqlTableDataProviderContract {
  /**
   * 创建基于 mssql 的 MSSQL 表数据提供者。
   *
   * @param mssqlConnectionAdapter 用于归一化连接选项的适配器。
   * @param mssqlRuntimeLoader 用于延迟解析 mssql 运行时的加载器。
   */
  public constructor(
    private readonly mssqlConnectionAdapter: MssqlConnectionAdapter,
    private readonly mssqlRuntimeLoader: MssqlRuntimeLoader,
  ) {}

  /**
   * 列出选中 MSSQL 表的字段。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 表所属的 database。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载字段的表。
   * @returns {Promise<readonly TableColumnMetadata[]>} 归一化后的字段元数据。
   */
  public async listColumns(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableColumnMetadata[]> {
    const pool = await this.openPool(connection, databaseName);

    try {
      return await this.listColumnsWithPool(pool, schemaName, tableName);
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 列出选中 MSSQL 表的一页只读行数据。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 表所属的 database。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载行数据的表。
   * @param {number} pageIndex 从 0 开始的页码。
   * @param {number} pageSize 每页请求的行数。
   * @param {TableQueryOptions} options 排序和过滤等查询选项。
   * @returns {Promise<TableRowPage>} 分页行数据。
   */
  public async listRowPage(
    connection: MssqlConnectionConfig,
    databaseName: string,
    schemaName: string,
    tableName: string,
    pageIndex: number,
    pageSize: number,
    options?: TableQueryOptions,
  ): Promise<TableRowPage> {
    const pool = await this.openPool(connection, databaseName);

    try {
      const normalizedPageIndex = Math.max(pageIndex, 0);
      const columns = await this.listColumnsWithPool(pool, schemaName, tableName);
      const filterClause = this.createFilterClause(columns, options);
      const orderByClause = this.createOrderByClause(columns, options);
      const qualifiedName = this.quoteQualifiedTableName(schemaName, tableName);
      const offset = normalizedPageIndex * pageSize;

      const countSql = [`SELECT COUNT(*) AS totalRowCount FROM ${qualifiedName}`, filterClause.sql]
        .filter((part) => part.length > 0)
        .join(" ");
      const rowSql = [
        `SELECT * FROM ${qualifiedName}`,
        filterClause.sql,
        orderByClause,
        `OFFSET @p${filterClause.values.length + 1} ROWS FETCH NEXT @p${
          filterClause.values.length + 2
        } ROWS ONLY`,
      ]
        .filter((part) => part.length > 0)
        .join(" ");

      const pageValues = [...filterClause.values, offset, pageSize + 1];
      const [countRows, rowRows] = await Promise.all([
        this.runPoolQuery(pool, countSql, filterClause.values),
        this.runPoolQuery(pool, rowSql, pageValues),
      ]);

      return {
        pageIndex: normalizedPageIndex,
        pageSize,
        totalRowCount: this.readTotalRowCount(countRows),
        hasNextPage: rowRows.length > pageSize,
        sql: `${[
          `SELECT * FROM ${qualifiedName}`,
          filterClause.displaySql,
          orderByClause,
          `OFFSET ${offset} ROWS FETCH NEXT ${pageSize + 1} ROWS ONLY`,
        ]
          .filter((part) => part.length > 0)
          .join(" ")};`,
        sqlWithoutPagination: `${[
          `SELECT * FROM ${qualifiedName}`,
          filterClause.displaySql,
          orderByClause,
        ]
          .filter((part) => part.length > 0)
          .join(" ")};`,
        rows: rowRows.slice(0, pageSize).map((row) => this.normalizeRow(row, columns)),
      };
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 复用连接池列出表字段和主键字段。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {string} schemaName 表所属的 schema。
   * @param {string} tableName 需要加载字段的表。
   * @returns {Promise<readonly TableColumnMetadata[]>} 归一化后的字段元数据。
   */
  private async listColumnsWithPool(
    pool: MssqlRuntimeConnectionPool,
    schemaName: string,
    tableName: string,
  ): Promise<readonly TableColumnMetadata[]> {
    const qualifiedName = this.quoteQualifiedTableName(schemaName, tableName);
    const [columnRows, primaryKeyRows] = await Promise.all([
      this.runPoolQuery(pool, this.createColumnsSql(), [qualifiedName]),
      this.runPoolQuery(pool, this.createPrimaryKeysSql(), [qualifiedName]),
    ]);

    return this.normalizeColumnRows(
      columnRows,
      new Set(
        primaryKeyRows
          .map((row) => row.columnName)
          .filter((value): value is string => typeof value === "string"),
      ),
    );
  }

  /**
   * 创建字段元数据查询。
   *
   * @returns {string} sys.columns 字段查询。
   */
  private createColumnsSql(): string {
    return [
      "SELECT c.name AS columnName,",
      "ty.name AS dataType,",
      "c.max_length AS maxLength,",
      "c.precision AS precision,",
      "c.scale AS scale,",
      "c.is_nullable AS isNullable,",
      "dc.definition AS columnDefault,",
      "COLUMNPROPERTY(c.object_id, c.name, 'IsIdentity') AS isIdentity",
      "FROM sys.columns AS c",
      "INNER JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id",
      "LEFT JOIN sys.default_constraints AS dc",
      "ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id",
      "WHERE c.object_id = OBJECT_ID(@p1)",
      "ORDER BY c.column_id",
    ].join(" ");
  }

  /**
   * 创建主键字段查询。
   *
   * @returns {string} 主键字段查询。
   */
  private createPrimaryKeysSql(): string {
    return [
      "SELECT col.name AS columnName",
      "FROM sys.key_constraints AS kc",
      "INNER JOIN sys.index_columns AS ic",
      "ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id",
      "INNER JOIN sys.columns AS col",
      "ON col.object_id = ic.object_id AND col.column_id = ic.column_id",
      "WHERE kc.type = 'PK' AND kc.parent_object_id = OBJECT_ID(@p1)",
      "ORDER BY ic.key_ordinal",
    ].join(" ");
  }

  /**
   * 打开指向目标 database 的连接池。
   *
   * 跨 database 浏览时通过重设连接的 database 建立连接，而不是在 SQL 中拼接
   * 不受控的 database 名称。
   *
   * @param {MssqlConnectionConfig} connection MSSQL 连接配置。
   * @param {string} databaseName 需要连接的目标 database。
   * @returns {Promise<MssqlRuntimeConnectionPool>} 已连接的连接池。
   */
  private async openPool(
    connection: MssqlConnectionConfig,
    databaseName: string,
  ): Promise<MssqlRuntimeConnectionPool> {
    const baseOptions = this.mssqlConnectionAdapter.resolveDriverOptions(connection);
    const options: MssqlDriverOptions = { ...baseOptions, database: databaseName };
    const mssql = await this.mssqlRuntimeLoader.loadMssqlModule();
    const pool = new mssql.ConnectionPool(options);
    await pool.connect();
    return pool;
  }

  /**
   * 通过命名参数在连接池上执行查询。
   *
   * @param {MssqlRuntimeConnectionPool} pool 当前可用的连接池。
   * @param {string} sql 含 @p1..@pN 占位符的查询。
   * @param {readonly unknown[]} values 与占位符对应的参数值。
   * @returns {Promise<ReadonlyArray<Record<string, unknown>>>} 查询返回的行集合。
   */
  private async runPoolQuery(
    pool: MssqlRuntimeConnectionPool,
    sql: string,
    values: readonly unknown[],
  ): Promise<ReadonlyArray<Record<string, unknown>>> {
    const request = pool.request();
    values.forEach((value, index) => {
      request.input(`p${index + 1}`, value);
    });
    const result = await request.query(sql);
    return result.recordset ?? [];
  }

  /**
   * 将 sys.columns 行归一化为字段元数据。
   *
   * @param {readonly Record<string, unknown>[]} rows 驱动返回的原始行值。
   * @param {ReadonlySet<string>} primaryKeyNames 当前表主键字段名集合。
   * @returns {readonly TableColumnMetadata[]} 归一化后的字段元数据。
   */
  private normalizeColumnRows(
    rows: readonly Record<string, unknown>[],
    primaryKeyNames: ReadonlySet<string>,
  ): readonly TableColumnMetadata[] {
    return rows
      .map((row) => {
        const name = row.columnName;
        const dataType = row.dataType;
        if (typeof name !== "string" || typeof dataType !== "string") {
          return undefined;
        }

        const scale = this.readNumberOrNull(row.scale);
        const isIdentity = row.isIdentity === true || row.isIdentity === 1;

        return {
          name,
          dataType: this.formatDataType(dataType, row),
          dateTimePrecision: this.readDateTimePrecision(dataType, scale),
          nullable: row.isNullable === true || row.isNullable === 1,
          isPrimaryKey: primaryKeyNames.has(name),
          extra: isIdentity ? "identity" : this.readDefaultText(row.columnDefault),
        } satisfies TableColumnMetadata;
      })
      .filter((column): column is TableColumnMetadata => column !== undefined);
  }

  /**
   * 格式化字段类型展示文本。
   *
   * @param {string} dataType sys.types 中的类型名。
   * @param {Record<string, unknown>} row sys.columns 原始行。
   * @returns {string} 带长度或精度信息的类型文本。
   */
  private formatDataType(dataType: string, row: Record<string, unknown>): string {
    const scale = this.readNumberOrNull(row.scale) ?? 0;

    if (dataType === "nvarchar" || dataType === "nchar") {
      const maxLength = this.readNumberOrNull(row.maxLength);
      return `${dataType}(${maxLength === null || maxLength < 0 ? "max" : maxLength / 2})`;
    }
    if (dataType === "varchar" || dataType === "char" || dataType === "varbinary") {
      const maxLength = this.readNumberOrNull(row.maxLength);
      return `${dataType}(${maxLength === null || maxLength < 0 ? "max" : maxLength})`;
    }
    if (dataType === "decimal" || dataType === "numeric") {
      const precision = this.readNumberOrNull(row.precision) ?? 18;
      return `${dataType}(${precision}, ${scale})`;
    }
    if (dataType === "datetime2" || dataType === "datetimeoffset" || dataType === "time") {
      return `${dataType}(${scale})`;
    }
    return dataType;
  }

  /**
   * 归一化日期时间字段的小数秒精度。
   *
   * @param {string} dataType 字段类型名。
   * @param {number | null} scale sys.columns 中的 scale。
   * @returns {number | null} 可用于展示截断的小数秒精度。
   */
  private readDateTimePrecision(dataType: string, scale: number | null): number | null {
    if (dataType === "datetime") {
      return 3;
    }
    if (dataType === "datetime2" || dataType === "datetimeoffset" || dataType === "time") {
      return scale ?? 7;
    }
    return null;
  }

  /**
   * 读取字段默认值文本。
   *
   * @param {unknown} value 驱动返回的默认值定义。
   * @returns {string} 默认值文本；缺失时为空字符串。
   */
  private readDefaultText(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  /**
   * 创建过滤 SQL 片段。
   *
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @param {TableQueryOptions} options 查询选项。
   * @returns {MssqlQueryFragment} WHERE 片段和参数。
   */
  private createFilterClause(
    columns: readonly TableColumnMetadata[],
    options?: TableQueryOptions,
  ): MssqlQueryFragment {
    const fragments: MssqlQueryFragment[] = [];
    let nextIndex = 1;
    const keyword = options?.filter?.keyword?.trim();

    if (keyword) {
      const searchableColumns = columns.map((column) => this.quoteIdentifier(column.name));
      if (searchableColumns.length > 0) {
        const value = `%${keyword}%`;
        const conditions = searchableColumns.map(
          (columnSql) => `CAST(${columnSql} AS NVARCHAR(MAX)) LIKE @p${nextIndex}`,
        );
        fragments.push({
          sql: `(${conditions.join(" OR ")})`,
          displaySql: `(${searchableColumns
            .map(
              (columnSql) =>
                `CAST(${columnSql} AS NVARCHAR(MAX)) LIKE ${this.formatSqlLiteral(value)}`,
            )
            .join(" OR ")})`,
          values: [value],
        });
        nextIndex += 1;
      }
    }

    for (const condition of options?.filter?.conditions ?? []) {
      const fragment = this.createConditionClause(columns, condition, nextIndex);
      if (fragment) {
        fragments.push(fragment);
        nextIndex += fragment.values.length;
      }
    }

    return {
      sql:
        fragments.length > 0
          ? `WHERE ${fragments.map((fragment) => fragment.sql).join(" AND ")}`
          : "",
      displaySql:
        fragments.length > 0
          ? `WHERE ${fragments.map((fragment) => fragment.displaySql).join(" AND ")}`
          : "",
      values: fragments.flatMap((fragment) => fragment.values),
    };
  }

  /**
   * 创建单条字段过滤条件 SQL 片段。
   *
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @param {TableFilterCondition} condition 字段过滤条件。
   * @param {number} parameterIndex MSSQL 参数下标。
   * @returns {MssqlQueryFragment | undefined} 可拼接到 WHERE 中的条件片段。
   */
  private createConditionClause(
    columns: readonly TableColumnMetadata[],
    condition: TableFilterCondition,
    parameterIndex: number,
  ): MssqlQueryFragment | undefined {
    const column = columns.find((item) => item.name === condition.columnName);
    if (!column) {
      return undefined;
    }

    const columnSql = this.quoteIdentifier(column.name);
    if (condition.operator === "null" || condition.operator === "not null") {
      const operator = condition.operator === "null" ? "IS NULL" : "IS NOT NULL";
      return {
        sql: `${columnSql} ${operator}`,
        displaySql: `${columnSql} ${operator}`,
        values: [],
      };
    }

    if (condition.operator === "in" || condition.operator === "not in") {
      const values = this.normalizeFilterValueList(condition.value);
      if (values.length === 0) {
        return undefined;
      }

      const placeholders = values.map((_, index) => `@p${parameterIndex + index}`).join(", ");
      const displayValues = values.map((item) => this.formatSqlLiteral(item)).join(", ");
      const operator = condition.operator === "in" ? "IN" : "NOT IN";
      return {
        sql: `${columnSql} ${operator} (${placeholders})`,
        displaySql: `${columnSql} ${operator} (${displayValues})`,
        values,
      };
    }

    const value = this.normalizeFilterScalarValue(condition.value);
    const sqlOperator =
      condition.operator === "!="
        ? "<>"
        : condition.operator === "like"
          ? "LIKE"
          : condition.operator;

    return {
      sql: `${columnSql} ${sqlOperator} @p${parameterIndex}`,
      displaySql: `${columnSql} ${sqlOperator} ${this.formatSqlLiteral(value)}`,
      values: [condition.operator === "like" ? `%${value}%` : value],
    };
  }

  /**
   * 将字段过滤值归一化为非空字符串列表。
   *
   * @param {TableFilterCondition['value']} value Webview 提交的过滤值。
   * @returns {readonly string[]} 可用于 IN / NOT IN 查询的字符串列表。
   */
  private normalizeFilterValueList(value: TableFilterCondition["value"]): readonly string[] {
    const values = typeof value === "string" ? value.split(",") : value === undefined ? [] : value;

    return values.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  /**
   * 将字段过滤值归一化为单个字符串。
   *
   * @param {TableFilterCondition['value']} value Webview 提交的过滤值。
   * @returns {string} 可用于普通比较查询的字符串值。
   */
  private normalizeFilterScalarValue(value: TableFilterCondition["value"]): string {
    if (typeof value === "string") {
      return value;
    }

    if (value === undefined) {
      return "";
    }

    return value[0] ?? "";
  }

  /**
   * 创建排序 SQL 片段。
   *
   * MSSQL 的 OFFSET 分页必须携带 ORDER BY；无排序且无主键时退化为
   * `ORDER BY (SELECT NULL)`。
   *
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @param {TableQueryOptions} options 查询选项。
   * @returns {string} ORDER BY SQL 片段。
   */
  private createOrderByClause(
    columns: readonly TableColumnMetadata[],
    options?: TableQueryOptions,
  ): string {
    const requestedSortColumn = options?.sort
      ? columns.find((column) => column.name === options.sort?.columnName)
      : undefined;
    if (requestedSortColumn) {
      return `ORDER BY ${this.quoteIdentifier(requestedSortColumn.name)} ${
        options?.sort?.direction === "desc" ? "DESC" : "ASC"
      }`;
    }

    const primaryKeyColumns = columns
      .filter((column) => column.isPrimaryKey)
      .map((column) => column.name);
    if (primaryKeyColumns.length > 0) {
      return `ORDER BY ${primaryKeyColumns
        .map((columnName) => this.quoteIdentifier(columnName))
        .join(", ")}`;
    }

    return "ORDER BY (SELECT NULL)";
  }

  /**
   * 将单条行归一化为可序列化的单元格值。
   *
   * @param {Record<string, unknown>} row 驱动返回的原始行。
   * @param {readonly TableColumnMetadata[]} columns 当前表字段元数据。
   * @returns {Record<string, TableCellValue>} 归一化后的行对象。
   */
  private normalizeRow(
    row: Record<string, unknown>,
    columns: readonly TableColumnMetadata[],
  ): Record<string, TableCellValue> {
    const columnsByName = new Map(columns.map((column) => [column.name, column]));
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        this.normalizeCellValue(value, columnsByName.get(key)),
      ]),
    );
  }

  /**
   * 将单个单元格值归一化为可安全 JSON 渲染的值。
   *
   * @param {unknown} value 原始单元格值。
   * @param {TableColumnMetadata} column 当前字段元数据。
   * @returns {TableCellValue} 归一化后的单元格值。
   */
  private normalizeCellValue(value: unknown, column?: TableColumnMetadata): TableCellValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Date) {
      return this.formatDateCellValue(value, column);
    }
    if (Buffer.isBuffer(value)) {
      return `0x${value.toString("hex")}`;
    }
    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * 格式化日期时间单元格。
   *
   * @param {Date} value 原始 Date 值。
   * @param {TableColumnMetadata} column 当前字段元数据。
   * @returns {string} 旧 PPZ 风格的日期时间字符串。
   */
  private formatDateCellValue(value: Date, column?: TableColumnMetadata): string {
    const year = value.getFullYear().toString().padStart(4, "0");
    const month = (value.getMonth() + 1).toString().padStart(2, "0");
    const day = value.getDate().toString().padStart(2, "0");
    const hours = value.getHours().toString().padStart(2, "0");
    const minutes = value.getMinutes().toString().padStart(2, "0");
    const seconds = value.getSeconds().toString().padStart(2, "0");
    const milliseconds = value.getMilliseconds().toString().padStart(3, "0");
    const baseValue = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    if (!column || column.dateTimePrecision === null || column.dateTimePrecision <= 0) {
      return baseValue;
    }

    return `${baseValue}.${milliseconds.slice(0, Math.min(3, column.dateTimePrecision))}`;
  }

  /**
   * 从 COUNT 查询结果中读取总行数。
   *
   * @param {readonly Record<string, unknown>[]} rows 驱动返回的 COUNT 查询行。
   * @returns {number} 当前查询条件下的总行数。
   */
  private readTotalRowCount(rows: readonly Record<string, unknown>[]): number {
    const value = rows[0]?.totalRowCount;
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (typeof value === "string") {
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : 0;
    }
    return 0;
  }

  /**
   * 从原始行中读取数值字段。
   *
   * @param {unknown} value 原始字段值。
   * @returns {number | null} 数值；缺失时为空。
   */
  private readNumberOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  /**
   * 转义 MSSQL 标识符。
   *
   * @param {string} value 原始标识符。
   * @returns {string} 可拼接 SQL 的括号标识符。
   */
  private quoteIdentifier(value: string): string {
    return `[${value.replaceAll("]", "]]")}]`;
  }

  /**
   * 转义 MSSQL schema.table 名称。
   *
   * @param {string} schemaName schema 名称。
   * @param {string} tableName 表名称。
   * @returns {string} 可拼接 SQL 的完整表名。
   */
  private quoteQualifiedTableName(schemaName: string, tableName: string): string {
    return `${this.quoteIdentifier(schemaName)}.${this.quoteIdentifier(tableName)}`;
  }

  /**
   * 格式化展示 SQL 使用的字面量。
   *
   * @param {string} value 原始值。
   * @returns {string} 可读 SQL 字面量。
   */
  private formatSqlLiteral(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
  }

  /**
   * 关闭连接池，关闭失败不覆盖主要查询结果。
   *
   * @param {MssqlRuntimeConnectionPool} pool 需要关闭的连接池。
   */
  private async closePool(pool: MssqlRuntimeConnectionPool): Promise<void> {
    try {
      await pool.close();
    } catch {
      /**
       * 查询结果优先，关闭失败不覆盖主要错误。
       */
    }
  }
}
