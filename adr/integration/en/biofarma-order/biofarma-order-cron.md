# ADR: Biofarma Order Controller Cron Job Execution (v3.0)

## Status

Accepted

## Context

The Biofarma Order Controller (`biofarmaOrderController.js`) in the `apps/3.0/main-api` service is responsible for processing orders from Biofarma. It interacts with external APIs to create, update, and cancel orders in the Smile system based on Biofarma data.

To ensure timely synchronization of orders, this controller's main functions are executed periodically via cron jobs.

## Decision

The Biofarma Order Controller is scheduled to run automatically using cron jobs configured in the `package.json` scripts of the `apps/3.0/main-api` service. Specifically:

- **Hourly Execution:**  
  Script: `cmd:biofarma-hourly`  
  Command: `npm-run-all build && node dist/command.js checkBiofarmaOrder --isV2=false --monthly=true`  
  This runs the order check process on an hourly basis to keep data up to date.

- **Daily Execution:**  
  Script: `cmd:biofarma`  
  Command: `npm-run-all build && node dist/command.js checkBiofarmaOrder --isV2=false`  
  This runs the full order check process daily.

These scripts are intended to be triggered by external cron schedulers or task runners to automate the order synchronization process.

## Consequences

- The system maintains near real-time synchronization of Biofarma orders with the Smile platform.
- Running the process both hourly and daily ensures data consistency and timely updates.
- The cron jobs rely on environment variables for configuration such as API URLs and credentials.
- Proper monitoring and logging are essential to detect and handle any failures during these scheduled runs.

---

# Forward Compatibility Guide: Migrating Biofarma Order Controller from v3.0 to v5.0

## Overview

This guide outlines considerations and recommended steps to ensure forward compatibility when migrating the Biofarma Order Controller and its cron job execution from version 3.0 to version 5.0 of the `main-api` service.

---

_This ADR and guide document the current cron job setup and provide forward compatibility guidance for future upgrades._
