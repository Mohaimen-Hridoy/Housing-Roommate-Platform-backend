import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { env } from "../config";
import { BadRequestError } from "../common/errors";
import { logger } from "./logger";

export type StorageDriver = "cloudinary" | "local" | "external";

export interface StoredFile {
  driver: StorageDriver;
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes: number;
  mimeType: string;
}

let cloudinaryConfigured = false;

function configureCloudinary(): void {
  if (cloudinaryConfigured) return;
  cloudinary.config({
    cloud_name: env.storage.cloudinary.cloudName,
    api_key: env.storage.cloudinary.apiKey,
    api_secret: env.storage.cloudinary.apiSecret,
    secure: true,
  });
  cloudinaryConfigured = true;
}

export function getStorageDriver(): StorageDriver {
  return env.storage.driver as StorageDriver;
}

export function isCloudinaryConfigured(): boolean {
  return getStorageDriver() === "cloudinary";
}

function buildPublicId(scope: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(6).toString("hex");
  // No extension: Cloudinary appends the format itself and would produce
  // "name.png.png" if the public_id already ended in one.
  return `${scope}/${stamp}-${rand}`;
}

async function uploadToCloudinary(file: Express.Multer.File, scope: string): Promise<StoredFile> {
  configureCloudinary();
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: env.storage.cloudinary.folder, public_id: buildPublicId(scope), resource_type: "image" },
      (error, uploaded) => {
        if (error || !uploaded) reject(error ?? new Error("Cloudinary returned no upload result"));
        else resolve(uploaded);
      },
    );
    stream.end(file.buffer);
  });

  return {
    driver: "cloudinary",
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    mimeType: file.mimetype,
  };
}

async function uploadToLocalDisk(file: Express.Multer.File, scope: string): Promise<StoredFile> {
  const relativeDir = path.join(scope, String(new Date().getUTCFullYear()));
  const absoluteDir = path.resolve(env.storage.uploadDir, relativeDir);
  await fs.mkdir(absoluteDir, { recursive: true });

  const ext = (path.extname(file.originalname) || ".bin").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(6).toString("hex");
  const filename = `${stamp}-${rand}${ext}`;
  const absolutePath = path.join(absoluteDir, filename);

  await fs.writeFile(absolutePath, file.buffer);

  const relativePath = path.posix.join(relativeDir.split(path.sep).join("/"), filename);
  return {
    driver: "local",
    url: `${env.appUrl.replace(/\/+$/, "")}${env.storage.urlPrefix}/${relativePath}`,
    publicId: relativePath,
    bytes: file.size,
    mimeType: file.mimetype,
  };
}

export async function storeUploadedImage(file: Express.Multer.File, scope: string): Promise<StoredFile> {
  if (!file.buffer?.length) throw new BadRequestError(`Uploaded file "${file.originalname}" is empty`);
  if (isCloudinaryConfigured()) {
    try {
      return await uploadToCloudinary(file, scope);
    } catch (error) {
      logger.error("Cloudinary upload failed, falling back to local disk", {
        file: file.originalname,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return uploadToLocalDisk(file, scope);
}

export async function destroyStoredFile(driver: StorageDriver, publicId: string): Promise<void> {
  if (!publicId) return;
  // Seed/demo records point at externally hosted placeholders we do not own.
  if (driver !== "cloudinary" && driver !== "local") return;
  try {
    if (driver === "cloudinary" && isCloudinaryConfigured()) {
      configureCloudinary();
      await cloudinary.uploader.destroy(publicId);
      return;
    }
    const target = path.resolve(env.storage.uploadDir, publicId);
    const root = path.resolve(env.storage.uploadDir);
    if (!target.startsWith(root + path.sep)) {
      logger.warn("Refusing to delete file outside upload root", { publicId });
      return;
    }
    await fs.unlink(target);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      logger.warn("Failed to delete stored file", { publicId, reason });
    }
  }
}