import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "crypto";
import { promisify } from "util";

import type { ConnectionSecretCipher } from "../../application/connections/ConnectionSecretCipher";
import type { EncryptedConnectionSecret } from "../../application/connections/ConnectionSyncPayload";

/**
 * 使用 Node.js crypto 为账号同步中的连接密码加解密。
 */
export class NodeConnectionSecretCipher implements ConnectionSecretCipher {
  /**
   * 保存 scrypt 异步函数。
   */
  private readonly scryptAsync = promisify(scrypt);

  /**
   * 使用 AES-256-GCM 加密连接密码。
   *
   * @param {string} plaintext 明文密码。
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<EncryptedConnectionSecret>} 可同步的密码密文。
   */
  public async encrypt(plaintext: string, syncKey: string): Promise<EncryptedConnectionSecret> {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await this.deriveKey(syncKey, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      algorithm: "aes-256-gcm",
      kdf: "scrypt",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  }

  /**
   * 使用 AES-256-GCM 解密连接密码。
   *
   * @param {EncryptedConnectionSecret} encryptedSecret 密码密文。
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<string>} 明文密码。
   */
  public async decrypt(
    encryptedSecret: EncryptedConnectionSecret,
    syncKey: string,
  ): Promise<string> {
    this.assertSupportedSecret(encryptedSecret);
    const salt = Buffer.from(encryptedSecret.salt, "base64");
    const iv = Buffer.from(encryptedSecret.iv, "base64");
    const authTag = Buffer.from(encryptedSecret.authTag, "base64");
    const ciphertext = Buffer.from(encryptedSecret.ciphertext, "base64");
    const key = await this.deriveKey(syncKey, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }

  /**
   * 从同步密钥和随机盐派生 32 字节 AES 密钥。
   *
   * @param {string} syncKey 用户输入的同步密钥。
   * @param {Buffer} salt 随机盐。
   * @returns {Promise<Buffer>} 派生后的密钥。
   */
  private async deriveKey(syncKey: string, salt: Buffer): Promise<Buffer> {
    const key = await this.scryptAsync(syncKey, salt, 32);
    return key as Buffer;
  }

  /**
   * 确认密文格式属于当前实现支持的算法。
   *
   * @param {EncryptedConnectionSecret} encryptedSecret 密码密文。
   */
  private assertSupportedSecret(encryptedSecret: EncryptedConnectionSecret): void {
    if (encryptedSecret.algorithm !== "aes-256-gcm" || encryptedSecret.kdf !== "scrypt") {
      throw new Error("暂不支持当前连接密码密文格式。");
    }
  }
}
