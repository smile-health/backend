/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTPError } from "@smile-health/lib/error";
import { USER_ROLES } from "../constants";
import keycloakClient from "../keycloakClient";
import { KCUserRoleMap, KeycloakRole } from "../models/KeycloakRole";
import { KeycloakUser } from "../models/keycloakUser";
import { AuthDetails, UserInfo } from "../schemas/authSchemas";
import { CreateUser, UpdateUser, User } from "../schemas/userSchemas";
import userServiceClient from "../userServiceClient";
import logger from "../utils/logger";

class AppService {
  private _isUserMultipleSession(username: string): boolean {
    const envValue = process.env.USER_MULTIPLE_SESSION;
    if (envValue) {
      return envValue
        .split(",")
        .map((val) => val.trim().toLowerCase())
        .includes(username.toLowerCase());
    }
    return false;
  }

  private async _mapRolesToUser(
    userId: string,
    roles: string[],
    clientId?: string
  ): Promise<void> {
    try {
      let existingRoles: KeycloakRole[];
      let roleNamesList: string[];

      if (clientId) {
        // Handle client roles
        logger.debug(
          `AppService._mapRolesToUser: Getting available roles for client: '${clientId}'`
        );
        existingRoles = await keycloakClient.getClientRoles(clientId);
        roleNamesList = existingRoles.map((role: KeycloakRole) => role.name);
        logger.debug(
          `AppService._mapRolesToUser: Available client roles: '${roleNamesList}'`
        );
      } else {
        // Handle realm roles
        logger.debug(
          `AppService._mapRolesToUser: Getting available roles in realm`
        );
        existingRoles = await keycloakClient.getRoles();
        roleNamesList = existingRoles.map((role: KeycloakRole) => role.name);
        logger.debug(
          `AppService._mapRolesToUser: Available roles in realm: '${roleNamesList}'`
        );
      }

      // Step 2: Check and create roles if necessary
      let isNewRoleCreated: boolean = false;
      for (const role of roles) {
        if (!roleNamesList.includes(role)) {
          logger.warn(
            `AppService._mapRolesToUser: Role: '${role}' not found, creating...`
          );
          const newRole: KeycloakRole = new KeycloakRole();
          newRole.name = role;
          newRole.description = `Role created by the auth-service for users`;

          if (clientId) {
            await keycloakClient.createClientRole(clientId, newRole);
          } else {
            await keycloakClient.createRole(newRole);
          }

          logger.info(`AppService._mapRolesToUser: Role created: '${role}'`);
          isNewRoleCreated = true;
        }
      }

      // Step 3: prepare user roles map for mapping from updated existing roles
      if (isNewRoleCreated) {
        logger.debug(`AppService._mapRolesToUser: Getting updated roles`);
        existingRoles = clientId
          ? await keycloakClient.getClientRoles(clientId)
          : await keycloakClient.getRoles();
        logger.debug(
          `AppService._mapRolesToUser: Updated roles: '${JSON.stringify(existingRoles)}'`
        );
      }

      const userRolesMap: KCUserRoleMap[] = [];
      roles.forEach((role: string) => {
        for (const existingRole of existingRoles) {
          if (existingRole.name === role) {
            userRolesMap.push({
              id: existingRole.id!,
              name: existingRole.name,
            });
            break;
          }
        }
      });
      logger.debug(
        `AppService._mapRolesToUser: User roles map for assigning: '${JSON.stringify(userRolesMap)}'`
      );

      // Step 4: Map roles to user
      if (clientId) {
        await keycloakClient.assignClientRolesToUser(
          userId,
          clientId,
          userRolesMap
        );
      } else {
        await keycloakClient.assignRolesToUser(userId, userRolesMap);
      }
      logger.info(
        `AppService._mapRolesToUser: Roles mapped to user: '${userId}'`
      );
    } catch (error: any) {
      logger.error(
        `AppService._getKCRoleMaps4User: Internal server error during role mapping for user: '${userId}', ${error}`
      );
      throw new Error("Error occured during role mapping");
    }
  }

