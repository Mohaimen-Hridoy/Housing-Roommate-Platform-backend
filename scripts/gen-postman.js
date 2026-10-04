/**
 * Converts docs/openapi.json into a Postman Collection v2.1 file.
 *
 * Run after `npm run open:gen`:
 *   node scripts/gen-postman.js
 *
 * Design notes, because a naive OpenAPI -> Postman conversion produces a
 * collection that looks complete but fails on almost every request:
 *
 *  - Every path parameter is bound to the SAME collection variable that the
 *    test scripts populate ({{propertyId}}, {{roomId}}, ...). A generic
 *    {{id}} leaves every path unresolved and every request returns 404.
 *  - Auth is set per request from the role that the endpoint actually allows.
 *    A single shared token makes it impossible to demonstrate RBAC, which is
 *    an explicit requirement.
 *  - Login test scripts capture accessToken, refreshToken AND a role-specific
 *    token, so switching roles for the 403 demo is one click.
 *  - Every body carries a value that passes the backend's Zod schema, so no
 *    request needs manual editing before it can be sent.
 */
const fs = require("fs");
const path = require("path");

const specPath = path.resolve(__dirname, "..", "docs", "openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const METHODS = ["get", "post", "put", "patch", "delete"];
const BASE_URL = "{{baseUrl}}";
const NO_AUTH = { type: "noauth" };

const bearer = (variable) => ({ type: "bearer", bearer: [{ key: "token", value: variable, type: "string" }] });

const ADMIN = bearer("{{adminToken}}");
const OWNER = bearer("{{ownerToken}}");
const TENANT = bearer("{{tenantToken}}");

/** Future dates for the booking demo, clear of every seeded booking. */
const bookingStart = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const bookingEnd = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

/**
 * Per-request overrides keyed by "METHOD /openapi/path".
 * auth   - the role allowed by the route
 * vars   - { pathParamName: collectionVariableName }
 * body   - a body that satisfies the backend's Zod schema
 * script - extra test-script lines
 */
const OVERRIDES = {
  // ---------------------------------------------------------------- auth
  "POST /auth/register/tenant": {
    auth: NO_AUTH,
    body: { name: "Demo Tenant", email: "new.tenant@housing.local", password: "Tenant1234!", phone: "+15555550111" },
  },
  "POST /auth/register/owner": {
    auth: NO_AUTH,
    body: { name: "Demo Owner", email: "new.owner@housing.local", password: "Owner1234!", phone: "+15555550112" },
  },
  "POST /auth/login": {
    auth: NO_AUTH,
    body: { email: "{{adminEmail}}", password: "{{adminPassword}}" },
  },
  "POST /auth/refresh": { auth: NO_AUTH, body: { refreshToken: "{{refreshToken}}" } },
  "POST /auth/logout": { auth: NO_AUTH },
  "GET /auth/me": { auth: TENANT },
  "POST /auth/google": { auth: NO_AUTH, body: { idToken: "paste-a-google-id-token-here" } },
  "POST /auth/verify/resend": { auth: NO_AUTH, body: { email: "{{tenantEmail}}" } },
  "POST /auth/verify": { auth: NO_AUTH, body: { token: "paste-the-verification-token-from-the-email" } },
  "POST /auth/password/forgot": { auth: NO_AUTH, body: { email: "{{tenantEmail}}" } },
  "POST /auth/password/reset": { auth: NO_AUTH, body: { token: "paste-the-reset-token", password: "Tenant12345!" } },
  "POST /auth/password/change": { auth: TENANT, body: { currentPassword: "{{tenantPassword}}", newPassword: "Tenant12345!" } },

  // --------------------------------------------------------------- users
  "GET /users": { auth: ADMIN },
  "GET /users/{id}": { auth: ADMIN, vars: { id: "userId" } },
  "PATCH /users/{id}": { auth: ADMIN, vars: { id: "userId" }, body: { name: "Updated Demo User", phone: "+15555550123" } },
  "PATCH /users/{id}/role": { auth: ADMIN, vars: { id: "userId" }, body: { role: "OWNER" } },
  "PATCH /users/{id}/password": { auth: ADMIN, vars: { id: "userId" }, body: { password: "Reset1234!" } },
  "DELETE /users/{id}": { auth: ADMIN, vars: { id: "userId" } },
  "PATCH /users/{id}/restore": { auth: ADMIN, vars: { id: "userId" } },

  // ---------------------------------------------------------- properties
  "GET /properties": { auth: NO_AUTH },
  "POST /properties": {
    auth: OWNER,
    body: {
      title: "Demo Roommate Property",
      description: "A comfortable property created through the Postman walkthrough.",
      address: "123 Demo Street",
      city: "Metropolis",
      state: "NY",
      postalCode: "10001",
      country: "US",
      status: "PUBLISHED",
    },
  },
  "GET /properties/{id}": { auth: NO_AUTH, vars: { id: "propertyId" } },
  "PATCH /properties/{id}": { auth: OWNER, vars: { id: "propertyId" }, body: { description: "Updated through Postman." } },
  "DELETE /properties/{id}": { auth: OWNER, vars: { id: "propertyId" } },
  "POST /properties/{id}/amenities": { auth: OWNER, vars: { id: "propertyId" }, body: { amenityId: "{{amenityId}}" } },
  "DELETE /properties/{id}/amenities/{amenityId}": { auth: OWNER, vars: { id: "propertyId", amenityId: "amenityId" } },
  "GET /properties/{propertyId}/rooms": { auth: NO_AUTH, vars: { propertyId: "propertyId" } },
  "POST /properties/{propertyId}/rooms": {
    auth: OWNER,
    vars: { propertyId: "propertyId" },
    body: {
      title: "Demo Room",
      description: "A bright furnished room for the walkthrough.",
      area: 24,
      rent: 1200,
      currency: "usd",
      deposit: 600,
      bedrooms: 1,
      bathrooms: 1,
      facing: "EAST",
      status: "AVAILABLE",
    },
  },

  // --------------------------------------------------------------- rooms
  "GET /rooms": { auth: NO_AUTH },
  "GET /rooms/{id}": { auth: NO_AUTH, vars: { id: "roomId" } },
  "PATCH /rooms/{id}": { auth: OWNER, vars: { id: "roomId" }, body: { rent: 1350 } },
  "DELETE /rooms/{id}": { auth: OWNER, vars: { id: "roomId" } },
  "GET /rooms/{id}/occupancy": { auth: NO_AUTH, vars: { id: "roomId" } },
  "PATCH /rooms/{id}/status": {
    auth: OWNER,
    vars: { id: "roomId" },
    body: { status: "AVAILABLE" },
    note: "Send this before Create a booking. Creating a booking flips the room to RESERVED, so this resets it and makes the walkthrough repeatable.",
  },

  // ----------------------------------------------------------- amenities
  "GET /amenities": { auth: NO_AUTH },
  "POST /amenities": { auth: ADMIN, body: { name: "Study Room", icon: "study" } },
  "DELETE /amenities/{id}": { auth: ADMIN, vars: { id: "amenityId" } },

  // ------------------------------------------------------------ bookings
  "GET /bookings": { auth: TENANT },
  "POST /bookings": {
    auth: TENANT,
    body: {
      roomId: "{{roomId}}",
      startDate: "{{bookingStartDate}}",
      endDate: "{{bookingEndDate}}",
      message: "Booking created from the Postman walkthrough.",
    },
  },
  "GET /bookings/{id}": { auth: TENANT, vars: { id: "bookingId" } },
  "DELETE /bookings/{id}": { auth: OWNER, vars: { id: "bookingId" } },
  "GET /bookings/{id}/payments": { auth: TENANT, vars: { id: "bookingId" } },
  "POST /bookings/{id}/checkout": {
    auth: TENANT,
    vars: { id: "bookingId" },
    note: "Returns a hosted Stripe checkoutUrl. Open it and pay with card 4242 4242 4242 4242 (no expiry or CVC needed); the webhook then flips the payment to SUCCEEDED.",
  },
  "PATCH /bookings/{id}/approve": { auth: OWNER, vars: { id: "bookingId" }, body: {} },
  "PATCH /bookings/{id}/reject": { auth: OWNER, vars: { id: "bookingId" }, body: { reason: "Not available for those dates." } },
  "PATCH /bookings/{id}/cancel": { auth: TENANT, vars: { id: "bookingId" }, body: { reason: "Cancelled from the walkthrough." } },
  "GET /bookings/mine": { auth: TENANT },

  // ------------------------------------------------------------ payments
  "GET /payments": { auth: ADMIN },
  "GET /payments/{id}": { auth: ADMIN, vars: { id: "paymentId" } },
  "POST /payments/{id}/refund": {
    auth: ADMIN,
    vars: { id: "paymentId" },
    body: { amount: 100, reason: "Demo partial refund" },
  },

  // ------------------------------------------------------------ reviews
  "GET /reviews": { auth: NO_AUTH },
  "POST /reviews": {
    auth: TENANT,
    body: { subject: "ROOM", reviewableId: "{{roomId}}", bookingId: "{{bookingId}}", rating: 5, comment: "Great place to live." },
  },
  "GET /reviews/{id}": { auth: NO_AUTH, vars: { id: "reviewId" } },
  "DELETE /reviews/{id}": { auth: TENANT, vars: { id: "reviewId" } },

  // ---------------------------------------------------------- favorites
  "GET /favorites": { auth: TENANT },
  "POST /favorites": { auth: TENANT, body: { propertyId: "{{propertyId}}" } },
  "DELETE /favorites/{id}": { auth: TENANT, vars: { id: "favoriteId" } },
  "DELETE /favorites/property/{propertyId}": { auth: TENANT, vars: { propertyId: "propertyId" } },

  // ----------------------------------------------------------- messages
  "GET /messages": { auth: TENANT },
  "POST /messages": {
    auth: TENANT,
    body: { recipientId: "{{ownerUserId}}", subject: "Is the room still available?", body: "Hello, I am interested in the room.", propertyId: "{{propertyId}}" },
  },
  "GET /messages/conversation/{otherUserId}": { auth: TENANT, vars: { otherUserId: "ownerUserId" } },
  "GET /messages/{id}": { auth: TENANT, vars: { id: "messageId" } },
  "DELETE /messages/{id}": { auth: TENANT, vars: { id: "messageId" } },
  "PATCH /messages/{id}/read": { auth: TENANT, vars: { id: "messageId" } },

  // --------------------------------------------------------------- audit
  "GET /audit/logs": { auth: ADMIN },
  "GET /audit/logs/{id}": { auth: ADMIN, vars: { id: "auditLogId" } },

  // -------------------------------------------------------------- images
  "GET /properties/{id}/images": { auth: NO_AUTH, vars: { id: "propertyId" } },
  "POST /properties/{id}/images": {
    auth: OWNER,
    vars: { id: "propertyId" },
    form: true,
    note: "Form-data tab. Drop any jpg/png/webp file into the images field.",
  },
  "GET /rooms/{id}/images": { auth: NO_AUTH, vars: { id: "roomId" } },
  "POST /rooms/{id}/images": { auth: OWNER, vars: { id: "roomId" }, form: true },
  "GET /images/upload-limits": { auth: NO_AUTH },
  "PATCH /images/{id}/primary": { auth: OWNER, vars: { id: "imageId" } },
  "DELETE /images/{id}": { auth: OWNER, vars: { id: "imageId" } },

  // --------------------------------------------------------------- admin
  "GET /admin/stats": {
    auth: ADMIN,
    note: "RBAC demo: send this with the owner or tenant token and it returns 403.",
  },
  "GET /dashboard": { auth: OWNER },
};

/** Test scripts that promote response fields into collection variables. */
const CAPTURES = {
  "POST /auth/login": [
    "const body = pm.response.json();",
    "const d = body && body.data;",
    "if (d && d.accessToken) {",
    "  pm.collectionVariables.set('accessToken', d.accessToken);",
    "  const email = (pm.request.body.raw ? JSON.parse(pm.request.body.raw).email : '');",
    "  if (email.indexOf('admin') !== -1) {",
    "    pm.collectionVariables.set('adminToken', d.accessToken);",
    "  } else if (email.indexOf('owner') !== -1) {",
    "    pm.collectionVariables.set('ownerToken', d.accessToken);",
    "  } else {",
    "    pm.collectionVariables.set('tenantToken', d.accessToken);",
    "  }",
    "}",
    "if (d && d.refreshToken) pm.collectionVariables.set('refreshToken', d.refreshToken);",
    "if (d && d.user && d.user.id) pm.collectionVariables.set('currentUserId', d.user.id);",
  ],
  "POST /auth/refresh": [
    "const d = pm.response.json().data || {};",
    "if (d.accessToken) pm.collectionVariables.set('accessToken', d.accessToken);",
    "if (d.refreshToken) pm.collectionVariables.set('refreshToken', d.refreshToken);",
  ],
  "POST /properties": ["const d = pm.response.json().data || {};", "if (d.id) pm.collectionVariables.set('propertyId', d.id);"],
  "POST /properties/{propertyId}/rooms": [
    "const d = pm.response.json().data || {};",
    "if (d.id) pm.collectionVariables.set('roomId', d.id);",
  ],
  "POST /bookings": ["const d = pm.response.json().data || {};", "if (d.id) pm.collectionVariables.set('bookingId', d.id);"],
  "POST /favorites": ["const d = pm.response.json().data || {};", "if (d.id) pm.collectionVariables.set('favoriteId', d.id);"],
  "POST /messages": ["const d = pm.response.json().data || {};", "if (d.id) pm.collectionVariables.set('messageId', d.id);"],
  "POST /reviews": ["const d = pm.response.json().data || {};", "if (d.id) pm.collectionVariables.set('reviewId', d.id);"],
  "POST /amenities": ["const d = pm.response.json().data || {};", "if (d.id) pm.collectionVariables.set('amenityId', d.id);"],
  "GET /amenities": [
    "const rows = pm.response.json().data || [];",
    "if (rows.length) pm.collectionVariables.set('amenityId', rows[0].id);",
  ],
  "GET /properties": [
    "const rows = pm.response.json().data || [];",
    "if (rows.length) pm.collectionVariables.set('propertyId', rows[0].id);",
  ],
  "GET /rooms": [
    "const rows = pm.response.json().data || [];",
    "if (rows.length) {",
    "  pm.collectionVariables.set('roomId', rows[0].id);",
    "  if (rows[0].property && rows[0].property.ownerId) pm.collectionVariables.set('ownerUserId', rows[0].property.ownerId);",
    "}",
  ],
  "GET /bookings/{id}/payments": [
    "const rows = pm.response.json().data || [];",
    "if (rows.length) pm.collectionVariables.set('paymentId', rows[0].id);",
  ],
  "GET /admin/stats": [
    "const s = pm.response.json().data || {};",
    "if (s.bookings && s.bookings.recentBookingId) pm.collectionVariables.set('bookingId', s.bookings.recentBookingId);",
  ],
  "GET /users": [
    "const rows = pm.response.json().data || [];",
    "if (rows.length) pm.collectionVariables.set('userId', rows[0].id);",
  ],
  "GET /audit/logs": [
    "const rows = pm.response.json().data || [];",
    "if (rows.length) pm.collectionVariables.set('auditLogId', rows[0].id);",
  ],
  "GET /images/upload-limits": [],
};

/** Commands that seed variables for the three roles, run once from the walkthrough folder. */
const buildRequest = (method, rawPath, op) => {
  const override = OVERRIDES[`${method.toUpperCase()} ${rawPath}`] || {};
  const varMap = override.vars || {};

  const segments = rawPath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith("{") && segment.endsWith("}")) {
        const name = segment.slice(1, -1);
        return `:${varMap[name] || name}`;
      }
      return segment;
    });

  const query = (op.parameters || []).filter((p) => p.in === "query");
  const path = segments.map((s) => s.replace(/^:/, "{{").replace(/$/, "}}").replace(/^{{(.+)}}$/, ":$1"));

  const url = {
    raw: [BASE_URL, ...path].join("/") + (query.length ? "?" + query.map((q) => `${q.name}=`).join("&") : ""),
    host: [BASE_URL],
    path: segments,
  };
  if (query.length) url.query = query.map((q) => ({ key: q.name, value: "", description: q.schema?.description || "" }));

  const request = {
    method: method.toUpperCase(),
    header: [{ key: "Accept", value: "application/json", type: "text" }],
    url,
  };

  const auth = override.auth;
  if (auth === NO_AUTH) {
    request.auth = { type: "noauth" };
  } else if (auth) {
    request.auth = auth;
  }

  if (override.form) {
    request.header.push({ key: "Content-Type", value: "formdata", type: "text" });
    request.body = {
      mode: "formdata",
      formdata: [{ key: "images", type: "file", src: [], description: "Any jpg, png, webp or avif file." }],
    };
  } else if (override.body) {
    request.header.push({ key: "Content-Type", value: "application/json", type: "text" });
    request.body = { mode: "raw", raw: JSON.stringify(override.body, null, 2), options: { raw: { language: "json" } } };
  }

  const description = [op.description, override.note].filter(Boolean).join("\n\n");
  if (description) request.description = description;

  return { request, override };
};

