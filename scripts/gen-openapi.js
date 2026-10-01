// Generates docs/openapi.json from a robust array-based definition.
// Run: node scripts/gen-openapi.js
const fs = require("fs");
const path = require("path");

const security = [{ bearerAuth: [] }];

function operation(summary, tag, opts = {}) {
  const op = { summary, tags: [tag] };
  if (opts.security !== false) op.security = security;
  if (opts.params) op.parameters = opts.params;
  if (opts.pathParams) op.parameters = [...(opts.params || []), ...opts.pathParams];
  if (opts.body) op.requestBody = { content: { "application/json": { schema: opts.body } } };
  op.responses = opts.responses || { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiSuccess" } } } } };
  if (opts.created) op.responses[201] = { description: "Created" };
  return op;
}

const paths = [
  ["post", "/auth/register/tenant", operation("Register a tenant", "auth", { security: false, body: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", format: "password" }, phone: { type: "string" } } }, responses: { 201: { description: "Registered", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } } } })],
  ["post", "/auth/register/owner", operation("Register an owner", "auth", { security: false, body: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", format: "password" }, phone: { type: "string" } } }, responses: { 201: { description: "Registered", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } } } })],
  ["post", "/auth/login", operation("Email/password login", "auth", { security: false, body: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } } } })],
  ["post", "/auth/refresh", operation("Refresh access token", "auth", { security: false, body: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } } } })],
  ["post", "/auth/logout", operation("Logout (invalidate refresh token)", "auth")],
  ["get", "/auth/me", operation("Current user profile", "auth", { responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } } })],
  ["post", "/auth/google", operation("Google OAuth sign-in (exchange ID token)", "auth", { security: false, body: { type: "object", required: ["idToken"], properties: { idToken: { type: "string" } } }, responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } } } } })],
  ["post", "/auth/verify/resend", operation("Resend verification email", "auth", { security: false, body: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } })],
  ["post", "/auth/verify", operation("Verify email with token", "auth", { security: false, body: { type: "object", required: ["token"], properties: { token: { type: "string" } } } })],
  ["post", "/auth/password/forgot", operation("Request password reset", "auth", { security: false, body: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } })],
  ["post", "/auth/password/reset", operation("Reset password with token", "auth", { security: false, body: { type: "object", required: ["token", "password"], properties: { token: { type: "string" }, password: { type: "string", format: "password" } } } })],
  ["post", "/auth/password/change", operation("Change own password", "auth")],
  ["get", "/users", operation("List users (admin)", "users")],
  ["get", "/users/{id}", operation("Get a user (admin)", "users", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } } })],
  ["patch", "/users/{id}", operation("Update a user (admin)", "users", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/users/{id}/role", operation("Change a user's role (admin)", "users", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], body: { type: "object", properties: { role: { type: "string", enum: ["OWNER", "TENANT", "ADMIN"] } } } })],
  ["patch", "/users/{id}/password", operation("Set a user's password (admin)", "users", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], body: { type: "object", required: ["password"], properties: { password: { type: "string", format: "password" } } } })],
  ["patch", "/users/{id}/restore", operation("Restore a deleted user (admin)", "users", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["delete", "/users/{id}", operation("Soft-delete a user (admin)", "users", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/properties", operation("List/filter/search properties", "properties", { security: false, params: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "city", in: "query", schema: { type: "string" } }, { name: "search", in: "query", schema: { type: "string" } }, { name: "ownerId", in: "query", schema: { type: "string" } }, { name: "page", in: "query", schema: { type: "integer", default: 1 } }] })],
  ["get", "/properties/{id}", operation("Get a property", "properties", { security: false, pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Property" } } } } } })],
  ["post", "/properties", operation("Create a property (owner)", "properties")],
  ["patch", "/properties/{id}", operation("Update a property (owner/admin)", "properties", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["delete", "/properties/{id}", operation("Delete a property (owner/admin)", "properties", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["post", "/properties/{id}/amenities", operation("Add an amenity to a property (owner/admin)", "properties", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], body: { type: "object", required: ["amenityId"], properties: { amenityId: { type: "string" } } } })],
  ["delete", "/properties/{id}/amenities/{amenityId}", operation("Remove an amenity (owner/admin)", "properties", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "amenityId", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/properties/{propertyId}/rooms", operation("List rooms of a property", "properties", { security: false, pathParams: [{ name: "propertyId", in: "path", required: true, schema: { type: "string" } }] })],
  ["post", "/properties/{propertyId}/rooms", operation("Create a room in a property (owner)", "properties", { pathParams: [{ name: "propertyId", in: "path", required: true, schema: { type: "string" } }], created: true })],
  ["get", "/rooms", operation("List/filter rooms", "rooms", { security: false, params: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "minRent", in: "query", schema: { type: "number" } }, { name: "maxRent", in: "query", schema: { type: "number" } }, { name: "facing", in: "query", schema: { type: "string" } }, { name: "minBedrooms", in: "query", schema: { type: "integer" } }, { name: "availableFrom", in: "query", schema: { type: "string" } }] })],
  ["get", "/rooms/{id}", operation("Get a room", "rooms", { security: false, pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/rooms/{id}/occupancy", operation("Room occupancy (bookings)", "rooms", { security: false, pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/rooms/{id}", operation("Update a room (owner/admin)", "rooms", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/rooms/{id}/status", operation("Update room status (owner/admin)", "rooms", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], body: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"] } } } })],
  ["delete", "/rooms/{id}", operation("Delete a room (owner/admin)", "rooms", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/amenities", operation("List amenities", "amenities", { security: false, params: [{ name: "search", in: "query", schema: { type: "string" } }] })],
  ["post", "/amenities", operation("Create an amenity (admin)", "amenities")],
  ["delete", "/amenities/{id}", operation("Delete an amenity (admin)", "amenities", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/bookings", operation("List bookings (scoped to user)", "bookings", { params: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "tenantId", in: "query", schema: { type: "string" } }, { name: "propertyId", in: "query", schema: { type: "string" } }] })],
  ["post", "/bookings", operation("Create a booking (tenant)", "bookings", { created: true, body: { type: "object", required: ["roomId", "startDate", "endDate"], properties: { roomId: { type: "string" }, startDate: { type: "string", format: "date-time" }, endDate: { type: "string", format: "date-time" }, message: { type: "string" } } } })],
  ["get", "/bookings/{id}", operation("Get a booking", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Booking" } } } } } })],
  ["get", "/bookings/{id}/payments", operation("List a booking's payments", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["post", "/bookings/{id}/checkout", operation("Create a checkout session for a booking", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/bookings/{id}/approve", operation("Approve a booking (owner/admin)", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/bookings/{id}/reject", operation("Reject a booking (owner/admin)", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/bookings/{id}/cancel", operation("Cancel a booking (tenant/owner/admin)", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], body: { type: "object", properties: { reason: { type: "string" } } } })],
  ["delete", "/bookings/{id}", operation("Delete a booking (owner/admin)", "bookings", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/bookings/mine", operation("List my bookings", "bookings")],
  ["get", "/payments", operation("List payments (admin)", "payments", { params: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "provider", in: "query", schema: { type: "string" } }, { name: "bookingId", in: "query", schema: { type: "string" } }, { name: "tenantId", in: "query", schema: { type: "string" } }] })],
  ["get", "/payments/{id}", operation("Get a payment", "payments", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/Payment" } } } } } })],
  ["post", "/payments/{id}/refund", operation("Refund a payment (admin)", "payments", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], body: { type: "object", properties: { amount: { type: "number" } } } })],
  ["post", "/stripe/webhook", operation("Stripe webhook (raw body)", "stripe", { security: false })],
  ["get", "/reviews", operation("List reviews", "reviews", { security: false, params: [{ name: "subject", in: "query", schema: { type: "string", enum: ["ROOM", "PROPERTY"] } }, { name: "reviewableId", in: "query", schema: { type: "string" } }, { name: "authorId", in: "query", schema: { type: "string" } }, { name: "minRating", in: "query", schema: { type: "integer" } }, { name: "maxRating", in: "query", schema: { type: "integer" } }] })],
  ["get", "/reviews/{id}", operation("Get a review", "reviews", { security: false, pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["post", "/reviews", operation("Create a review (participant)", "reviews", { created: true, body: { type: "object", required: ["subject", "reviewableId", "bookingId", "rating"], properties: { subject: { type: "string", enum: ["ROOM", "PROPERTY"] }, reviewableId: { type: "string" }, bookingId: { type: "string" }, rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string" } } } })],
  ["delete", "/reviews/{id}", operation("Delete a review", "reviews", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/favorites", operation("List my favorites", "favorites")],
  ["post", "/favorites", operation("Favorite a property", "favorites", { created: true, body: { type: "object", required: ["propertyId"], properties: { propertyId: { type: "string" } } } })],
  ["delete", "/favorites/{id}", operation("Delete a favorite", "favorites", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["delete", "/favorites/property/{propertyId}", operation("Delete a favorite by property", "favorites", { pathParams: [{ name: "propertyId", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/messages", operation("List messages for the user", "messages", { params: [{ name: "folder", in: "query", schema: { type: "string", enum: ["inbox", "sent"], default: "inbox" } }, { name: "read", in: "query", schema: { type: "string" } }, { name: "propertyId", in: "query", schema: { type: "string" } }] })],
  ["post", "/messages", operation("Send a message", "messages", { created: true, body: { type: "object", required: ["recipientId", "body"], properties: { recipientId: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, propertyId: { type: "string" } } } })],
  ["get", "/messages/conversation/{otherUserId}", operation("Conversation thread", "messages", { pathParams: [{ name: "otherUserId", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/messages/{id}", operation("Get a message", "messages", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["patch", "/messages/{id}/read", operation("Mark a message as read", "messages", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["delete", "/messages/{id}", operation("Delete a message", "messages", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] })],
  ["get", "/audit/logs", operation("List audit logs (admin)", "audit", { params: [{ name: "action", in: "query", schema: { type: "string" } }, { name: "entityType", in: "query", schema: { type: "string" } }, { name: "actorId", in: "query", schema: { type: "string" } }] })],
  ["get", "/audit/logs/{id}", operation("Get an audit log (admin)", "audit", { pathParams: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/AuditLog" } } } } } })],
  ["get", "/health", operation("Health check", "health")],
  ["get", "/health/live", operation("Liveness probe", "health")],
  ["get", "/health/ready", operation("Readiness probe", "health")],
];

const pathMap = {};
for (const [method, route, op] of paths) {
  if (!pathMap[route]) pathMap[route] = {};
  pathMap[route][method] = op;
}

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Apollo B7A6 Housing & Roommate Platform API",
    version: "1.0.0",
    description: "Versioned backend API for the Housing & Roommate Platform (Node.js + TypeScript + Express + Prisma + Stripe).",
    contact: { name: "housing-backend" },
  },
  servers: [{ url: "http://localhost:4000/api/v1", description: "Local development" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      ApiSuccess: { type: "object", properties: { success: { type: "boolean", example: true }, statusCode: { type: "integer", example: 200 }, message: { type: "string" }, data: {}, meta: { type: "object" } } },
      ApiError: { type: "object", properties: { success: { type: "boolean", example: false }, statusCode: { type: "integer" }, message: { type: "string" }, data: { type: "null" }, error: { type: "object", properties: { code: { type: "string" }, details: {} } } } },
      PaginationMeta: { type: "object", properties: { page: { type: "integer" }, pageSize: { type: "integer" }, totalItems: { type: "integer" }, totalPages: { type: "integer" }, hasNextPage: { type: "boolean" }, hasPrevPage: { type: "boolean" } } },
      User: { type: "object", properties: { id: { type: "string" }, email: { type: "string", format: "email" }, name: { type: "string" }, phone: { type: "string" }, role: { type: "string", enum: ["OWNER", "TENANT", "ADMIN"] }, isVerified: { type: "boolean" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
      Property: { type: "object", properties: { id: { type: "string" }, ownerId: { type: "string" }, title: { type: "string" }, description: { type: "string", nullable: true }, address: { type: "string" }, city: { type: "string" }, state: { type: "string", nullable: true }, postalCode: { type: "string", nullable: true }, country: { type: "string" }, lat: { type: "number", nullable: true }, lng: { type: "number", nullable: true }, status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] }, publishedAt: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      Room: { type: "object", properties: { id: { type: "string" }, propertyId: { type: "string" }, title: { type: "string" }, rent: { type: "number" }, currency: { type: "string" }, deposit: { type: "number", nullable: true }, area: { type: "number", nullable: true }, bedrooms: { type: "integer" }, bathrooms: { type: "integer" }, facing: { type: "string", enum: ["NORTH", "SOUTH", "EAST", "WEST"] }, status: { type: "string", enum: ["AVAILABLE", "RESERVED", "OCCUPIED", "MAINTENANCE"] }, availableFrom: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      Amenity: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, icon: { type: "string", nullable: true } } },
      Booking: { type: "object", properties: { id: { type: "string" }, tenantId: { type: "string" }, roomId: { type: "string" }, propertyId: { type: "string" }, status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "EXPIRED"] }, startDate: { type: "string", format: "date-time" }, endDate: { type: "string", format: "date-time", nullable: true }, nightlyRate: { type: "number" }, totalAmount: { type: "number" }, platformFee: { type: "number" }, currency: { type: "string" }, message: { type: "string", nullable: true }, payment: { type: "object", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      Payment: { type: "object", properties: { id: { type: "string" }, bookingId: { type: "string" }, tenantId: { type: "string" }, provider: { type: "string", enum: ["STRIPE", "MOCK"] }, providerPaymentId: { type: "string", nullable: true }, amount: { type: "number" }, currency: { type: "string" }, status: { type: "string", enum: ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELED"] }, clientSecret: { type: "string", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      Review: { type: "object", properties: { id: { type: "string" }, subject: { type: "string", enum: ["ROOM", "PROPERTY"] }, reviewableId: { type: "string" }, authorId: { type: "string" }, bookingId: { type: "string", nullable: true }, rating: { type: "integer", minimum: 1, maximum: 5 }, comment: { type: "string", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      Favorite: { type: "object", properties: { id: { type: "string" }, userId: { type: "string" }, propertyId: { type: "string" }, createdAt: { type: "string", format: "date-time" } } },
      Message: { type: "object", properties: { id: { type: "string" }, senderId: { type: "string" }, recipientId: { type: "string" }, subject: { type: "string", nullable: true }, body: { type: "string" }, propertyId: { type: "string", nullable: true }, readAt: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      AuditLog: { type: "object", properties: { id: { type: "string" }, action: { type: "string" }, actorId: { type: "string", nullable: true }, entityId: { type: "string", nullable: true }, entityType: { type: "string", nullable: true }, before: {}, after: {}, ip: { type: "string", nullable: true }, userAgent: { type: "string", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
      TokenResponse: { type: "object", properties: { accessToken: { type: "string" }, refreshToken: { type: "string" }, tokenType: { type: "string", example: "Bearer" }, expiresIn: { type: "integer" } } },
    },
  },
  paths: pathMap,
  tags: [
    { name: "auth", description: "Authentication & session" },
    { name: "users", description: "User administration" },
    { name: "properties", description: "Property listings" },
    { name: "rooms", description: "Rooms / units" },
    { name: "amenities", description: "Shared amenities" },
    { name: "bookings", description: "Booking workflow" },
    { name: "payments", description: "Payments" },
    { name: "stripe", description: "Stripe integration" },
    { name: "reviews", description: "Reviews" },
    { name: "favorites", description: "Favorites" },
    { name: "messages", description: "Messaging" },
    { name: "audit", description: "Audit trail" },
    { name: "health", description: "Health probes" },
  ],
};

const outDir = path.resolve(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "openapi.json"), JSON.stringify(spec, null, 2));
console.log(`Wrote ${path.join(outDir, "openapi.json")} with ${Object.keys(pathMap).length} paths`);
