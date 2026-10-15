import { test, expect } from "@playwright/test";
test("API rejects foreign assets, missing media, unsafe uploads, and cross-origin writes", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { Origin: "http://localhost:3000" },
  });
  const stranger = await playwright.request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { Origin: "http://localhost:3000" },
  });
  const stamp = Date.now();
  for (const [context, email] of [
    [owner, `owner-${stamp}@example.test`],
    [stranger, `stranger-${stamp}@example.test`],
  ] as const) {
    const r = await context.post("/api/auth/register", {
      data: {
        email,
        name: "Security Test",
        password: "a separate test password",
      },
    });
    expect(r.status()).toBe(200);
  }
  const upload = await owner.post("/api/assets", {
    multipart: {
      file: {
        name: "owned.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=",
          "base64",
        ),
      },
      provenance: "Test-only original PNG fixture",
      rightsConfirmed: "true",
    },
  });
  expect(upload.status(), await upload.text()).toBe(201);
  const asset = await upload.json();
  const foreign = await stranger.get(`/api/assets/${asset.id}`);
  expect(foreign.status()).toBe(404);
  expect(await foreign.json()).toHaveProperty("error");
  const missing = await owner.get(`/api/assets/${crypto.randomUUID()}`);
  expect(missing.status()).toBe(404);
  const csrf = await owner.patch("/api/settings", {
    headers: { Origin: "https://attacker.example" },
    data: { name: "Changed", workspaceName: "Changed" },
  });
  expect(csrf.status()).toBe(403);
  const malicious = await owner.post("/api/assets", {
    multipart: {
      file: {
        name: "fake.png",
        mimeType: "image/png",
        buffer: Buffer.from("This is not an image."),
      },
      provenance: "Invalid test fixture",
      rightsConfirmed: "true",
    },
  });
  expect(malicious.status()).toBe(400);
  const project = await owner.post("/api/projects", {
    data: {
      title: "Private project",
      mode: "script",
      content: "Original words.",
      duration: 5,
      rightsConfirmed: true,
    },
  });
  expect(project.status()).toBe(201);
  const saved = await project.json();
  const stolen = await stranger.get(`/api/projects/${saved.id}`);
  expect(stolen.status()).toBe(404);
  const foreignCreate = await stranger.post("/api/projects", {
    data: {
      title: "Foreign asset attempt",
      mode: "script",
      content: "Original words.",
      duration: 5,
      sourceAssetId: asset.id,
      rightsConfirmed: true,
    },
  });
  expect(foreignCreate.status()).toBe(404);
  await owner.dispose();
  await stranger.dispose();
});
