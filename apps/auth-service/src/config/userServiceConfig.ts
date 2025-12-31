import dotenv from "dotenv";

dotenv.config();

export default {
  serverUrl: process.env.USER_SERVICE_SERVER_URL ?? "http://localhost:4000",
};
