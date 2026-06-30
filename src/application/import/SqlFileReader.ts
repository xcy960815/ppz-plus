/**
 * 向应用层提供 SQL 文件文本读取能力。
 */
export interface SqlFileReader {
  /**
   * 读取指定 SQL 文件的文本内容。
   *
   * @param {string} filePath SQL 文件路径。
   * @returns {Promise<string>} SQL 文件的 UTF-8 文本内容。
   */
  readText(filePath: string): Promise<string>;
}
