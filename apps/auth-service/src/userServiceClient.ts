import { HTTPError } from "@smile-health/lib/error";
import axios from "axios";
import userServiceConfig from "./config/userServiceConfig";
import logger from "./utils/logger";

class UserServiceClient {
  private readonly userUrl: string;

  constructor() {
    this.userUrl = userServiceConfig.serverUrl;
  }

  public async updateUserLastLogin(token: string, data: any) {
    try {
      await axios.post(`${this.userUrl}/users/update-last-login`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "device-type": data.last_device,
          "Accept-Language": data.language,
        },
      });
      logger.info(
        `UserServiceClient.updateUserLastLogin: update user last login successfully`
      );
    } catch (error: any) {
      logger.error(
        `UserServiceClient.updateUserLastLogin: Failed to update user last login: ${error}, ${JSON.stringify(error?.response?.data)}`
      );
    }
  }

  public async validateUserExists(
    username: string
  ): Promise<{ exists: boolean; user?: any }> {
    try {
      const response = await axios.post(
        `${userServiceConfig.serverUrl}/users/validate-exists`,
        { username },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 5000,
        }
      );

      logger.info(
        `UserServiceClient.validateUserExists: User validation successful for: '${username}'`
      );

      return {
        exists: true,
        user: response.data.data,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(
          `UserServiceClient.validateUserExists: User not found in SMILE DB: '${username}'`
        );
        return { exists: false };
      }

      logger.error(
        `UserServiceClient.validateUserExists: Failed to validate user existence: ${error}, ${JSON.stringify(error?.response?.data)}`
      );
      throw new Error(`Failed to validate user existence: ${error.message}`);
    }
  }

  public async login(username: string, password: string): Promise<any> {
    try {
      const response = await axios.post(
        `${userServiceConfig.serverUrl}/account/login`,
        {
          username,
          password,
          create: true,
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error(`UserServiceClient.login: Login failed: ${error}`);
      throw new HTTPError(
        error?.response?.data?.message,
        error?.response?.status
      );
    }
  }
}

export default new UserServiceClient();
