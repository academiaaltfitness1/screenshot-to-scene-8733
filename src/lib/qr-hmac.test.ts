import { describe, expect, it } from "vitest";
import { makeTemporaryQrCode } from "./qr-hmac";

describe("temporary Henry QR", () => {
  it("matches the HMAC token expected by the local agent", () => {
    expect(makeTemporaryQrCode("0123456789abcdef0123456789abcdef", "12345", 60000000)).toBe("75025325");
  });
});
