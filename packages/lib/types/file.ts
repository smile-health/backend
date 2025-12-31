/* eslint-disable @typescript-eslint/no-empty-object-type */
export interface File {
  filename: string | null;
  buffer: ArrayBuffer | null;
}

export interface FileResponse extends File {}
export interface FileRequest extends File {}
