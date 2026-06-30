import { readFile } from "node:fs/promises";

import type { JsonFileReader } from "../../application/import/JsonFileReader";

/**
 * 基于 Node.js 文件系统读取 JSON 文件。
 */
export class NodeJsonFileReader implements JsonFileReader {
  /**
   * 读取指定 JSON 文件的 UTF-8 文本内容。
   *
   * @param {string} filePath JSON 文件路径。
   * @returns {Promise<string>} JSON 文件文本内容。
   */
  public async readText(filePath: string): Promise<string> {
    return readFile(filePath, "utf8");
  }
}