const groups = new Map();
for (const [rawPath, pathItem] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const op = pathItem[method];
    if (!op) continue;
    const key = `${method.toUpperCase()} ${rawPath}`;
    const { request } = buildRequest(method, rawPath, op);
    const tag = (op.tags && op.tags[0]) || "default";
    if (!groups.has(tag)) groups.set(tag, []);

    const entry = { name: op.summary || `${method.toUpperCase()} ${rawPath}`, request, response: [] };

    const capture = CAPTURES[key];
    if (capture && capture.length) {
      entry.event = [{ listen: "test", script: { type: "text/javascript", exec: capture } }];
    }
    groups.get(tag).push(entry);
  }
}

const tagDescriptions = Object.fromEntries((spec.tags || []).map((t) => [t.name, t.description || ""]));

const makeLogin = (role, label) => ({
  name: label,
  request: {
    method: "POST",
    header: [{ key: "Content-Type", value: "application/json", type: "text" }],
    body: {
      mode: "raw",
      raw: JSON.stringify({ email: `{{${role}Email}}`, password: `{{${role}Password}}` }, null, 2),
      options: { raw: { language: "json" } },
    },
    url: { raw: `${BASE_URL}/auth/login`, host: [BASE_URL], path: ["auth", "login"] },
    auth: { type: "noauth" },
    description: `Stores ${role}Token and refreshToken in the collection variables, so the rest of the collection runs without copying tokens.`,
  },
  response: [],
  event: [
    {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          "const d = (pm.response.json() || {}).data || {};",
          `if (d.accessToken) pm.collectionVariables.set('${role}Token', d.accessToken);`,
          "if (d.accessToken) pm.collectionVariables.set('accessToken', d.accessToken);",
          "if (d.refreshToken) pm.collectionVariables.set('refreshToken', d.refreshToken);",
          `if (d.user && d.user.id) pm.collectionVariables.set('${role}UserId', d.user.id);`,
        ],
      },
    },
  ],
});

