#!/usr/bin/env node
import { Command } from "commander";
import keycloakClient from "./keycloakClient";

const program = new Command();

program
  .name("auth-service-cli")
  .description("CLI for auth-service utility commands")
  .version("1.0.0");

program
  .command("delete-users")
  .description(
    "Delete specific users from Keycloak realm by username or email"
  )
  .option(
    "-u, --users <items>",
    "Comma separated list of usernames or emails to delete",
    (value) => value.split(",")
  )
  .action(async (options) => {
    const usersToDelete = (options.users || []) as string[];

    if (usersToDelete.length === 0) {
      console.error("Error: No users specified. Use --users option to specify usernames or emails to delete.");
      process.exit(1);
    }

    try {
      console.log(`Deleting users: ${usersToDelete.join(", ")}`);
      
      let successCount = 0;
      let failureCount = 0;

      for (const userIdentifier of usersToDelete) {
        try {
          console.log(`Processing user: ${userIdentifier}`);
          
          // Check if user exists (try as username first, then email)
          const userResult = await keycloakClient.userExists(userIdentifier);
          
          if (!userResult.exists) {
            // Try as email if username lookup failed
            const emailResult = await keycloakClient.userExists("", userIdentifier);
            if (emailResult.exists) {
              await keycloakClient.deleteUser(emailResult.id!);
              console.log(`✓ Successfully deleted user: ${userIdentifier} (ID: ${emailResult.id})`);
              successCount++;
            } else {
              console.warn(`⚠ User not found: ${userIdentifier}`);
              failureCount++;
            }
          } else {
            await keycloakClient.deleteUser(userResult.id!);
            console.log(`✓ Successfully deleted user: ${userIdentifier} (ID: ${userResult.id})`);
            successCount++;
          }
        } catch (error) {
          console.error(`✗ Failed to delete user ${userIdentifier}:`, error);
          failureCount++;
        }
      }

      console.log(`\nUser deletion completed. Success: ${successCount}, Failed: ${failureCount}`);
      
      if (failureCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error("Error during user deletion process:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
