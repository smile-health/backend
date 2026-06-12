export interface Database {
  password_reset_tokens: PasswordResetToken;
}

export interface PasswordResetToken {
  id: number;
  user_id: string;
  email: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
