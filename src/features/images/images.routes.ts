import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { validate } from "../../middleware/validate";
import { handleUpload, uploadImages, allowedMimeTypes } from "../../middleware/upload";
import { imageIdParamSchema, setPrimaryBodySchema } from "./images.schema";
import { uploadOwnerImages, listOwnerImages, setPrimaryImage, deleteImage } from "./images.controller";
import type { ImageScope } from "./images.service";

/**
 * Builds the nested router mounted at `/<scope>/:id/images`. The scope is bound
 * at mount time rather than read from params, so it can never be spoofed.
 */
export function createOwnerImagesRouter(scope: ImageScope): Router {
  const router = Router({ mergeParams: true });

  router.get("/", listOwnerImages(scope));
  router.post("/", authenticate, authorize(Role.OWNER, Role.ADMIN), handleUpload(uploadImages), uploadOwnerImages(scope));

  return router;
}

export const propertyImagesRouter = createOwnerImagesRouter("properties");
export const roomImagesRouter = createOwnerImagesRouter("rooms");

export const imagesRouter = Router();

imagesRouter.get("/upload-limits", (_req, res) => {
  res.json({
    success: true,
    statusCode: 200,
    message: "Upload constraints",
    data: { allowedMimeTypes: allowedMimeTypes },
  });
});

imagesRouter.patch(
  "/:id/primary",
  authenticate,
  authorize(Role.OWNER, Role.ADMIN),
  validate({ params: imageIdParamSchema, body: setPrimaryBodySchema }),
  setPrimaryImage,
);

imagesRouter.delete(
  "/:id",
  authenticate,
  authorize(Role.OWNER, Role.ADMIN),
  validate({ params: imageIdParamSchema }),
  deleteImage
);