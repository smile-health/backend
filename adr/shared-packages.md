# Shared Packages

## Maintainer

Arya Kusuma <arya@badr-interactive.com>
Muhammad Alif <alif@badr-interactive.com>

## Glossary

BASE = core, workspaces backend functions

## Description

Shared packages is collection of libraries, helpers which can be used together with the BASE functions.
Shared packages is not strict to being dependent with the core backend functions, it can use the same framework with the BASE functions.

## How to use

1. Install the `@smile-health/lib` to each of the apps/\* `package.json`
2. For local usage, use the `pnpm` as package manager and keep the version like this `"@smile-health/lib": "workspace:*"` in `package.json`
3. For deployment, use the latest version of the package. e.g: `"@smile-health/lib": "^1.0.21"`
4. Please import the packages in the BASE functions like using public libraries. e.g.

```
import { RequestMiddleware } from "@smile-health/lib/middlewares"

const requestMiddleware = new RequestMiddleware()
mainApp.use("*", requestMiddleware.handle)
```

## How to contribute

1. Create new libraries implementation in the `packages/lib`
2. Export the types and functions
3. Increase the version increment
4. Create a new MR to the Maintainer

### Internationalization

To use internationalization, please do the following

1. Set the message with the key as the label
   e.g.: `c.var.t("auth.invalid")`
2. Create the dictionary if doesn't exists in the `pacakges/lib/lang/{language}.json` create at en.json and id.json at minimum.
