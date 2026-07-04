/**
 * 汇集 Webview HTML 生成过程中共享的转义与安全工具。
 *
 * 说明：所有面板统一复用本模块，避免 escapeHtml / serializeScriptValue
 * 在各面板重复实现且转义强度不一致。
 */

/**
 * 转义用户可控文本，使其可安全放入 HTML 文本或属性。
 *
 * @param {string} value 待转义的文本值。
 * @returns {string} 转义后的 HTML 安全字符串。
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * 转义用户可控文本以便安全放入 HTML 属性。
 *
 * @param {string} value 待转义的文本值。
 * @returns {string} 转义后的属性字符串。
 */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

/**
 * 将数据安全序列化为可嵌入 `<script>` 的 JSON 字面量。
 *
 * 采用最严转义：闭合尖括号、`&` 以及行分隔符 U+2028 / U+2029
 * 都会被转成 `\uXXXX`，避免脚本注入与 JSON 解析中断。
 *
 * @param {unknown} value 需要嵌入 Webview 脚本的数据。
 * @returns {string} 经过转义的 JSON 字符串。
 */
export function serializeScriptValue(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}

/**
 * 生成用于 Content-Security-Policy 的一次性 nonce。
 *
 * @returns {string} 32 位十六进制随机串。
 */
export function createWebviewNonce(): string {
  const bytes = new Uint8Array(16);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 构建限制脚本仅可通过 nonce 执行的 Content-Security-Policy meta 标签。
 *
 * @param {string} cspSource Webview 资源来源（`webview.cspSource`）。
 * @param {string} nonce 本次渲染使用的脚本 nonce。
 * @returns {string} 可直接放入 `<head>` 的 CSP meta 标签。
 */
export function buildWebviewCspMeta(cspSource: string, nonce: string): string {
  const directives = [
    "default-src 'none'",
    `style-src ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ];

  return `<meta http-equiv="Content-Security-Policy" content="${directives.join("; ")};" />`;
}
