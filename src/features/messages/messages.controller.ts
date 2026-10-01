import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import * as messageService from "./messages.service";
import { successResponse, errorResponse } from "../../common/apiResponse";

type Res = Response;

export const sendMessage = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const msg = await messageService.sendMessage(req.body as never, { id: req.user.id, role: req.user.role });
    res.status(201).json(successResponse(msg, { message: "Message sent", statusCode: 201 }));
  } catch (err) {
    next(err);
  }
};

export const listMessages = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const query = req.query as Record<string, unknown>;
    const result = await messageService.listMessages(
      {
        folder: (query.folder as "inbox" | "sent") || "inbox",
        propertyId: query.propertyId as string | undefined,
        read: query.read as boolean | undefined,
        page: Number(query.page) || 1,
        pageSize: Number(query.pageSize) || 20,
        sortBy: (query.sortBy as string) || "createdAt",
        sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
      },
      { id: req.user.id, role: req.user.role }
    );
    res.json(successResponse(result.rows, { meta: result.meta }));
  } catch (err) {
    next(err);
  }
};

export const getConversation = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const messages = await messageService.getConversation(req.params.otherUserId as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(messages));
  } catch (err) {
    next(err);
  }
};

export const getMessage = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const message = await messageService.getMessage(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(message));
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    const message = await messageService.markRead(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(message, { message: "Message marked as read" }));
  } catch (err) {
    next(err);
  }
};

export const deleteMessage = async (req: AuthenticatedRequest, res: Res, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json(errorResponse({ message: "Unauthorized", statusCode: 401 }));
      return;
    }
    await messageService.deleteMessage(req.params.id as string, { id: req.user.id, role: req.user.role });
    res.json(successResponse(null, { message: "Message deleted" }));
  } catch (err) {
    next(err);
  }
};
