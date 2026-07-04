import * as assert from "assert";

import { NodeConnectionSecretCipher } from "../../infrastructure/sync/NodeConnectionSecretCipher";

suite("Infrastructure — 连接同步密码加密器", () => {
  test("使用相同同步密钥可完成加密和解密", async () => {
    const cipher = new NodeConnectionSecretCipher();

    const encryptedSecret = await cipher.encrypt("p@ssw0rd", "sync-key");
    const plaintext = await cipher.decrypt(encryptedSecret, "sync-key");

    assert.strictEqual(plaintext, "p@ssw0rd");
    assert.strictEqual(encryptedSecret.algorithm, "aes-256-gcm");
    assert.strictEqual(encryptedSecret.kdf, "scrypt");
    assert.notStrictEqual(encryptedSecret.ciphertext, "p@ssw0rd");
  });

  test("同步密钥错误时拒绝解密", async () => {
    const cipher = new NodeConnectionSecretCipher();
    const encryptedSecret = await cipher.encrypt("p@ssw0rd", "right-key");

    await assert.rejects(() => cipher.decrypt(encryptedSecret, "wrong-key"));
  });

  test("认证标签被篡改时拒绝解密", async () => {
    const cipher = new NodeConnectionSecretCipher();
    const encryptedSecret = await cipher.encrypt("p@ssw0rd", "sync-key");

    await assert.rejects(() =>
      cipher.decrypt(
        {
          ...encryptedSecret,
          authTag: Buffer.alloc(16, 7).toString("base64"),
        },
        "sync-key",
      ),
    );
  });
});
