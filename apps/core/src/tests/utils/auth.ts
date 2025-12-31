import * as jwt from "jsonwebtoken"
import { JWTPayload } from "@smile/lib/types/jwt.js"
import env from "@/config/env.js"

export const createToken = () => {
  const payload: JWTPayload = {
    account_id: 1,
    role: 1,
    workspaces: [],
  }
  return jwt.sign(payload, env.APP_KEY, { expiresIn: "7d" })
}
