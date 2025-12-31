import crypto from "crypto"

export const doEncrypt = (text: string): string => {
  const iv = process.env.IV_KEY
  const encKey = process.env.ENCRYPT_KEY
  if (!iv || !encKey) {
    throw new Error(
      "Missing required environment variables: IV_KEY and ENCRYPT_KEY must be set"
    )
  }

  try {
    const cipher = crypto.createCipheriv("aes-256-cbc", encKey, iv)
    let encrypted = cipher.update(text, "utf8", "base64")
    encrypted += cipher.final("base64")
    return encrypted
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

  // attempt to decrypt, return - if failed
  try {
    const decipher = crypto.createDecipheriv("aes-256-cbc", encKey, iv)
    let decrypted = decipher.update(encrypted, "base64", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error(`Failed to decrypt the text: ${error.message}`)
  }

  return "-"
}
