import { BadRequestError } from "../error.js";
import { logger } from "../logger.js";
import { fetchData } from "./fetch.js";
import type { LoginResponse, UserInfo } from "./type.js";

export class AuthKeycloakService {
  constructor(private readonly authUrl: string = "http://localhost:5001") {
    this._testConnection();
  }

  private _testConnection() {
    fetch(this.authUrl + "/", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        logger.info(`Success Test connection to keycloak server: ${res.ok}`);
      })
      .catch((error) => {
        logger.error(
          `Falied Test connection to keycloak server: ${JSON.stringify(error)}`
        );
        return error;
      });
  }

  async validateToken(token: string): Promise<{ userInfo: UserInfo }> {
    try {
      const responseAuthKeycloak = await fetchData(
        `${this.authUrl}/validate-token`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      logger.info(
        `Success Validate Token Keycloak: ${JSON.stringify(responseAuthKeycloak?.userInfo?.sub)}`
      );
      return responseAuthKeycloak as { userInfo: UserInfo };
    } catch (error) {
      logger.info(`Failed Validate Token Keycloak: ${JSON.stringify(error)}`);
      throw new BadRequestError(`Failed Get User`);
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetchData(`${this.authUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username, password }).toString(),
      });

      logger.info(`Login successful for user: ${username}`);
      return response as LoginResponse;
    } catch (error) {
      logger.error(
        `Login failed for user: ${username}, error: ${JSON.stringify(error)}`
      );
      throw new BadRequestError("Login failed");
    }
  }
}
