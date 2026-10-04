import { Router } from "express";
import type { Request, Response } from "express";
import { authRouter } from "../features/auth/auth.routes";
import { usersRouter } from "../features/users/users.routes";
import { propertiesRouter } from "../features/properties/properties.routes";
import { roomsRouter, propertyRoomsRouter } from "../features/rooms/rooms.routes";
import { amenitiesRouter } from "../features/amenities/amenities.routes";
import { bookingsRouter } from "../features/bookings/bookings.routes";
import { paymentsRouter } from "../features/payments/payments.routes";
import { reviewsRouter } from "../features/reviews/reviews.routes";
import { favoritesRouter } from "../features/favorites/favorites.routes";
import { messagesRouter } from "../features/messages/messages.routes";
import { auditRouter } from "../features/audit/audit.routes";
import { healthRouter } from "../features/health/health.routes";
import { imagesRouter, propertyImagesRouter, roomImagesRouter } from "../features/images/images.routes";
import { adminRouter } from "../features/admin/admin.routes";
import { ownerDashboardRouter } from "../features/admin/owner-dashboard.routes";

export const apiV1Router = Router();

// Landing route so the API base itself resolves instead of 404 when opened.
apiV1Router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    name: "Housing & Roommate Platform API",
    version: "1.0.0",
    status: "running",
    documentation: "/api/v1/docs/openapi.json",
    health: "/api/v1/health",
    postman: "docs/postman-collection.json (import into Postman)",
    endpoints: [
      "auth", "users", "properties", "rooms", "amenities", "bookings", "payments",
      "reviews", "favorites", "messages", "images", "admin", "dashboard", "audit/logs", "health",
    ],
  });
});

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/users", usersRouter);
apiV1Router.use("/properties/:id/images", propertyImagesRouter);
apiV1Router.use("/rooms/:id/images", roomImagesRouter);
apiV1Router.use("/properties/:propertyId/rooms", propertyRoomsRouter);
apiV1Router.use("/properties", propertiesRouter);
apiV1Router.use("/rooms", roomsRouter);
apiV1Router.use("/amenities", amenitiesRouter);
apiV1Router.use("/bookings", bookingsRouter);
apiV1Router.use("/payments", paymentsRouter);
apiV1Router.use("/reviews", reviewsRouter);
apiV1Router.use("/favorites", favoritesRouter);
apiV1Router.use("/messages", messagesRouter);
apiV1Router.use("/images", imagesRouter);
apiV1Router.use("/admin", adminRouter);
apiV1Router.use("/dashboard", ownerDashboardRouter);
apiV1Router.use("/audit/logs", auditRouter);
