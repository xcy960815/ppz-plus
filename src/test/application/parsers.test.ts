import * as assert from "assert";

import { CsvDocumentParser } from "../../application/import/CsvDocumentParser";
import { JsonDocumentParser } from "../../application/import/JsonDocumentParser";
import { ImportColumnMapper } from "../../application/import/ImportColumnMapper";
import type { MySqlTableInsertValue } from "../../application/mysql/MySqlTableDataProvider";

// ---------------------------------------------------------------------------
// CsvDocumentParser
// ---------------------------------------------------------------------------

suite("CsvDocumentParser", () => {
  let parser: CsvDocumentParser;

  setup(() => {
    parser = new CsvDocumentParser();
  });

  test("标准 CSV（含表头 + 数据行）解析正确", () => {
    const doc = parser.parse("name,age\nAlice,30\nBob,25");

    assert.deepStrictEqual(doc.headers, ["name", "age"]);
    assert.strictEqual(doc.rows.length, 2);
    assert.deepStrictEqual(doc.rows[0], { name: "Alice", age: "30" });
    assert.deepStrictEqual(doc.rows[1], { name: "Bob", age: "25" });
  });

  test("包含引号字段的正确解析", () => {
    const doc = parser.parse('name,note\n"Alice","Hello, World"');

    assert.strictEqual(doc.rows[0].name, "Alice");
    assert.strictEqual(doc.rows[0].note, "Hello, World");
  });

  test("引号内的双引号转义正确解析", () => {
    const doc = parser.parse('name,quote\n"Alice","She said ""Hi"""');

    assert.strictEqual(doc.rows[0].quote, 'She said "Hi"');
  });

  test("引号内的换行正确解析", () => {
    const doc = parser.parse('name,desc\n"Alice","Line1\nLine2"');

    assert.strictEqual(doc.rows[0].desc, "Line1\nLine2");
  });

  test("BOM 头自动去除", () => {
    const doc = parser.parse("﻿name,age\nAlice,30");

    assert.strictEqual(doc.headers[0], "name");
    assert.strictEqual(doc.headers[1], "age");
  });

  test("表头字段自动 trim", () => {
    const doc = parser.parse(" name , age \nAlice,30");

    assert.deepStrictEqual(doc.headers, ["name", "age"]);
  });

  test("空 CSV 抛错", () => {
    assert.throws(() => parser.parse(""), /CSV 文件为空/);
  });

  test("只有表头无数据抛错", () => {
    assert.throws(() => parser.parse("name,age"), /不包含数据行/);
  });

  test("重复表头抛错", () => {
    assert.throws(() => parser.parse("name,name\nAlice,30"), /包含重复字段/);
  });

  test("空表头字段名抛错", () => {
    assert.throws(() => parser.parse("name,\nAlice,30"), /不能包含空字段名/);
  });

  test("未闭合引号抛错", () => {
    assert.throws(() => parser.parse('name,desc\n"Alice,Unclosed'), /未闭合的引号/);
  });

  test("列数超过表头抛错", () => {
    assert.throws(() => parser.parse("name,age\nAlice,30,extra"), /字段数超过表头/);
  });

  test("CRLF 行尾正确处理", () => {
    const doc = parser.parse("name,age\r\nAlice,30\r\nBob,25");

    assert.strictEqual(doc.rows.length, 2);
    assert.strictEqual(doc.rows[0].name, "Alice");
  });

  test("空行自动跳过", () => {
    const doc = parser.parse("name,age\n\nAlice,30\n\n");

    assert.strictEqual(doc.rows.length, 1);
    assert.strictEqual(doc.rows[0].name, "Alice");
  });

  test("多字段单行 CSV", () => {
    const doc = parser.parse("id,name,email,active\n1,Alice,alice@test.com,true");

    assert.strictEqual(doc.headers.length, 4);
    assert.strictEqual(doc.rows[0].id, "1");
    assert.strictEqual(doc.rows[0].active, "true");
  });
});

// ---------------------------------------------------------------------------
// JsonDocumentParser
// ---------------------------------------------------------------------------