  public async login(
    username: string,
    password: string,
    deviceType?: string
  ): Promise<AuthDetails> {
    // First validate if user exists in SMILE database
    const smileUserValidation =
      await userServiceClient.validateUserExists(username);

    if (!smileUserValidation.exists) {
      logger.warn(
        `AppService.login: User not found in SMILE database: '${username}'`
      );
      throw new HTTPError("auth.not_found", 404);
    }

    // Validate device type for operator users
    const userRole = smileUserValidation.user?.role_label;
    if (
      userRole &&
      (userRole === USER_ROLES.OPERATOR ||
        userRole === USER_ROLES.OPERATOR_COVID) &&
      (deviceType === "web" || deviceType === "monitor")
    ) {
      logger.warn(
        `AppService.login: Operator user '${username}' attempted to login from web/monitor device`
      );
      throw new HTTPError("auth.allowed_mobile", 403);
    }

    if (
      userRole &&
      (userRole === USER_ROLES.SUPERADMIN || userRole === USER_ROLES.ADMIN) &&
      deviceType === "mobile"
    ) {
      logger.warn(
        `AppService.login: Admin user '${username}' attempted to login from mobile`
      );
      throw new HTTPError("auth.allowed_web", 403);
    }

    // Then check if user exists in Keycloak
    const userExistsResult = await keycloakClient.userExists(username);

    if (!userExistsResult.exists) {
      // If user doesn't exist in Keycloak, try to login to core service first
      try {
        logger.info(
          `AppService.login: User not found in Keycloak, attempting core login for: '${username}'`
        );
        // Attempt to login to core service, it will create the keycloak user from there
        await userServiceClient.login(username, password);
      } catch (error) {
        logger.error(`AppService.login: Core login failed: ${error}`);
        throw new HTTPError("auth.invalid", 401);
      }
    }

    try {
      logger.info(`AppService.login: Login attempt for user: '${username}'`);

      if (
        userExistsResult.exists &&
        userExistsResult.id &&
        !this._isUserMultipleSession(username)
      ) {
        // Clear all previous sessions by logging out the user
        try {
          await keycloakClient.logoutUser(userExistsResult.id);
          logger.info(
            `AppService.login: Cleared previous sessions for user: '${username}'`
          );
        } catch (logoutError) {
          logger.warn(
            `AppService.login: Failed to clear previous sessions for user: '${username}': ${logoutError}`
          );
          // Proceed anyway to get token
        }
      }

      const token: AuthDetails = await keycloakClient.getToken(
        username,
        password
      );
      logger.info(`AppService.login: Login successful for user: '${username}'`);
      return token;
    } catch (error: any) {
      if (error.message.includes("Unauthorized")) {
        logger.warn(
          `AppService.login: Unauthorized login attempt for user: '${username}'`
        );
        throw new HTTPError("auth.invalid", 401);
      }
      if (error.message.includes("Bad Request")) {
        logger.warn(
          `AppService.login: Unsuccessful login attempt for user: '${username}'`
        );
        throw new HTTPError("auth.account_inactive", 400);
      }
      logger.error(
        `AppService.login: Internal server error during login for user: '${username}', ${error}`
      );
      throw new Error("Internal server error");
    }
  }

  public async validateToken(token: string): Promise<UserInfo> {
    try {
      logger.debug(`AppService.validateToken: Validating token: '${token}'`);
      const userInfo: UserInfo = await keycloakClient.validateToken(token);
      logger.info(
        `AppService.validateToken: Token validated successfully for user: '${userInfo.sub}'`
      );
      return userInfo;
    } catch (error: any) {
      if (error.message.includes("Unauthorized")) {
        logger.warn(
          `AppService.validateToken: Unauthorized token validation: ${error}`
        );
        throw new Error("Unauthorized: Invalid or expired token");
      }
      logger.error(
        `AppService.validateToken: Internal server error during token validation, ${error}`
      );
      throw new Error("Internal server error");
    }
  }

  public async logoutUser(token: string): Promise<void> {
    let userId: string = "";
    try {
      const userInfo = await this.validateToken(token);
      logger.debug(
        `AppService.logoutUser: Validated token for user: '${userInfo.sub}' with details: '${JSON.stringify(userInfo)}'`
      );
      userId = userInfo.sub;
      await keycloakClient.logoutUser(userId);
      logger.info(
        `AppService.logoutUser: User logged out successfully: '${userId}'`
      );
    } catch (error: any) {
      if (error.message.includes("Unauthorized")) {
        logger.warn(
          `AppService.logoutUser: Unauthorized token validation: ${error}`
        );
        throw new Error("Unauthorized: Invalid or expired token");
      }
      if (error.message.includes("User not found")) {
        logger.warn(`AppService.logoutUser: User not found: '${userId}'`);
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `AppService.logoutUser: Internal server error during token validation, ${error}`
      );
      throw new Error("Internal server error");
    }
  }

