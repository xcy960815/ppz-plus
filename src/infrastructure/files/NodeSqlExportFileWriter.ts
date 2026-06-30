import { writeFile } from "node:fs/promises";

import type { SqlExportFileWriter } from "../../application/export/SqlExportFileWriter";

/**
 * 基于 Node.js 文件系统写入 SQL 导出文件。
 */
export class NodeSqlExportFileWriter implements SqlExportFileWriter {
  /**
   * 将 SQL 导出内容以 UTF-8 文本写入指定文件。
   *
   * @param {string} filePath 目标 SQL 文件路径。
   * @param {string} content 需要写入的 SQL 文本内容。
   */
  public async writeText(filePath: string, content: string): Promise<void> {
    await writeFile(filePath, content, "utf8");
  }
}
