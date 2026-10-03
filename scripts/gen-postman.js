/**
 * Converts docs/openapi.json into a Postman Collection v2.1 file.
 * Run after `npm run open:gen`:
 *   node scripts/gen-postman.js
 */
const fs = require("fs");
const path = require("path");

const specPath = path.resolve(__dirname, "..", "docs", "openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const METHODS = ["get", "post", "put", "patch", "delete"];
const BASE_URL = "{{baseUrl}}";

const toCurlExample = (schema) => {
  if (!schema) return null;
  const sample = {};
  for (const [key, value] of Object.entries(schema.properties || {})) {
    if (value.example !== undefined) sample[key] = value.example;
    else if (value.default !== undefined) sample[key] = value.default;
    else if (value.enum) sample[key] = value.enum[0];
    else if (value.type === "integer" || value.type === "number") sample[key] = 0;
    else if (value.type === "boolean") sample[key] = false;
    else if (value.type === "array") sample[key] = [];
    else if (value.type === "object") sample[key] = {};
    else sample[key] = `{{${key}}}`;
  }
  return JSON.stringify(sample, null, 2);
};

const buildRequest = (method, rawPath, op) => {
  const segments = rawPath.split("/").filter(Boolean);
  const pathSegments = segments.map((segment) =>
    segment.startsWith("{") && segment.endsWith("}") ? `:${segment.slice(1, -1)}` : segment
  );

  const query = (op.parameters || []).filter((p) => p.in === "query");
  const url = {
    raw: [BASE_URL, ...pathSegments].join("/") + (query.length ? "?" + query.map((q) => `${q.name}=`).join("&") : ""),
    host: [BASE_URL],
    path: pathSegments,
  };
  if (query.length) url.query = query.map((q) => ({ key: q.name, value: "", description: q.description || q.schema?.description || "" }));

  const request = { method: method.toUpperCase(), header: [], url };

  if (op.security !== false) {
    request.header.push({ key: "Authorization", value: "Bearer {{accessToken}}", type: "text" });
  }
  request.header.push({ key: "Accept", value: "application/json", type: "text" });

  const content = op.requestBody?.content || {};
  const jsonSchema = content["application/json"]?.schema;
  if (jsonSchema) {
    request.header.push({ key: "Content-Type", value: "application/json", type: "text" });
    request.body = { mode: "raw", raw: toCurlExample(jsonSchema), options: { raw: { language: "json" } } };
  } else if (content["multipart/form-data"]) {
    request.header.push({ key: "Content-Type", value: "formdata", type: "text" });
    request.body = {
      mode: "formdata",
      formdata: [{ key: "images", type: "file", src: [], description: "Image file(s) to upload" }],
    };
  }

  if (op.responses?.["422"] || op.responses?.["400"]) {
    request.description = `Documents validation failures. ${op.description || ""}`.trim();
  }

  return request;
};

const TOKEN_CAPTURE = [
  "const body = pm.response.json();",
  "if (body && body.data && body.data.accessToken) {",
  "  pm.collectionVariables.set('accessToken', body.data.accessToken);",
  "}",
  "if (body && body.data && body.data.refreshToken) {",
  "  pm.collectionVariables.set('refreshToken', body.data.refreshToken);",
  "}",
];

/** Endpoints whose response should be promoted into collection variables. */
const capturesToken = (method, rawPath) =>
  method === "post" && (rawPath === "/auth/login" || rawPath.startsWith("/auth/register/") || rawPath === "/auth/refresh");

/** POST endpoints that create a resource, mapped to the variable holding its id. */
const CREATES = new Map([
  ["/properties", "propertyId"],
  ["/properties/{propertyId}/rooms", "roomId"],
  ["/bookings", "bookingId"],
]);

const groups = new Map();
for (const [rawPath, pathItem] of Object.entries(spec.paths)) {
  for (const method of METHODS) {
    const op = pathItem[method];
    if (!op) continue;
    const tag = (op.tags && op.tags[0]) || "default";
    if (!groups.has(tag)) groups.set(tag, []);
    const entry = { name: op.summary || `${method.toUpperCase()} ${rawPath}`, request: buildRequest(method, rawPath, op), response: [] };

    if (capturesToken(method, rawPath)) {
      entry.event = [{ listen: "test", script: { type: "text/javascript", exec: TOKEN_CAPTURE } }];
    }

    const createdVariable = method === "post" ? CREATES.get(rawPath) : undefined;
    if (createdVariable) {
      entry.event = [
        {
          listen: "test",
          script: {
            type: "text/javascript",
            exec: [
              "const body = pm.response.json();",
              "if (body && body.data && body.data.id) {",
              `  pm.collectionVariables.set('${createdVariable}', body.data.id);`,
              "}",
            ],
          },
        },
      ];
    }

    groups.get(tag).push(entry);
  }
}

const tagDescriptions = Object.fromEntries((spec.tags || []).map((t) => [t.name, t.description || ""]));

const collection = {
  info: {
    name: spec.info.title,
    description:
      `${spec.info.description}\n\nGenerated from docs/openapi.json (OpenAPI ${spec.openapi}).\n` +
      `Set the "baseUrl" variable to the server root, e.g. http://localhost:4000/api/v1.\n` +
      `Demo admin: admin@housing.local / Admin1234!\n\n` +
      `Auth flows capture tokens automatically: the Auth folder scripts store accessToken and refreshToken\n` +
      `in the collection variables, so protected requests work without manual copying.`,
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
          "  pm.collectionVariables.set('baseUrl', 'http://localhost:4000/api/v1');",
          "}",
        ],
      },
    },
  ],
  variable: [
    { key: "baseUrl", value: "http://localhost:4000/api/v1", type: "string" },
    { key: "accessToken", value: "", type: "string" },
    { key: "refreshToken", value: "", type: "string" },
    { key: "adminEmail", value: "admin@housing.local", type: "string" },
    { key: "adminPassword", value: "Admin1234!", type: "string" },
    { key: "ownerEmail", value: "owner@housing.local", type: "string" },
    { key: "ownerPassword", value: "Owner1234!", type: "string" },
    { key: "tenantEmail", value: "tenant@housing.local", type: "string" },
    { key: "tenantPassword", value: "Tenant1234!", type: "string" },
    { key: "id", value: "", type: "string" },
    { key: "propertyId", value: "", type: "string" },
    { key: "roomId", value: "", type: "string" },
    { key: "bookingId", value: "", type: "string" },
    { key: "paymentId", value: "", type: "string" },
  ],
  item: [...groups.entries()].map(([tag, items]) => ({
    name: tag,
    description: tagDescriptions[tag] || "",
    item: items,
  })),
};

const outDir = path.resolve(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "postman-collection.json");
fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));

const total = [...groups.values()].reduce((sum, items) => sum + items.length, 0);
console.log(`Wrote ${outFile} with ${groups.size} folders and ${total} requests`);