  public async createUser(user: CreateUser): Promise<string> {
    logger.info(
      `AppService.createUser: Creating user: '${user.username}' with email: '${user.email}'`
    );
    const newKCUser: KeycloakUser = new KeycloakUser(user);
    newKCUser.realmRoles = user.roles;
    try {
      // Step 1: Create the user
      const newUserId: string = await keycloakClient.createUser(newKCUser);
      logger.debug(
        `AppService.createUser: User created successfully: '${newUserId}', now will map roles if present`
      );

      // Step 2: manage and Map user roles if present
      if (user.roles && user.roles.length > 0) {
        logger.debug(
          `AppService.createUser: Mapping roles for user: '${newUserId}', roles: '${user.roles}'`
        );
        await this._mapRolesToUser(newUserId, user.roles);
        logger.info(
          `AppService.createUser: Roles mapped to user: '${newUserId}'`
        );
      }

      // Step 3: manage and Map user client roles if present
      if (user.clients && user.clients.length > 0) {
        for (const client of user.clients) {
          logger.debug(
            `AppService.createUser: Mapping client roles for user: '${newUserId}', client: '${client.id}', roles: '${client.roles}'`
          );
          await this._mapRolesToUser(newUserId, client.roles, client.id);
          logger.info(
            `AppService.createUser: Client roles mapped to user: '${newUserId}'`
          );
        }
      }

      logger.info(
        `AppService.createUser: User created successfully: '${newUserId}'`
      );
      return newUserId;
    } catch (error: any) {
      logger.error(
        `AppService.createUser: Failed to create new user: ${error}`
      );
      throw new Error(
        "Internal server error: Failed to create new user in Keycloak"
      );
    }
  }

  public async updateUser(userId: string, user: UpdateUser): Promise<void> {
    logger.info(`AppService.updateUser: Updating user: '${userId}'`);
    logger.debug(
      `AppService.updateUser: User details: ${JSON.stringify(user)}`
    );
    const kcUser: KeycloakUser = new KeycloakUser(user);
    kcUser.realmRoles = user.roles;
    try {
      await keycloakClient.updateUser(userId, kcUser);
      logger.info(
        `AppService.updateUser: User details updated successfully for user: '${userId}'`
      );

      // Step 2: manage and Map user roles if present
      if (user.roles && user.roles.length > 0) {
        logger.info(
          `AppService.updateUser: Updating roles for user: '${userId}'`
        );

        // Step 2.1: Get the roles associated with user and delete them
        const existingRoles4User: KeycloakRole[] =
          await keycloakClient.getUserRoles(userId);
        logger.debug(
          `AppService.updateUser: Roles associated with user: '${JSON.stringify(existingRoles4User)}'`
        );
        const userExistingRolesMap: KCUserRoleMap[] = [];

        existingRoles4User.forEach((role: KeycloakRole) => {
          if (!(role.name === "default-roles-smile" && role.composite)) {
            userExistingRolesMap.push({
              id: role.id!,
              name: role.name,
            });
          }
        });
        logger.debug(
          `AppService.updateUser: Existing roles for user: '${JSON.stringify(userExistingRolesMap)}'`
        );

        await keycloakClient.deleteUserRoles(userId, userExistingRolesMap);
        logger.info(
          `AppService.updateUser: Existing roles deleted successfully for user: '${userId}'`
        );

        // Step 2.2: Map roles to user
        logger.debug(
          `AppService.updateUser: Mapping roles for user: '${userId}' roles: '${user.roles}'`
        );
        await this._mapRolesToUser(userId, user.roles);
        logger.info(
          `AppService.updateUser: Roles mapped successfully for user: '${userId}'`
        );
      }

      // Step 3: manage and Map user client roles if present
      if (user.clients && user.clients.length > 0) {
        logger.info(
          `AppService.updateUser: Updating client roles for user: '${userId}'`
        );

        // Step 3.1: Get client roles associated with user and delete them
        for (const client of user.clients) {
          const existingRoles4User: KeycloakRole[] =
            await keycloakClient.getUserClientRoles(userId, client.id);
          logger.debug(
            `AppService.updateUser: Client roles associated with user: '${JSON.stringify(existingRoles4User)}'`
          );
          const userExistingRolesMap: KCUserRoleMap[] = [];

          existingRoles4User.forEach((role: KeycloakRole) => {
            if (!(role.name === "default-roles-smile" && role.composite)) {
              userExistingRolesMap.push({
                id: role.id!,
                name: role.name,
              });
            }
          });
          logger.debug(
            `AppService.updateUser: Existing client roles for user: '${JSON.stringify(userExistingRolesMap)}'`
          );

          await keycloakClient.deleteClientRolesFromUser(
            userId,
            client.id,
            userExistingRolesMap
          );
          logger.info(
            `AppService.updateUser: Existing client roles deleted successfully for user: '${userId}'`
          );

          // Step 3.2: Map roles to user
          logger.debug(
            `AppService.updateUser: Mapping client roles for user: '${userId}', client: '${client.id}', roles: '${client.roles}'`
          );
          await this._mapRolesToUser(userId, client.roles, client.id);
          logger.info(
            `AppService.updateUser: Client roles mapped successfully for user: '${userId}'`
          );
        }
      }
    } catch (error: any) {
      if (error.message.includes("User not found")) {
        logger.warn(`AppService.updateUser: User not found: '${userId}'`);
        throw new Error("User not found in Keycloak");
      }
      if (error.message.includes("User update conflict")) {
        logger.warn(
          `AppService.updateUser: User update failed: '${userId}', ${error.message}`
        );
        throw new Error(`Conflict while updating user: ${error.message}`);
      }
      if (error.message.includes("Bad request")) {
        logger.warn(
          `AppService.updateUser: Bad request for user update: '${userId}', ${error.message}`
        );
        throw new Error(
          `Bad request for user update from keycloak ${error.message}`
        );
      }
      logger.error(`AppService.updateUser: Failed to update user: ${error}`);
      throw new Error(
        "Internal server error: Failed to update user in Keycloak"
      );
    }
  }

