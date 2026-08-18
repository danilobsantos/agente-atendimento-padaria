import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs/promises";
import path from "path";
import { GET } from "../src/app/uploads/[filename]/route";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const TEST_FILE_NAME = "test-logo-sample.png";
const TEST_FILE_PATH = path.join(UPLOADS_DIR, TEST_FILE_NAME);

describe("Dynamic /uploads/[filename] Route Handler", () => {
  before(async () => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    // Write a dummy PNG byte payload
    await fs.writeFile(TEST_FILE_PATH, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  after(async () => {
    await fs.rm(TEST_FILE_PATH, { force: true });
  });

  test("serves existing uploaded file with 200 and image/png Content-Type", async () => {
    const res = await GET(
      new Request(`http://localhost:3000/uploads/${TEST_FILE_NAME}`),
      { params: Promise.resolve({ filename: TEST_FILE_NAME }) }
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/png");
    assert.ok(res.headers.get("Cache-Control")?.includes("max-age"));
    
    const buffer = Buffer.from(await res.arrayBuffer());
    assert.equal(buffer.length, 8);
    assert.equal(buffer[0], 0x89);
  });

  test("returns 404 when file does not exist", async () => {
    const res = await GET(
      new Request("http://localhost:3000/uploads/non-existent-logo.png"),
      { params: Promise.resolve({ filename: "non-existent-logo.png" }) }
    );

    assert.equal(res.status, 404);
  });

  test("rejects non-image extensions with 400", async () => {
    const res = await GET(
      new Request("http://localhost:3000/uploads/hack.exe"),
      { params: Promise.resolve({ filename: "hack.exe" }) }
    );

    assert.equal(res.status, 400);
  });

  test("rejects path traversal attempts with 400", async () => {
    const res = await GET(
      new Request("http://localhost:3000/uploads/..%2F..%2Fpackage.json"),
      { params: Promise.resolve({ filename: "../../package.json" }) }
    );

    assert.equal(res.status, 400);
  });
});
