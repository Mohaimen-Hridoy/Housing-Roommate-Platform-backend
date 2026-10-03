import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { successResponse } from "../../common/apiResponse";
import { BadRequestError } from "../../common/errors";
import * as imageService from "./images.service";
import type { ImageScope } from "./images.service";

type Res = Response;

function actorOf(req: AuthenticatedRequest) {
  if (!req.user) throw new BadRequestError("Authentication required");
  return { id: req.user.id, role: req.user.role };
}

const filesOf = (req: AuthenticatedRequest): Express.Multer.File[] => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) return files;
  const single = req.file as Express.Multer.File | undefined;
  return single ? [single] : [];
};

export const uploadOwnerImages =
  (scope: ImageScope) =>
  async (req: AuthenticatedRequest, res: Res, next: NextFunction): Promise<void> => {
    try {
      const owner = await imageService.resolveImageOwner(scope, req.params.id as string);
      const images = await imageService.uploadImages(owner, filesOf(req), actorOf(req));
      res.status(201).json(successResponse(images, { message: `${images.length} image(s) uploaded`, statusCode: 201 }));
    } catch (err) {
      next(err);
    }
  };

export const listOwnerImages =
  (scope: ImageScope) =>
  async (req: AuthenticatedRequest, res: Res, next: NextFunction): Promise<void> => {
    try {
      const owner = await imageService.resolveImageOwner(scope, req.params.id as string);
      const images = await imageService.listImages(owner);
      res.json(successResponse(images));
    } catch (err) {
      next(err);
    }
  };

export const setPrimaryImage = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const image = await imageService.setPrimaryImage(req.params.id as string, actorOf(req));
    res.json(successResponse(image, { message: "Primary image updated" }));
  } catch (err) {
    next(err);
  }
};

export const deleteImage = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    const result = await imageService.deleteImage(req.params.id as string, actorOf(req));
    res.json(successResponse(result, { message: "Image deleted" }));
  } catch (err) {
    next(err);
  }
};