const walkthrough = [
  {
    name: "0. Log in as all three roles",
    request: {
      method: "GET",
      header: [],
      url: { raw: `${BASE_URL}/health`, host: [BASE_URL], path: ["health"] },
      auth: { type: "noauth" },
      description: "Confirms the deployment is up. Then run the three login requests that follow.",
    },
    response: [],
    response_name: "health",
  },
  makeLogin("admin", "1. Log in as ADMIN"),
  makeLogin("owner", "2. Log in as OWNER"),
  makeLogin("tenant", "3. Log in as TENANT"),
  {
    name: "4. Property detail (public, no token)",
    request: {
      method: "GET",
      header: [],
      url: { raw: `${BASE_URL}/properties/seed-property-1`, host: [BASE_URL], path: ["properties", "seed-property-1"] },
      auth: { type: "noauth" },
      description: "Seeded property with images, rooms and amenities.",
    },
    response: [],
  },
  {
    name: "5. Reset a room to AVAILABLE",
    request: {
      method: "PATCH",
      header: [{ key: "Content-Type", value: "application/json", type: "text" }],
      body: { mode: "raw", raw: JSON.stringify({ status: "AVAILABLE" }, null, 2), options: { raw: { language: "json" } } },
      url: { raw: `${BASE_URL}/rooms/seed-room-1/status`, host: [BASE_URL], path: ["rooms", "seed-room-1", "status"] },
      auth: OWNER,
      description:
        "Required before step 6. Creating a booking flips the room to RESERVED, so without this reset the second run of the walkthrough fails with 400 'Room is not available for booking'.",
    },
    response: [],
  },
  {
    name: "6. Create a booking (tenant)",
    request: {
      method: "POST",
      header: [{ key: "Content-Type", value: "application/json", type: "text" }],
      body: {
        mode: "raw",
        raw: JSON.stringify(
          { roomId: "seed-room-1", startDate: `{{bookingStartDate}}`, endDate: `{{bookingEndDate}}`, message: "Walkthrough booking." },
          null,
          2
        ),
        options: { raw: { language: "json" } },
      },
      url: { raw: `${BASE_URL}/bookings`, host: [BASE_URL], path: ["bookings"] },
      auth: TENANT,
      description: "Stores bookingId for the steps that follow.",
    },
    response: [],
    event: [{ listen: "test", script: { type: "text/javascript", exec: CAPTURES["POST /bookings"] } }],
  },
  {
    name: "7. Approve the booking (owner)",
    request: {
      method: "PATCH",
      header: [{ key: "Content-Type", value: "application/json", type: "text" }],
      body: { mode: "raw", raw: "{}", options: { raw: { language: "json" } } },
      url: { raw: `${BASE_URL}/bookings/{{bookingId}}/approve`, host: [BASE_URL], path: ["bookings", "{{bookingId}}", "approve"] },
      auth: OWNER,
      description:
        "Runs in a single transaction: booking becomes APPROVED, the room becomes OCCUPIED and a Stripe PaymentIntent is created.",
    },
    response: [],
  },
  {
    name: "8. Stripe checkout session (tenant)",
    request: {
      method: "POST",
      header: [],
      url: { raw: `${BASE_URL}/bookings/{{bookingId}}/checkout`, host: [BASE_URL], path: ["bookings", "{{bookingId}}", "checkout"] },
      auth: TENANT,
      description:
        "Returns a hosted checkoutUrl. Open it in the browser and pay with card 4242 4242 4242 4242 (no expiry or CVC needed). The webhook then flips the payment to SUCCEEDED.",
    },
    response: [],
  },
  {
    name: "9. RBAC proof: /admin/stats as OWNER (expect 403)",
    request: {
      method: "GET",
      header: [],
      url: { raw: `${BASE_URL}/admin/stats`, host: [BASE_URL], path: ["admin", "stats"] },
      auth: OWNER,
      description: "Same endpoint returns 200 with the admin token and 403 here. That contrast is the RBAC proof.",
    },
    response: [],
  },
  {
    name: "10. RBAC proof: /admin/stats as ADMIN (expect 200)",
    request: {
      method: "GET",
      header: [],
      url: { raw: `${BASE_URL}/admin/stats`, host: [BASE_URL], path: ["admin", "stats"] },
      auth: ADMIN,
      description: "Platform statistics: users, listings, occupancy, booking funnel, revenue, engagement, top properties.",
    },
    response: [],
  },
  {
    name: "11. Health: storage driver and cache backend",
    request: {
      method: "GET",
      header: [],
      url: { raw: `${BASE_URL}/health`, host: [BASE_URL], path: ["health"] },
      auth: { type: "noauth" },
      description: "Reports storage=cloudinary and cache=redis when both are configured.",
    },
    response: [],
  },
];

