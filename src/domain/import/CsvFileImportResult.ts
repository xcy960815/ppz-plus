import type { TableImportResult, TableImportTarget } from "./TableImportResult";

/**
 * 描述 CSV 文件导入的目标表。
 */
export type CsvTableImportTarget = TableImportTarget;

/**
 * 描述 CSV 文件导入执行后的归一化结果。
 */
export type CsvFileImportResult = TableImportResult;
