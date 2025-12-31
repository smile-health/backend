export interface UserInfo {
  sub: string;
  resource_access: Map<
    string,
    {
      roles: string[];
    }
  >;
  email_verified: boolean;
  realm_access: {
    roles: string[];
  };
  name: string;
  preferred_username: string;
  appUserId: string;
  given_name: string;
  family_name: string;
  email: string;
  programId: string;
}

export interface AuthDetails {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
  "not-before-policy": number;
  session_state: string;
  scope: string;
}

export interface LoginResponse {
  authDetails: AuthDetails;
}
