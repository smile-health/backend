import { createMiddleware } from "hono/factory";
import { BadRequestError, ValidationError } from "../error";
import { FileRequest } from "../types/file";

export class ExcelMiddleware {
  handleExport = createMiddleware(async (c, next) => {
    await next();

    const file = c.var.file;
    if (!file) {
      throw new BadRequestError("failed to generate file");
    }

    const filename = c.var.file.filename;
    const buffer = c.var.file.buffer;

    c.res.headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}.xlsx"`
    );
    c.res.headers.set("Access-Control-Expose-Headers", "Filename");
    c.res.headers.set("Filename", `${filename}.xlsx`);
    c.res.headers.set(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Return the readable stream as the response
    return new Response(buffer, {
      status: 200,
      headers: c.res.headers,
    });
  });

  validateFileMiddleware = createMiddleware(async (c, next) => {
    // Check for the Content-Type header (must contain multipart/form-data)
    const contentType = c.req.header("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      throw new ValidationError(
        "Expected multipart/form-data or no file uploaded"
      );
    }

    // Extract boundary from the Content-Type header
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      throw new ValidationError("Boundary not found in Content-Type header");
    }

    const parsedBody = await c.req.parseBody();
    const file: File = parsedBody.file as File;

    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await file.arrayBuffer();
    } catch (error) {
      console.error(error);
      throw new ValidationError("invalid file type uploaded");
    }
    const fileData = Buffer.from(fileBuffer);
    const fileName = file.name;
    const fileRequest: FileRequest = {
      filename: fileName,
      buffer: fileBuffer,
    };

    if (!fileData || fileData.toString().trim().length === 0) {
      throw new ValidationError(
        `form-data Name must be 'file' or no file uploaded`
      );
    }

    const fileExtension = fileName?.split(".").pop();
    if (!fileExtension || fileExtension !== "xlsx") {
      throw new ValidationError("Uploaded file is not an Excel file (.xlsx)");
    }

    // Check if file data starts with the expected signature of an XLSX file
    // XLSX files are ZIP archives, so we can check for the ZIP file signature (PK\x03\x04)
    const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    if (!fileData.subarray(0, 4).equals(zipSignature)) {
      throw new ValidationError("Uploaded file is not a valid Excel file");
    }

    c.set("fileRequest", fileRequest);
    await next();
  });
}
