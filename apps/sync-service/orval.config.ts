import fs from "fs"
import path from "path"

const openapiDir = "./src/openapi/specs" // Folder containing JSON specs
const outputDir = "./src/openapi"

const config = fs
  .readdirSync(openapiDir)
  .filter((file) => file.endsWith(".json"))
  .reduce((acc, file) => {
    const name = path.basename(file, ".json") // Extract filename without extension
    acc[name] = {
      input: path.join(openapiDir, file),
      output: {
        target: path.join(outputDir, `${name}.ts`), // ✅ Generate separate files
        client: "axios",
      },
    }
    return acc
  }, {})

module.exports = config
