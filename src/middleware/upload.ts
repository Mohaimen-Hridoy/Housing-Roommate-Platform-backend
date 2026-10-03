import multer from "multer";
import { RequestHandler } from "express";
import { env } from "../config";

const ALLOWED = new Set(env.storage.allowedMime);

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!ALLOWED.has(file.mimetype.toLowerCase())) {
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    return;
  }
  cb(null, true);
};

export const uploadImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.storage.maxFileSizeBytes,
    files: env.storage.maxFiles,
  },
}).array("images", env.storage.maxFiles);

export const uploadSingleImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.storage.maxFileSizeBytes, files: 1 },
}).single("image");

export const allowedMimeTypes: string[] = [...ALLOWED];

/**
 * Wraps a multer middleware so that multer's own errors (file too large,
 * wrong mimetype, too many files) surface through the normal ApiError
 * pipeline instead of leaking as raw 500s.
 */
export const handleUpload =
  (middleware: RequestHandler, fieldLabel = "images"): RequestHandler =>
  (req, res, next) => {
    middleware(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? `Each file must be ${Math.round(env.storage.maxFileSizeBytes / (1024 * 1024))}MB or smaller`
            : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
              ? `Only image files are accepted in the "${fieldLabel}" field (max ${env.storage.maxFiles} files, types: ${allowedMimeTypes.join(", ")})`
              : `Upload failed: ${err.message}`;
        res.status(422).json({
          success: false,
          statusCode: 422,
          message,
          data: null,
          errors: [{ path: fieldLabel, message, code: err.code }],
        });
        return;
      }
      next(err);
    });
  };