const collection = {
  info: {
    name: spec.info.title,
    description:
      `${spec.info.description}\n\n` +
      `Generated from docs/openapi.json by scripts/gen-postman.js (OpenAPI ${spec.openapi}).\n\n` +
      `HOW TO USE\n` +
      `1. Open the "Demo walkthrough (run in order)" folder and run requests 0-11 top to bottom.\n` +
      `2. The login requests capture adminToken, ownerToken, tenantToken and refreshToken into the\n` +
      `   collection variables, so every protected request runs without copying tokens by hand.\n` +
      `3. Create/booking/room requests capture propertyId, roomId, bookingId, paymentId and\n` +
      `   imageId automatically, so path parameters never need manual editing.\n` +
      `4. Requests 9 and 10 hit the same endpoint as different roles (403 vs 200) to demonstrate RBAC.\n` +
      `5. Request 8 returns a hosted Stripe checkout URL. Pay with test card 4242 4242 4242 4242.\n\n` +
      `Demo accounts\n` +
      `  admin   admin@housing.local / Admin1234!\n` +
      `  owner   owner@housing.local / Owner1234!\n` +
      `  tenant  tenant@housing.local / Tenant1234!\n\n` +
      `Set the "baseUrl" collection variable if you need to point this at another environment.`,
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
  event: [
    {
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          "if (!pm.collectionVariables.get('baseUrl')) {",
          "  pm.collectionVariables.set('baseUrl', 'https://housing-roommate-platform-backend.vercel.app/api/v1');",
          "}",
        ],
      },
    },
  ],
  variable: [
    { key: "baseUrl", value: "https://housing-roommate-platform-backend.vercel.app/api/v1", type: "string" },
    { key: "adminToken", value: "", type: "string" },
    { key: "ownerToken", value: "", type: "string" },
    { key: "tenantToken", value: "", type: "string" },
    { key: "accessToken", value: "", type: "string" },
    { key: "refreshToken", value: "", type: "string" },
    { key: "adminEmail", value: "admin@housing.local", type: "string" },
    { key: "adminPassword", value: "Admin1234!", type: "string" },
    { key: "ownerEmail", value: "owner@housing.local", type: "string" },
    { key: "ownerPassword", value: "Owner1234!", type: "string" },
    { key: "tenantEmail", value: "tenant@housing.local", type: "string" },
    { key: "tenantPassword", value: "Tenant1234!", type: "string" },
    { key: "propertyId", value: "seed-property-1", type: "string" },
    { key: "roomId", value: "seed-room-1", type: "string" },
    { key: "bookingId", value: "", type: "string" },
    { key: "paymentId", value: "", type: "string" },
    { key: "amenityId", value: "", type: "string" },
    { key: "reviewId", value: "", type: "string" },
    { key: "favoriteId", value: "", type: "string" },
    { key: "messageId", value: "", type: "string" },
    { key: "auditLogId", value: "", type: "string" },
    { key: "imageId", value: "", type: "string" },
    { key: "userId", value: "", type: "string" },
    { key: "ownerUserId", value: "", type: "string" },
    { key: "bookingStartDate", value: bookingStart, type: "string" },
    { key: "bookingEndDate", value: bookingEnd, type: "string" },
  ],
  item: [
    {
      name: "Demo walkthrough (run in order)",
      description:
        "A self-contained demo that exercises the whole platform. Run 0-11 in order; each request prepares the variables the next one needs.",
      item: walkthrough,
    },
    ...[...groups.entries()].map(([tag, items]) => ({
      name: tag,
      description: tagDescriptions[tag] || "",
      item: items,
    })),
  ],
};

const outDir = path.resolve(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "postman-collection.json");
fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));

const total = [...groups.values()].reduce((sum, items) => sum + items.length, 0) + walkthrough.length;
console.log(`Wrote ${outFile}`);
console.log(`  ${groups.size + 1} folders, ${total} requests (${walkthrough.length} of them in the ordered walkthrough)`);