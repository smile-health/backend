import crypto from "crypto"

export type EncrypterConfig = {
  key: Buffer | string
  iv: Buffer | string
}

export const createEncrypter = ({ key, iv }: EncrypterConfig) => {
  const k = key
  const i = iv

  const encrypt = (text: string): string => {
    const cipher = crypto.createCipheriv("aes-256-cbc", k, i)
    let encrypted = cipher.update(text, "utf8", "base64")
    encrypted += cipher.final("base64")
    return encrypted
  }

  const decrypt = (encrypted: string): string => {
    try {
      const decipher = crypto.createDecipheriv("aes-256-cbc", k, i)
      let decrypted = decipher.update(encrypted, "base64", "utf8")
      decrypted += decipher.final("utf8")
      return decrypted
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error(`Failed to decrypt the text: ${error.message}`)
      return "-"
    }
  }

  return { encrypt, decrypt }
}

// Lazy env-based helpers for convenience. Keep behavior similar to main.
export const doEncrypt = (text: string): string => {
  const iv = process.env.IV_KEY
  const encKey = process.env.ENCRYPT_KEY
  if (!iv || !encKey) {
    throw new Error(
      "Missing required environment variables: IV_KEY and ENCRYPT_KEY must be set"
    )
  }
  try {
    const { encrypt } = createEncrypter({ key: encKey, iv })
    return encrypt(text)
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`Failed to encrypt the text: ${error.message}`)
  }
}

export const doDecrypt = (encrypted: string): string => {
  const iv = process.env.IV_KEY
  const encKey = process.env.ENCRYPT_KEY
  if (!iv || !encKey) {
    throw new Error(
      "Missing required environment variables: IV_KEY and ENCRYPT_KEY must be set"
    )
  }
  const { decrypt } = createEncrypter({ key: encKey, iv })
  return decrypt(encrypted)
}
