import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, UploadInput } from "@/lib/storage/provider";

/**
 * Report artefact storage.
 *
 * Generated PDFs are private customer documents. They are never served from a
 * public bucket URL: every download goes through an authenticated,
 * ownership-checked route that mints a short-lived signed URL.
 */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

export class S3CompatibleStorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: {
    endpoint?: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  }) {
    this.bucket = options.bucket;
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async upload(input: UploadInput): Promise<{ key: string }> {
    const body = input.body instanceof Blob ? new Uint8Array(await input.body.arrayBuffer()) : input.body;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        Metadata: input.metadata,
        // Objects are private. Access is only ever via a signed URL.
        ACL: undefined,
      }),
    );

    return { key: input.key };
  }

  async getSignedUrl(input: { key: string; expiresInSeconds?: number }): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: input.key }), {
      expiresIn: input.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS,
    });
  }

  async delete(input: { key: string }): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: input.key }));
  }
}

/**
 * Local filesystem provider for development.
 *
 * Writes under .storage/ (gitignored) and returns an internal path rather than a
 * URL, so nothing is ever publicly reachable. The download route streams the
 * bytes itself in this mode.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(root = path.join(process.cwd(), ".storage")) {
    this.root = root;
  }

  private resolve(key: string): string {
    // Reject traversal: a key must stay inside the storage root.
    const target = path.resolve(this.root, key);
    if (!target.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error("Invalid storage key.");
    }
    return target;
  }

  async upload(input: UploadInput): Promise<{ key: string }> {
    const target = this.resolve(input.key);
    await mkdir(path.dirname(target), { recursive: true });

    const body = input.body instanceof Blob ? Buffer.from(await input.body.arrayBuffer()) : Buffer.from(input.body);
    await writeFile(target, body);

    return { key: input.key };
  }

  async getSignedUrl(input: { key: string }): Promise<string> {
    // No public URL exists in local mode; the route streams the file instead.
    return `local://${input.key}`;
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(input: { key: string }): Promise<void> {
    await unlink(this.resolve(input.key)).catch(() => undefined);
  }
}

export function isLocalStorage(provider: StorageProvider): provider is LocalStorageProvider {
  return provider instanceof LocalStorageProvider;
}

export function getStorageProvider(env: NodeJS.ProcessEnv = process.env): StorageProvider {
  const bucket = env.STORAGE_BUCKET;
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY;

  if (bucket && accessKeyId && secretAccessKey) {
    return new S3CompatibleStorageProvider({
      endpoint: env.STORAGE_ENDPOINT || undefined,
      region: env.STORAGE_REGION || "auto",
      bucket,
      accessKeyId,
      secretAccessKey,
    });
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Object storage must be configured in production (STORAGE_BUCKET and credentials).");
  }

  return new LocalStorageProvider();
}

export function checksumOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Report keys are namespaced per order so one key can never collide with another. */
export function reportStorageKey(reportOrderId: string, generatedReportId: string): string {
  return `reports/${reportOrderId}/${generatedReportId}.pdf`;
}
