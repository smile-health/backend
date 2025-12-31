import { describe, it, expect, vi, Mock } from "vitest";
import appService from "../src/services/appService";
import keycloakClient from "../src/keycloakClient";

vi.mock("../src/keycloakClient");

describe("AuthService", () => {
  it("should return token on successful login", async () => {
    const mockToken = { access_token: "mockAccessToken" };
    (keycloakClient.getToken as Mock).mockResolvedValue(mockToken);

    const token = await appService.login("testUser", "testPassword");
    expect(token).toEqual(mockToken);
  });

  it("should throw an error on unauthorized login", async () => {
    (keycloakClient.getToken as Mock).mockRejectedValue(
      new Error("Unauthorized: Invalid username or password")
    );

    await expect(appService.login("testUser", "wrongPassword")).rejects.toThrow(
      "Unauthorized: Invalid username or password"
    );
  });

  it("should throw an error on internal server error", async () => {
    (keycloakClient.getToken as Mock).mockRejectedValue(
      new Error("Some internal error")
    );

    await expect(appService.login("testUser", "testPassword")).rejects.toThrow(
      "Internal server error"
    );
  });
});
