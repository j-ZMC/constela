import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { spawn } from "node:child_process";
import { POST } from "@/app/api/resume/parse/route";

const profile = {
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "",
  skills_found: ["Python"],
  projects: [],
  experience: [],
  sectors: ["Technology"],
};

function pdfFile(contents: Uint8Array = new TextEncoder().encode("%PDF-1.4 test")) {
  const blobBytes = new ArrayBuffer(contents.byteLength);
  new Uint8Array(blobBytes).set(contents);
  return new File([blobBytes], "resume.pdf", { type: "application/pdf" });
}

function requestWith(file: File) {
  const form = new FormData();
  form.set("file", file);
  return new Request("http://localhost/api/resume/parse", { method: "POST", body: form });
}

function mockParser(stdout: string, exitCode = 0) {
  const stdin = new PassThrough();
  const stdoutStream = new PassThrough();
  const stderr = new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stdout: stdoutStream,
    stderr,
    kill: vi.fn(() => true),
  });

  spawnMock.mockReturnValue(child);
  stdin.once("finish", () => {
    stdoutStream.end(stdout);
    child.emit("close", exitCode, null);
  });
  return stdin;
}

describe("POST /api/resume/parse", () => {
  beforeEach(() => spawnMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("parses a validated PDF in memory and returns the profile", async () => {
    const stdin = mockParser(JSON.stringify({ profile }));
    const response = await POST(requestWith(pdfFile()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ profile });
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringContaining("resume_parser.py"), "--stdin-json"],
      expect.objectContaining({ stdio: ["pipe", "pipe", "pipe"] }),
    );
    expect(stdin.read()?.toString()).toBe("%PDF-1.4 test");
  });

  it("rejects a file that is not actually a PDF", async () => {
    const response = await POST(requestWith(
      new File(["not a PDF"], "resume.pdf", { type: "application/pdf" }),
    ));

    expect(response.status).toBe(400);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("rejects files larger than 10 MB before parsing", async () => {
    const contents = new Uint8Array(10 * 1024 * 1024 + 1);
    contents.set(new TextEncoder().encode("%PDF-"));
    const response = await POST(requestWith(pdfFile(contents)));

    expect(response.status).toBe(413);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports scanned or malformed PDFs as unreadable", async () => {
    mockParser("", 2);
    const response = await POST(requestWith(pdfFile()));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "unreadable_pdf", message: "Could not read this PDF. Use a text-based PDF." },
    });
  });

  it("reports unexpected parser exits as a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockParser("", 1);
    const response = await POST(requestWith(pdfFile()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "parser_failed", message: "Could not read this PDF right now." },
    });
  });
});
