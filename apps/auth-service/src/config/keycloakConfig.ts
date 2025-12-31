import dotenv from "dotenv";

dotenv.config();

export default {
  serverUrl: process.env.KEYCLOAK_SERVER_URL || "http://localhost:8080",
  realm: process.env.KEYCLOAK_REALM || "your-realm",
  clientId: process.env.KEYCLOAK_CLIENT_ID || "your-client",
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
  realmAdminUser: process.env.REALM_SYSUSER_NAME || "sysuser",
  realmAdminPass: process.env.REALM_SYSUSER_PASS || "sysuser",
};
