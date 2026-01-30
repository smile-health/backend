import { REGEX_PASS } from "@/common/constants/users.js"
import { Users } from "@/common/infrastructure/database/types/db.js"
import { conditionsMessage } from "@smile-health/lib/zod.js"
import { Selectable } from "kysely"
import z from "zod"

export const LoginSchema = z.object({
  username: z
    .string({ required_error: "Username field is required" })
    .min(4, "Invalid username or password")
    .superRefine((val, c) => {
      conditionsMessage(c, "Username field is required", val.length == 0)
    }),
  password: z
    .string({ required_error: "Password field is required" })
    .min(8, "Invalid username or password")
    .max(255, "Password provided exceeds the maximum length of 255 characters.")
    .superRefine((val, c) => {
      conditionsMessage(c, "Password field is required", val.length == 0)
    }),
  fcm_token: z.string().optional(),
  create: z.boolean().default(false),
})

export const ChangePasswordSchema = LoginSchema.pick({
  password: true,
})
  .extend({
    new_password: z
      .string({ required_error: "New Password field is required" })
      .min(8, "Password must be at least 8 characters")
      .max(
        255,
        "Password provided exceeds the maximum length of 255 characters."
      ),
    password_confirmation: z
      .string({ required_error: "Password Confirmation field is requried" })
      .min(8, "Password must be at least 8 characters")
      .max(
        255,
        "Password provided exceeds the maximum length of 255 characters."
      ),
  })
  .superRefine((val, c) => {
    conditionsMessage(
      c,
      "Password Confirmation must be same",
      val.new_password != val.password_confirmation
    )
    // conditionsMessage(
    //   c,
    //   "Password is already used",
    //   val.new_password == DEFAULT_PASS
    // )
    conditionsMessage(
      c,
      "Password must be contain number, lowercase, uppercase, special characters and minimum length is 8",
      !REGEX_PASS.test(val.new_password) || val.new_password.length < 8
    )
    conditionsMessage(
      c,
      "Old Password and New Password must be different",
      val.password === val.new_password
    )
  })

export const LoginAttemptSchema = z.object({
  id: z
    .string()
    .transform((nm) => Number(nm))
    .optional(),
  ip: z.string().nullable().optional(),
  hit: z.number().optional(),
  last_attempt: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  created_at: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  updated_at: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
})

export type LoginRequest = z.infer<typeof LoginSchema>
export type ChangePasswordRequest = Partial<
  z.infer<typeof ChangePasswordSchema>
>

export type LoginAttemptDto = z.infer<typeof LoginAttemptSchema>
export type UserDto = Selectable<Users>
