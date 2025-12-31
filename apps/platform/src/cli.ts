#!/usr/bin/env node
// cli.js
import { Command } from "commander"
import { runWorker } from "./server.js"

const program = new Command()

program
  .name("app-cli")
  .description("CLI for worker and utility commands")
  .version("1.0.0")

program
  .command("run-worker")
  .description("Start the worker")
  .action(async () => runWorker())

program
  .command("time")
  .description("Show the current time")
  .action(() => {
    const currentTime = new Date().toLocaleString()
    console.log(`Current time: ${currentTime}`)
  })

program.parse(process.argv)
