/**
 * 向应用层提供 SQL 导出文件写入能力。
 */
export interface SqlExportFileWriter {
  /**
   * 将 SQL 导出内容写入指定文件。
   *
   * @param {string} filePath 目标文件路径。
   * @param {string} content 需要写入的 SQL 文本内容。
   */
  writeText(filePath: string, content: string): Promise<void>;
}
