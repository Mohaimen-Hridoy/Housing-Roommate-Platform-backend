import { Router } from "express";
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

export const apiV1Router = Router();

apiV1Router.use("/health", healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/users", usersRouter);
apiV1Router.use("/properties/:propertyId/rooms", propertyRoomsRouter);
apiV1Router.use("/properties", propertiesRouter);
apiV1Router.use("/rooms", roomsRouter);
apiV1Router.use("/amenities", amenitiesRouter);
apiV1Router.use("/bookings", bookingsRouter);
apiV1Router.use("/payments", paymentsRouter);
apiV1Router.use("/reviews", reviewsRouter);
apiV1Router.use("/favorites", favoritesRouter);
apiV1Router.use("/messages", messagesRouter);
apiV1Router.use("/audit/logs", auditRouter);
