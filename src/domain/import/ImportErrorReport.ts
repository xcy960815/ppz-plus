import type { ImportColumnMapping } from "./ImportColumnMapping";

/**
 * 描述导入错误发生的阶段。
 */
export type ImportErrorStage = "mapping" | "preview" | "execution";

/**
 * 描述导入错误报告输入。
 */
export interface ImportErrorReportInput {
  readonly formatName: string;
  readonly fileName: string;
  readonly targetName: string;
  readonly stage: ImportErrorStage;
  readonly errorMessage: string;
  readonly mappings?: readonly ImportColumnMapping[];
}

/**
 * 表示可展示的导入错误报告文档。
 */
export interface ImportErrorReportDocument {
  readonly content: string;
  readonly language: "markdown";
}
