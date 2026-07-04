import * as assert from "assert";

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
    assert.strictEqual(JSON.parse(serialized).text, "</script><b>&</b>");
  });

  test("serializeScriptValue 转义 U+2028 / U+2029 行分隔符", () => {
    const serialized = serializeScriptValue({ text: "a b c" });
    assert.ok(!serialized.includes(" "), "U+2028 应被转义");
    assert.ok(!serialized.includes(" "), "U+2029 应被转义");
    assert.strictEqual(JSON.parse(serialized).text, "a b c");
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