  public async checkUserExists(
    username: string,
    email?: string
  ): Promise<{ exists: boolean; id?: string }> {
    try {
      logger.info(
        `AppService.checkUserExists: checking existence for user: '${username}'`
      );
      const result = await keycloakClient.userExists(username, email);
      if (result.exists) {
        logger.info(
          `AppService.checkUserExists: User '${username}' already exists with ID: '${result.id}'`
        );
        return { exists: true, id: result.id };
      } else {
        logger.info(
          `AppService.checkUserExists: User '${username}' doesn not exists`
        );
        return { exists: false };
      }
    } catch (error: any) {
      logger.error(
        `AppService.checkUserExists: Internal server error during check for user exists: '${username}', ${error}`
      );
      throw new Error("Internal server error");
    }
  }

  public async getUserById(userId: string): Promise<User> {
    try {
      logger.info(
        `AppService.getUserById: Getting user details for ID: '${userId}'`
      );
      const userDetails: KeycloakUser =
        await keycloakClient.getUserById(userId);

      const user: User = userDetails.toUser();
      logger.debug(
        `AppService.getUserById: User details retrieved with ID: '${userId}', ${JSON.stringify(user)}`
      );
      return user;
    } catch (error: any) {
      if (error.message.includes("User not found")) {
        logger.warn(`AppService.getUserById: User not found: '${userId}'`);
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `AppService.getUserById: Internal server error during getting user by ID: '${userId}', ${error}`
      );
      throw new Error("Internal server error");
    }
  }

  public async deleteUser(userId: string): Promise<void> {
    try {
      logger.info(`AppService.deleteUser: Deleting user: '${userId}'`);
      return keycloakClient.deleteUser(userId);
    } catch (error: any) {
      if (error.message.includes("User not found")) {
        logger.warn(`AppService.deleteUser: User not found: '${userId}'`);
        throw new Error("User not found in Keycloak");
      }
      logger.error(
        `AppService.deleteUser: Internal server error during deletion for user: '${userId}', ${error}`
      );
      throw new Error("Internal server error");
    }
  }

  public async sendUpdatePwdActionEmailToUser(userId: string): Promise<void> {
    try {
      logger.info(
        `AppService.sendUpdatePwdActionEmailToUser: Sending Update Password Action email to user: '${userId}'`
      );
      const actions = ["UPDATE_PASSWORD"];
      return keycloakClient.executeActionsEmailForUser(userId, actions);
    } catch (error: any) {
      if (error.message.includes("User not found")) {
        logger.warn(
          `AppService.sendUpdatePwdActionEmailToUser: User not found: '${userId}', Error: ${error}`
        );
        throw new Error("User not found in Keycloak");
      }
      if (error.message.includes("Bad or invalid request")) {
        logger.warn(
          `AppService.sendUpdatePwdActionEmailToUser: Bad request for user action email. User: '${userId}', Error: ${error.message}`
        );
        throw new Error(
          `Bad or invalid request received for password reset action email`
        );
      }
      logger.error(
        `AppService.sendUpdatePwdActionEmailToUser: Failed to send password reset email: ${error}`
      );
      throw new Error("Failed to send password reset email");
    }
  }

  public async updateUserLastLogin(token: string, data: any) {
    try {
      return await userServiceClient.updateUserLastLogin(token, data);
    } catch (error: any) {
      logger.error(
        `AppService.updateUserLastLogin: Internal server error during update last login from user service: ${error}`
      );
      throw new HTTPError(
        error?.message ?? "Internal server error",
        error?.statusCode
      );
    }
  }
}

export default new AppService();
