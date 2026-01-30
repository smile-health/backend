import env from "@/config/env.js"
import { JWTPayload } from "@smile-health/lib/types/jwt.js"
import * as jwt from "jsonwebtoken"

export const createToken = (workspaceID: number) => {
  const payload: JWTPayload = {
    account_id: 1,
    role: 1,
    workspaces: [
      {
        id: workspaceID,
        key: "ws",
        name: "ws 1",
        user_id: 100,
        config: {
          material: {
            is_hierarchy_enabled: false,
          }
        },
      },
    ],
  }
  return jwt.sign(payload, env.APP_KEY, { expiresIn: "7d" })
}