suite("JsonDocumentParser", () => {
  let parser: JsonDocumentParser;

  setup(() => {
    parser = new JsonDocumentParser();
  });

  test("标准对象数组解析正确", () => {
    const doc = parser.parse('[{"name":"Alice","age":30},{"name":"Bob","age":25}]');

    assert.deepStrictEqual(doc.headers, ["name", "age"]);
    assert.strictEqual(doc.rows.length, 2);
    assert.strictEqual(doc.rows[0].name, "Alice");
    assert.strictEqual(doc.rows[0].age, 30);
    assert.strictEqual(doc.rows[1].name, "Bob");
    assert.strictEqual(doc.rows[1].age, 25);
  });

  test("包含 null/boolean/number 字段", () => {
    const doc = parser.parse('[{"key":"a","val":null,"flag":true,"score":3.14}]');

    assert.strictEqual(doc.rows[0].val, null);
    assert.strictEqual(doc.rows[0].flag, true);
    assert.strictEqual(doc.rows[0].score, 3.14);
  });

  test("不同行有不同字段时合并表头", () => {
    const doc = parser.parse('[{"a":1},{"b":2,"c":3}]');

    assert.deepStrictEqual(doc.headers, ["a", "b", "c"]);
    assert.strictEqual(doc.rows[0].a, 1);
    assert.strictEqual(doc.rows[0].b, undefined);
    assert.strictEqual(doc.rows[1].b, 2);
  });

  test("空 JSON 抛错", () => {
    assert.throws(() => parser.parse("  "), /JSON 文件为空/);
  });

  test("非数组 JSON 抛错", () => {
    assert.throws(() => parser.parse('{"key":"value"}'), /必须是对象数组/);
  });

  test("空数组抛错", () => {
    assert.throws(() => parser.parse("[]"), /不包含数据行/);
  });

  test("嵌套对象抛错", () => {
    assert.throws(() => parser.parse('[{"name":"Alice","meta":{"key":"val"}}]'), /不支持的嵌套值/);
  });

  test("数组元素为非对象抛错", () => {
    assert.throws(() => parser.parse('["string",123]'), /必须是对象/);
  });

  test("非法 JSON 文本抛错", () => {
    assert.throws(() => parser.parse("not json"), /JSON 文件格式无效/);
  });

  test("空字段名抛错", () => {
    assert.throws(() => parser.parse('[{"":"value"}]'), /包含空字段名/);
  });
});

// ---------------------------------------------------------------------------
// ImportColumnMapper
// ---------------------------------------------------------------------------

