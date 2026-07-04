import * as assert from "assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  buildWebviewCspMeta,
  createWebviewNonce,
  escapeHtml,
  escapeHtmlAttribute,
  serializeScriptValue,
} from "../../presentation/shared/WebviewHtml";

suite("Presentation — WebviewHtml 转义工具", () => {
  test("escapeHtml 覆盖全部 HTML 敏感字符", () => {
    assert.strictEqual(
      escapeHtml(`<img src=x onerror="alert('&')">`),
      "&lt;img src=x onerror=&quot;alert(&#39;&amp;&#39;)&quot;&gt;",
    );
  });

  test("escapeHtmlAttribute 与 escapeHtml 行为一致", () => {
    const sample = `a"b'c<d>e&f`;
    assert.strictEqual(escapeHtmlAttribute(sample), escapeHtml(sample));
  });

  test("serializeScriptValue 转义闭合标签与 & 防止脚本注入", () => {
    const serialized = serializeScriptValue({ text: "</script><b>&</b>" });
    assert.ok(!serialized.includes("</script>"), "不得包含可闭合的 script 标签");
    assert.ok(!serialized.includes("<"), "尖括号应被转义");
    assert.ok(!serialized.includes("&"), "& 应被转义为 \\u0026");
    // 仍应是可被 JSON.parse 还原的合法 JSON。
    const parsed = JSON.parse(serialized) as { readonly text: string };
    assert.strictEqual(parsed.text, "</script><b>&</b>");
  });

  test("serializeScriptValue 转义 U+2028 / U+2029 行分隔符", () => {
    const lineSeparator = String.fromCharCode(0x2028);
    const paragraphSeparator = String.fromCharCode(0x2029);
    const value = `a${lineSeparator}b${paragraphSeparator}c`;
    const serialized = serializeScriptValue({ text: value });

    assert.ok(!serialized.includes(lineSeparator), "U+2028 应被转义");
    assert.ok(!serialized.includes(paragraphSeparator), "U+2029 应被转义");
    const parsed = JSON.parse(serialized) as { readonly text: string };
    assert.strictEqual(parsed.text, value);
  });

  test("serializeScriptValue 对顶层 undefined 归一为 null", () => {
    assert.strictEqual(serializeScriptValue(undefined), "null");
  });

  test("createWebviewNonce 生成 32 位十六进制且每次不同", () => {
    const first = createWebviewNonce();
    const second = createWebviewNonce();
    assert.match(first, /^[0-9a-f]{32}$/);
    assert.notStrictEqual(first, second);
  });

  test("buildWebviewCspMeta 使用 nonce 且不含 unsafe-inline 脚本", () => {
    const meta = buildWebviewCspMeta("vscode-webview://abc", "deadbeef");
    assert.ok(meta.includes("script-src 'nonce-deadbeef'"));
    assert.ok(meta.includes("default-src 'none'"));
    assert.ok(!meta.includes("script-src 'unsafe-inline'"), "脚本不得允许 unsafe-inline");
    assert.ok(meta.includes("vscode-webview://abc"), "style/img 源应包含 cspSource");
  });
});

suite("Presentation — Webview HTML 静态安全检查", () => {
  test("Webview 模板不应回退到 inline handler、裸 script 或 javascript URI", () => {
    const presentationFiles = listTypeScriptFiles(
      join(process.cwd(), "src", "presentation"),
    ).filter((filePath) => !filePath.endsWith(join("shared", "WebviewHtml.ts")));

    for (const filePath of presentationFiles) {
      const content = readFileSync(filePath, "utf8");
      assert.ok(
        !/\son(?:click|change|input|submit|keydown|keyup|load|error)=/i.test(content),
        `${filePath} 不应包含 inline event handler`,
      );
      assert.ok(!/javascript:/i.test(content), `${filePath} 不应包含 javascript: URI`);
      assert.ok(
        !/<script(?![^>]*\bnonce=)/i.test(content),
        `${filePath} 不应包含未挂 nonce 的脚本`,
      );
    }
  });

  test("表数据页 data-action 均应接入委托处理器", () => {
    const filePath = join(
      process.cwd(),
      "src",
      "presentation",
      "tableData",
      "DatabaseTableDataPanel.ts",
    );
    const content = readFileSync(filePath, "utf8");
    const actionNames = Array.from(content.matchAll(/data-action="([^"]+)"/g), (match) => match[1]);
    const handlerBlock = content.match(/const dataActionHandlers = \{([\s\S]*?)\n\s*\};/);

    assert.ok(handlerBlock, "应保留 dataActionHandlers 委托处理器表");

    const handledActions = new Set(
      Array.from(handlerBlock[1].matchAll(/\n\s*([a-zA-Z][\w]*):\s*\(/g), (match) => match[1]),
    );

    for (const actionName of actionNames) {
      assert.ok(handledActions.has(actionName), `${actionName} 缺少委托处理器`);
    }
  });
});

/**
 * 递归列出指定目录下的 TypeScript 源文件。
 *
 * @param {string} directory 需要扫描的目录。
 * @returns {string[]} TypeScript 文件路径列表。
 */
function listTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
      continue;
    }

    if (entryPath.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}
