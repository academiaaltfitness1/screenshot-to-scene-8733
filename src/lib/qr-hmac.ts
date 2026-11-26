import { createHmac } from "node:crypto";

export function makeTemporaryQrCode(secret: string, matricula: string | number, windowNumber: number) {
  const digest = createHmac("sha256", secret).update(String(matricula) + ":" + windowNumber).digest();
  return String(digest.readUInt32BE(0) % 100000000).padStart(8, "0");
}
