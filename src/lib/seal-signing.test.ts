import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySeal, verifyToken, type SealJwk } from "@/lib/seal-proof";
import { publicJwk, signClaims, signCompact, thumbprint } from "@/lib/seal-signing";

// RFC 8037, appendix A: the published Ed25519 test key, and the JWS it must produce.
const RFC = {
  d: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
  x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  thumbprint: "kPrK_qmxVWaYVA9wwBF6Iuo3vVzz7TxHCTwXBygrS4k",
  jws: "eyJhbGciOiJFZERTQSJ9.RXhhbXBsZSBvZiBFZDI1NTE5IHNpZ25pbmc.hgyY0il_MGCjP0JzlnLWG1PPOt7-09PGcvMg3AIbQR6dWbhijcNR4ki4iylGjg5BhVsPt9g7sVvpAr_MuM0KAg",
};
const rfcKey = createPrivateKey({ key: { kty: "OKP", crv: "Ed25519", d: RFC.d, x: RFC.x }, format: "jwk" });
const rfcJwk: SealJwk = { kty: "OKP", crv: "Ed25519", x: RFC.x, kid: RFC.thumbprint };

const now = new Date("2026-11-04T12:00:00.000Z");
const seconds = (d: Date) => Math.floor(d.getTime() / 1000);
const claims = { iss: "constela", sub: "Ceiba Foods", level: "silver", vacancyIds: ["v-1"], iat: seconds(now), exp: seconds(now) + 3600, log: { size: 1, head: "a".repeat(64) } };
const flip = (token: string, part: number) => token.split(".").map((p, i) => (i === part ? (p[5] === "A" ? `${p.slice(0, 5)}B${p.slice(6)}` : `${p.slice(0, 5)}A${p.slice(6)}`) : p)).join(".");

describe("standard JWS with Ed25519", () => {
  it("reproduces the RFC 8037 signature byte for byte", () => {
    expect(signCompact({ alg: "EdDSA" }, "Example of Ed25519 signing", rfcKey)).toBe(RFC.jws);
  });

  it("works out the RFC 7638 key id of the RFC 8037 key", () => {
    expect(thumbprint(RFC.x)).toBe(RFC.thumbprint);
    expect(publicJwk(rfcKey)).toEqual(rfcJwk);
  });

  it("checks the RFC token on WebCrypto, a different implementation from the signer", async () => {
    await expect(verifyToken(RFC.jws, rfcJwk)).resolves.toEqual({ ok: true, value: "Example of Ed25519 signing" });
  });
});

describe("verifySeal", () => {
  it("accepts a seal signed now", async () => {
    await expect(verifySeal(signClaims(claims, rfcKey), rfcJwk, now)).resolves.toEqual({ ok: true, value: claims });
  });

  it("refuses a seal changed after signing, in the claims or in the signature", async () => {
    const token = signClaims(claims, rfcKey);
    await expect(verifySeal(flip(token, 1), rfcJwk, now)).resolves.toMatchObject({ ok: false });
    await expect(verifySeal(flip(token, 2), rfcJwk, now)).resolves.toEqual({ ok: false, why: "signature" });
  });

  it("refuses a seal that claims a higher level with the old signature", async () => {
    const [header, , signature] = signClaims(claims, rfcKey).split(".");
    const gold = Buffer.from(JSON.stringify({ ...claims, level: "gold" })).toString("base64url");
    await expect(verifySeal(`${header}.${gold}.${signature}`, rfcJwk, now)).resolves.toEqual({ ok: false, why: "signature" });
  });

  it("refuses a seal signed by any other key", async () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    await expect(verifySeal(signClaims(claims, other), rfcJwk, now)).resolves.toEqual({ ok: false, why: "key" });
    const noKid = signCompact({ alg: "EdDSA" }, JSON.stringify(claims), other);
    await expect(verifySeal(noKid, rfcJwk, now)).resolves.toEqual({ ok: false, why: "signature" });
  });

  it('refuses "alg": "none" and any other algorithm', async () => {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const none = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${payload}.`;
    await expect(verifySeal(none, rfcJwk, now)).resolves.toEqual({ ok: false, why: "algorithm" });
    const hs = `${Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")}.${payload}.abc`;
    await expect(verifySeal(hs, rfcJwk, now)).resolves.toEqual({ ok: false, why: "algorithm" });
  });

  it("refuses a seal after it expires, so an old seal can't outlive a drop", async () => {
    const later = new Date(now.getTime() + 3601 * 1000);
    await expect(verifySeal(signClaims(claims, rfcKey), rfcJwk, later)).resolves.toEqual({ ok: false, why: "expired" });
  });

  it("refuses another issuer and anything that isn't a token", async () => {
    await expect(verifySeal(signClaims({ ...claims, iss: "someone" }, rfcKey), rfcJwk, now)).resolves.toEqual({ ok: false, why: "issuer" });
    await expect(verifySeal("not a token", rfcJwk, now)).resolves.toEqual({ ok: false, why: "format" });
    await expect(verifySeal("a.b", rfcJwk, now)).resolves.toEqual({ ok: false, why: "format" });
    await expect(verifySeal("%%%.###.!!!", rfcJwk, now)).resolves.toEqual({ ok: false, why: "format" });
  });
});
