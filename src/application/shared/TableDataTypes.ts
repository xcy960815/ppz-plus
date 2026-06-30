/**
 * 表示表数据页中渲染的可序列化单元格值。
 */
export type TableCellValue = string | number | boolean | null;

/**
 * 描述表数据页中可见的字段。
 */
export interface TableColumnMetadata {
  readonly name: string;
  readonly dataType: string;
  /**
   * 日期时间字段的小数秒精度。
   */
  readonly dateTimePrecision: number | null;
  readonly nullable: boolean;
  readonly isPrimaryKey: boolean;
  readonly extra: string;
}

/**
 * 描述表数据排序方向。
 */
export type TableSortDirection = "asc" | "desc";

/**
 * 描述表数据排序条件。
 */
export interface TableSortOptions {
  readonly columnName: string;
  readonly direction: TableSortDirection;
}

/**
 * 描述表数据过滤操作符。
 */
export type TableFilterOperator =
  "=" | "!=" | ">" | ">=" | "<" | "<=" | "like" | "in" | "not in" | "null" | "not null";

/**
 * 描述表数据过滤条件值。
 */
export type TableFilterConditionValue = string | readonly string[];

/**
 * 描述表数据单条字段过滤条件。
 */
export interface TableFilterCondition {
  readonly columnName: string;
  readonly operator: TableFilterOperator;
  readonly value?: TableFilterConditionValue;
}

/**
 * 描述表数据过滤条件。
 */
export interface TableFilterOptions {
  readonly keyword?: string;
  readonly conditions?: readonly TableFilterCondition[];
}

/**
 * 描述表数据页查询选项。
 */
export interface TableQueryOptions {
  readonly sort?: TableSortOptions;
  readonly filter?: TableFilterOptions;
}

/**
 * 描述数据流程返回的一页表行。
 */
export interface TableRowPage {
  readonly pageIndex: number;
  readonly pageSize: number;
  /**
   * 当前查询条件下的总行数。
   */
  readonly totalRowCount: number;
  readonly hasNextPage: boolean;
  /**
   * 当前表数据页带分页条件的展示 SQL。
   */
  readonly sql: string;
  /**
   * 当前表数据查询去掉分页条件后的展示 SQL。
   */
  readonly sqlWithoutPagination: string;
  readonly rows: readonly Record<string, TableCellValue>[];
}