suite("ImportColumnMapper", () => {
  let mapper: ImportColumnMapper;

  setup(() => {
    mapper = new ImportColumnMapper();
  });

  suite("createDefaultMappings", () => {
    test("同名字段自动映射", () => {
      const mappings = mapper.createDefaultMappings(["id", "name"], ["id", "name", "created_at"]);

      assert.strictEqual(mappings.length, 2);
      assert.deepStrictEqual(mappings[0], { sourceName: "id", targetName: "id" });
      assert.deepStrictEqual(mappings[1], { sourceName: "name", targetName: "name" });
    });

    test("不同名字段 target 为 null", () => {
      const mappings = mapper.createDefaultMappings(["csv_id", "csv_name"], ["id", "name"]);

      assert.strictEqual(mappings.length, 2);
      assert.strictEqual(mappings[0].targetName, null);
      assert.strictEqual(mappings[1].targetName, null);
    });

    test("混合匹配", () => {
      const mappings = mapper.createDefaultMappings(["id", "extra_field"], ["id", "name"]);

      assert.strictEqual(mappings[0].targetName, "id");
      assert.strictEqual(mappings[1].targetName, null);
    });
  });

  suite("normalizeMappings", () => {
    const sourceFields = ["source_a", "source_b"];
    const targetFields = ["target_x", "target_y"];

    test("校验通过", () => {
      const normalized = mapper.normalizeMappings(sourceFields, targetFields, [
        { sourceName: "source_a", targetName: "target_x" },
        { sourceName: "source_b", targetName: "target_y" },
      ]);

      assert.strictEqual(normalized.length, 2);
    });

    test("跳过 target=null 的映射", () => {
      const normalized = mapper.normalizeMappings(sourceFields, targetFields, [
        { sourceName: "source_a", targetName: "target_x" },
        { sourceName: "source_b", targetName: null },
      ]);

      assert.strictEqual(normalized.length, 1);
      assert.strictEqual(normalized[0].sourceName, "source_a");
    });

    test("未知源字段抛错", () => {
      assert.throws(
        () =>
          mapper.normalizeMappings(sourceFields, targetFields, [
            { sourceName: "unknown", targetName: "target_x" },
          ]),
        /未知源字段/,
      );
    });

    test("未知目标字段抛错", () => {
      assert.throws(
        () =>
          mapper.normalizeMappings(sourceFields, targetFields, [
            { sourceName: "source_a", targetName: "unknown_y" },
          ]),
        /未知目标字段/,
      );
    });

    test("重复目标字段抛错", () => {
      assert.throws(
        () =>
          mapper.normalizeMappings(sourceFields, targetFields, [
            { sourceName: "source_a", targetName: "target_x" },
            { sourceName: "source_b", targetName: "target_x" },
          ]),
        /将多个源字段指向了/,
      );
    });

    test("全部跳过抛错", () => {
      assert.throws(
        () =>
          mapper.normalizeMappings(sourceFields, targetFields, [
            { sourceName: "source_a", targetName: null },
            { sourceName: "source_b", targetName: null },
          ]),
        /至少需要映射一个导入字段/,
      );
    });

    test("不传 mappings 时使用默认映射", () => {
      const normalized = mapper.normalizeMappings(["name"], ["name", "age"]);

      assert.strictEqual(normalized.length, 1);
      assert.strictEqual(normalized[0].sourceName, "name");
      assert.strictEqual(normalized[0].targetName, "name");
    });
  });

  suite("mapRows", () => {
    test("按映射转换行数据", () => {
      const rows = [
        { col_a: "v1", col_b: 42 },
        { col_a: "v2", col_b: 99 },
      ];
      const mappedRows = mapper.mapRows(
        rows,
        ["col_a", "col_b"],
        ["field_x", "field_y"],
        [
          { sourceName: "col_a", targetName: "field_x" },
          { sourceName: "col_b", targetName: "field_y" },
        ],
        (row, sourceName) => (row as Record<string, MySqlTableInsertValue>)[sourceName],
      );

      assert.strictEqual(mappedRows.length, 2);
      assert.deepStrictEqual(mappedRows[0], { field_x: "v1", field_y: 42 });
      assert.deepStrictEqual(mappedRows[1], { field_x: "v2", field_y: 99 });
    });

    test("不传 mappings 时使用默认映射", () => {
      const rows = [{ name: "Alice" }];
      const mappedRows = mapper.mapRows(
        rows,
        ["name"],
        ["name"],
        undefined,
        (row, sourceName) => (row as Record<string, MySqlTableInsertValue>)[sourceName],
      );

      assert.strictEqual(mappedRows[0].name, "Alice");
    });
  });

  suite("mapHeaders", () => {
    test("返回目标字段名列表", () => {
      const headers = mapper.mapHeaders(
        ["src_a", "src_b"],
        ["dest_x", "dest_y"],
        [
          { sourceName: "src_a", targetName: "dest_x" },
          { sourceName: "src_b", targetName: "dest_y" },
        ],
      );

      assert.deepStrictEqual(headers, ["dest_x", "dest_y"]);
    });

    test("跳过 target=null 的映射", () => {
      const headers = mapper.mapHeaders(
        ["src_a", "src_b"],
        ["dest_x"],
        [
          { sourceName: "src_a", targetName: "dest_x" },
          { sourceName: "src_b", targetName: null },
        ],
      );

      assert.deepStrictEqual(headers, ["dest_x"]);
    });
  });
});
