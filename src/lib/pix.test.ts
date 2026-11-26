import { describe, expect, it } from "vitest";
import { buildPixPayload } from "./pix";

describe("buildPixPayload", () => {
  it("gera BR Code Pix com valor fixo e CRC16 correto", () => {
    const payload = buildPixPayload({
      key: "123e4567-e89b-12d3-a456-426614174000",
      merchantName: "ALT FITNESS",
      merchantCity: "SUZANO",
      amount: 10,
    });
    expect(payload).toBe("00020101021126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5911ALT FITNESS6006SUZANO62070503***6304E53C");
  });

  it("não gera cobrança com valor inválido", () => {
    expect(buildPixPayload({ key: "chave", merchantName: "ALT FITNESS", merchantCity: "SUZANO", amount: 0 })).toBe("");
    expect(buildPixPayload({ key: "", merchantName: "ALT FITNESS", merchantCity: "SUZANO", amount: 10 })).toBe("");
  });
});
