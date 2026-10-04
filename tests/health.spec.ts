import request from "supertest";
import { app } from "../src/app";

describe("Health & Docs", () => {
  it("api base resolves to a landing payload", async () => {
    const res = await request(app).get("/api/v1");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.name).toBe("Housing & Roommate Platform API");
    expect(res.body.documentation).toBe("/api/v1/docs/openapi.json");
    expect(Array.isArray(res.body.endpoints)).toBe(true);
    expect(res.body.endpoints).toContain("bookings");
  });
  it("health endpoint reports ok", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.db).toBe("connected");
  });

  it("live and ready probes", async () => {
    const live = await request(app).get("/api/v1/health/live");
    expect(live.status).toBe(200);
    const ready = await request(app).get("/api/v1/health/ready");
    expect(ready.status).toBe(200);
  });

  it("serves OpenAPI spec", async () => {
    const res = await request(app).get("/api/v1/docs/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.paths).toBeDefined();
  });

  it("redirects /docs to openapi json", async () => {
    const res = await request(app).get("/docs").redirects(0);
    expect(res.status).toBe(302);
  });
});
