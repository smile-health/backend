/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import config from "./config/keycloakConfig";
import { KCUserRoleMap, KeycloakRole } from "./models/KeycloakRole";
import { KeycloakUser } from "./models/keycloakUser";
import logger from "./utils/logger";

class KeycloakClient {
  private readonly serverUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly realmAdminUser: string;
  private readonly realmAdminPass: string;
  private readonly maxRoles: number;
  private adminToken: string | null = null;
  private tokenExpiration: number | null = null;

  constructor() {
    this.serverUrl = config.serverUrl;
    this.realm = config.realm;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.realmAdminUser = config.realmAdminUser;
    this.realmAdminPass = config.realmAdminPass;
    this.maxRoles = 100;
    // Removed _testConnection call from constructor, this asynchronous operation outside of the constructor.
  }

  private async _testConnection() {
    try {
      const response = await axios.get(
        `${this.serverUrl}/realms/${this.realm}`
      );
      logger.info(
        `KeycloakClient._testConnection: Keycloak connection successful: ${response.status}`
      );
    } catch (error) {
      logger.error(
        `KeycloakClient._testConnection: Failed to connect to Keycloak: ${error}`
      );
    }
  }

  private async _getRealmAdminToken(): Promise<string> {
    // If not, get a new token
    try {
      const response = await axios.post(
        `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          client_id: this.clientId,
          grant_type: "password",
          username: this.realmAdminUser,
          password: this.realmAdminPass,
        })
      );
      logger.info(
        `KeycloakClient._getRealmAdminToken: Realm Admin new token received`
      );
      this.adminToken = response.data.access_token;
      this.tokenExpiration = Date.now() + response.data.expires_in * 1000;

      return response.data.access_token;
    } catch (error: any) {
      logger.error(
        `KeycloakClient._getRealmAdminToken: Failed to get realm admin token: ${error}`
      );
      throw new Error("Failed to get realm admin token from Keycloak");
    }
  }

  public async getToken(username: string, password: string): Promise<any> {
    try {
      logger.debug(
        `KeycloakClient.getToken: Requesting token for user: '${username}'`
      );
      const response = await axios.post(
        `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          client_id: this.clientId,
          grant_type: "password",
          username,
          password,
        })
      );
      logger.info(
        `KeycloakClient.getToken: Token received for user: '${username}'`
      );
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        logger.warn(
          `KeycloakClient.getToken: Unauthorized access attempt for user: '${username}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("Unauthorized: Invalid username or password");
      }
      if (error.response && error.response.status === 400) {
        logger.warn(
          `KeycloakClient.getToken: Unsuccessful token access attempt for user: '${username}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error(
          "Bad Request: Failed to get token from Keycloak, check if user is enabled and is configured correctly"
        );
      }
      logger.error(
        `KeycloakClient.getToken: Failed to get token from Keycloak: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error(`Failed to get token from Keycloak, ${error}`);
    }
  }

  public async validateToken(token: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.serverUrl}/realms/${this.realm}/protocol/openid-connect/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      logger.info(`KeycloakClient.validateToken: Token validated successfully`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        logger.warn(
          `KeycloakClient.validateToken: Invalid or expired token provided: ${error}, ${JSON.stringify(error.response.data)}`
        );
        throw new Error("Unauthorized: Invalid or expired token");
      }
      logger.error(
        `KeycloakClient.validateToken: Failed to validate the token: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to validate token");
    }
  }

  public async logoutUser(userId: string): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.post(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      logger.info(`KeycloakClient.logoutUser: User logged out: ${userId}`);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.logoutUser: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.logoutUser: Failed to log out user: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to log out user from Keycloak");
    }
  }

  public async createUser(user: KeycloakUser): Promise<string> {
    try {
      const adminToken = await this._getRealmAdminToken();
      const response = await axios.post(
        `${this.serverUrl}/admin/realms/${this.realm}/users`,
        user,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      const locationHeader = response.headers.location;
      const userId = locationHeader.split("/").pop();
      logger.info(
        `KeycloakClient.createUser: New User created successfully: ${userId}`
      );
      return userId;
    } catch (error: any) {
      logger.error(
        `KeycloakClient.createUser: Failed to create new user: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to create new user in Keycloak");
    }
  }

  public async updateUser(userId: string, user: KeycloakUser): Promise<void> {
    try {
      logger.debug(
        `KeycloakClient.updateUser: Updating user: '${userId}' with details: ${JSON.stringify(user)}`
      );
      const adminToken = await this._getRealmAdminToken();
      await axios.put(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}`,
        user,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(
        `KeycloakClient.updateUser: User updated successfully: ${userId}`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.updateUser: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      if (error.response && error.response.status === 409) {
        logger.warn(
          `KeycloakClient.updateUser: User update conflict: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error(
          `User update conflict in Keycloak, ${JSON.stringify(error.response.data)}`
        );
      }
      if (error.response && error.response.status === 400) {
        logger.warn(
          `KeycloakClient.updateUser: User update failed: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error(
          `Bad request, Error: ${JSON.stringify(error.response.data)}`
        );
      }
      logger.error(
        `KeycloakClient.updateUser: Failed to update user: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to update user in Keycloak");
    }
  }

  public async userExists(
    username: string,
    email?: string
  ): Promise<{ exists: boolean; id?: string }> {
    try {
      logger.debug(
        `KeycloakClient.userExists: Requesting to validate existence for user: '${username}' with email: '${email}'`
      );
      const adminToken = await this._getRealmAdminToken();
      const exact: boolean = true;
      const response = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/users`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          params: {
            username,
            email,
            exact,
          },
        }
      );

      // Using the 'exact' parameter to ensure that we only receive a single user from Keycloak, if it exists
      if (response.data.length > 0) {
        const user = response.data[0];
        logger.info(`KeycloakClient.userExists: User found: '${user.id}'`);
        return { exists: true, id: user.id };
      } else {
        // If the user exists with a different email, return the user with the different email
        const retryResponse = await axios.get(
          `${this.serverUrl}/admin/realms/${this.realm}/users`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`,
            },
            params: {
              username,
              exact,
            },
          }
        );

        if (retryResponse.data.length > 0) {
          const userWithDiffEmail = retryResponse.data[0];
          logger.warn(
            `KeycloakClient.userExists: User found with different email: '${userWithDiffEmail.id}'`
          );
          return { exists: true, id: userWithDiffEmail.id };
        } else {
          logger.info(`KeycloakClient.userExists: User not found`);
          return { exists: false };
        }
      }
    } catch (error: any) {
      logger.error(
        `KeycloakClient.userExists: Failed to check if user exists: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to check if user exists in Keycloak");
    }
  }

  public async getUserById(userId: string): Promise<KeycloakUser> {
    try {
      const adminToken = await this._getRealmAdminToken();

      // Get user details
      const userResponse = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      // Get role mappings
      const roleMappingsResponse = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      logger.info(
        `KeycloakClient.getUserById: User details and role mappings retrieved with ID: ${userId}`
      );

      return new KeycloakUser(userResponse.data, roleMappingsResponse.data);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.getUserById: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `KeycloakClient: Failed to get user by ID: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to get user by ID from Keycloak");
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.delete(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      logger.info(`KeycloakClient.deleteUser: User deleted: '${userId}'`);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.deleteUser: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.deleteUser: Failed to delete user: ${error}, ${JSON.stringify(error.response.data)}`
      );
      throw new Error("Failed to delete user from Keycloak");
    }
  }

  public async getRoles(): Promise<KeycloakRole[]> {
    try {
      const adminToken = await this._getRealmAdminToken();
      const first: number = 0;
      const max: number = this.maxRoles; // Adjust as needed
      const response = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/roles`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          params: {
            first,
            max,
          },
        }
      );
      logger.info(`KeycloakClient.getRoles: Roles retrieved successfully`);
      return response.data.map((role: any) => new KeycloakRole(role));
    } catch (error: any) {
      logger.error(
        `KeycloakClient.getRoles: Failed to retrieve roles: ${error}`
      );
      throw new Error("Failed to retrieve roles from Keycloak");
    }
  }

  public async createRole(role: KeycloakRole): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.post(
        `${this.serverUrl}/admin/realms/${this.realm}/roles`,
        role,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(`KeycloakClient.createRole: Role created: ${role.name}`);
    } catch (error: any) {
      logger.error(
        `KeycloakClient.createRole: Failed to create role: ${error}`
      );
      throw new Error("Failed to create role in Keycloak");
    }
  }

  public async createClientRole(
    clientId: string,
    role: KeycloakRole
  ): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.post(
        `${this.serverUrl}/admin/realms/${this.realm}/clients/${clientId}/roles`,
        role,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(
        `KeycloakClient.createClientRole: Client role created: ${role.name} for client: ${clientId}`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.createClientRole: Client not found: '${clientId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("Client not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.createClientRole: Failed to create client role: ${error}`
      );
      throw new Error("Failed to create client role in Keycloak");
    }
  }

  public async assignRolesToUser(
    userId: string,
    roles: KCUserRoleMap[]
  ): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      const roleMappings = roles;
      await axios.post(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
        roleMappings,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(
        `KeycloakClient.assignRolesToUser: Roles assigned to user: ${userId}`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.assignRolesToUser: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.assignRolesToUser: Failed to assign roles to user: ${error}`
      );
      throw new Error("Failed to assign roles to user in Keycloak");
    }
  }

  public async getUserRoles(userId: string): Promise<KeycloakRole[]> {
    try {
      const adminToken = await this._getRealmAdminToken();
      const response = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      logger.info(
        `KeycloakClient.getUserRoles: Retrieved roles for user: ${userId}`
      );
      logger.debug(response.data);
      return response.data.map((role: any) => new KeycloakRole(role));
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.getUserRoles: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.getUserRoles: Failed to retrieve roles for user: ${error}`
      );
      throw new Error("Failed to retrieve roles for user in Keycloak");
    }
  }

  public async deleteUserRoles(
    userId: string,
    roles: KCUserRoleMap[]
  ): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.delete(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          data: roles,
        }
      );
      logger.info(
        `KeycloakClient.deleteUserRoles: Deleted roles for user: ${userId}`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.deleteUserRoles: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.deleteUserRoles: Failed to delete roles for user: ${error}`
      );
      throw new Error("Failed to delete roles for user in Keycloak");
    }
  }

  public async deleteClientRolesFromUser(
    userId: string,
    clientId: string,
    roles: KCUserRoleMap[]
  ): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.delete(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/clients/${clientId}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          data: roles,
        }
      );
      logger.info(
        `KeycloakClient.deleteClientRolesFromUser: Deleted client roles from user: ${userId} for client: ${clientId}`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.deleteClientRolesFromUser: User or client not found: userId='${userId}', clientId='${clientId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User or client not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.deleteClientRolesFromUser: Failed to delete client roles from user: ${error}`
      );
      throw new Error("Failed to delete client roles from user in Keycloak");
    }
  }

  public async getUserClientRoles(
    userId: string,
    clientId: string
  ): Promise<KeycloakRole[]> {
    try {
      const adminToken = await this._getRealmAdminToken();
      const response = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/clients/${clientId}`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      logger.info(
        `KeycloakClient.getUserClientRoles: Retrieved client roles for user: ${userId} and client: ${clientId}`
      );
      return response.data.map((role: any) => new KeycloakRole(role));
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.getUserClientRoles: User or client not found: userId='${userId}', clientId='${clientId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User or client not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.getUserClientRoles: Failed to retrieve client roles for user: ${error}`
      );
      throw new Error("Failed to retrieve client roles for user in Keycloak");
    }
  }

  public async getClientRoles(clientId: string): Promise<KeycloakRole[]> {
    try {
      const adminToken = await this._getRealmAdminToken();
      const response = await axios.get(
        `${this.serverUrl}/admin/realms/${this.realm}/clients/${clientId}/roles`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      logger.info(
        `KeycloakClient.getClientRoles: Retrieved roles for client: ${clientId}`
      );
      return response.data.map((role: any) => new KeycloakRole(role));
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.getClientRoles: Client not found: '${clientId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("Client not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.getClientRoles: Failed to retrieve roles for client: ${error}`
      );
      throw new Error("Failed to retrieve roles for client in Keycloak");
    }
  }

  public async assignClientRolesToUser(
    userId: string,
    clientId: string,
    roles: KCUserRoleMap[]
  ): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.post(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/clients/${clientId}`,
        roles,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      logger.info(
        `KeycloakClient.assignClientRolesToUser: Client roles assigned to user: ${userId} for client: ${clientId}`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.assignClientRolesToUser: User or client not found: userId='${userId}', clientId='${clientId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User or client not found in Keycloak");
      }
      logger.error(
        `KeycloakClient.assignClientRolesToUser: Failed to assign client roles to user: ${error}`
      );
      throw new Error("Failed to assign client roles to user in Keycloak");
    }
  }

  public async executeActionsEmailForUser(
    userId: string,
    actions: string[]
  ): Promise<void> {
    try {
      const adminToken = await this._getRealmAdminToken();
      await axios.put(
        `${this.serverUrl}/admin/realms/${this.realm}/users/${userId}/execute-actions-email`,
        actions,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          params: {
            client_id: this.clientId,
          },
        }
      );
      logger.info(
        `KeycloakClient.executeActionsEmailForUser: User Actions Email sent: '${userId}'`
      );
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        logger.warn(
          `KeycloakClient.executeActionsEmailForUser: User not found: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("User not found in Keycloak");
      }
      if (error.response && error.response.status === 400) {
        logger.warn(
          `KeycloakClient.executeActionsEmailForUser: Request not valid for user: '${userId}', ${JSON.stringify(error.response.data)}`
        );
        throw new Error("Bad or invalid request received for user in Keycloak");
      }
      logger.error(
        `KeycloakClient.executeActionsEmailForUser: Failed to send actions email for user: ${error}`
      );
      throw new Error("Failed to send actions email for user from Keycloak");
    }
  }
}

const keycloakClient = new KeycloakClient();
keycloakClient["_testConnection"]().catch((error) =>
  logger.error(`KeycloakClient: Failed to test connection: ${error}`)
);

export default keycloakClient;
