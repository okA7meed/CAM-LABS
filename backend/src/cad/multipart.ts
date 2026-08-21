import { AppError } from '../utils/errors';

export interface MultipartFile {
  fieldName: string;
  originalName: string;
  mimeType: string;
  data: Buffer;
}

export interface MultipartForm {
  fields: Record<string, string>;
  file: MultipartFile;
}

const headerValue = (headers: string, name: string): string => {
  const match = headers.match(new RegExp(`(?:^|\\r\\n)${name}:\\s*([^\\r\\n]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

export const parseMultipartForm = (contentType: string | undefined, body: Buffer): MultipartForm => {
  const boundaryMatch = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new AppError('A multipart/form-data upload is required.', 400, 'INVALID_UPLOAD');
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts: Buffer[] = [];
  let cursor = body.indexOf(boundary);
  while (cursor !== -1) {
    const next = body.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;
    const part = body.subarray(cursor + boundary.length, next);
    if (part.length > 4 && part.subarray(0, 2).toString() === '\r\n') parts.push(part.subarray(2, part.length - 2));
    cursor = next;
  }

  let file: MultipartFile | undefined;
  const fields: Record<string, string> = {};
  for (const part of parts) {
    const separator = part.indexOf(Buffer.from('\r\n\r\n'));
    if (separator < 0) continue;
    const headers = part.subarray(0, separator).toString('utf8');
    const data = part.subarray(separator + 4);
    const disposition = headerValue(headers, 'Content-Disposition');
    const fieldName = disposition.match(/name="([^"]+)"/i)?.[1];
    if (!fieldName) continue;
    const originalName = disposition.match(/filename="([^"]*)"/i)?.[1];
    if (originalName !== undefined) {
      file = { fieldName, originalName, mimeType: headerValue(headers, 'Content-Type') || 'application/octet-stream', data };
    } else {
      fields[fieldName] = data.toString('utf8');
    }
  }

  if (!file || !file.originalName) throw new AppError('The upload must contain a file.', 400, 'INVALID_UPLOAD');
  return { fields, file };
};