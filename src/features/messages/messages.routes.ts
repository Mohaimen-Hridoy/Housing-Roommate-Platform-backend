import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authorize } from "../../middleware/role";
import { Role } from "@prisma/client";
import { validate } from "../../middleware/validate";
import { messageCreateSchema, messageFilterSchema, messageReadSchema } from "./messages.schema";
import { sendMessage, listMessages, getConversation, getMessage, markRead, deleteMessage } from "./messages.controller";

export const messagesRouter = Router();

messagesRouter.use(authenticate, authorize(Role.OWNER, Role.TENANT, Role.ADMIN));

messagesRouter.get("/", validate({ query: messageFilterSchema }), listMessages);
messagesRouter.post("/", validate({ body: messageCreateSchema }), sendMessage);
messagesRouter.get("/conversation/:otherUserId", getConversation);
messagesRouter.get("/:id", getMessage);
messagesRouter.patch("/:id/read", validate({ body: messageReadSchema }), markRead);
messagesRouter.delete("/:id", deleteMessage);
