export type UploadInput = {
  key: string;
  body: Blob | Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
};

export interface StorageProvider {
  upload(input: UploadInput): Promise<{ key: string; url?: string }>;
  getSignedUrl(input: { key: string; expiresInSeconds?: number }): Promise<string>;
  delete(input: { key: string }): Promise<void>;
}
