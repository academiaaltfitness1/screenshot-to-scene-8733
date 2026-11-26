type PixPayloadInput = {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
};

function field(id: string, value: string) {
  const bytes = new TextEncoder().encode(value);
  return id + String(bytes.length).padStart(2, "0") + value;
}

function ascii(value: string, max: number) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().toUpperCase().slice(0, max);
}

function crc16Ccitt(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Builds a BR Code Pix payload with a fixed amount for the selected receivable. */
export function buildPixPayload(input: PixPayloadInput) {
  const key = input.key.trim();
  const amount = Number(input.amount);
  if (!key || !Number.isFinite(amount) || amount <= 0) return "";
  const merchant = ascii(input.merchantName || "ALT FITNESS", 25) || "ALT FITNESS";
  const city = ascii(input.merchantCity || "SUZANO", 15) || "SUZANO";
  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", key);
  const additional = field("05", "***");
  const payload = [
    field("00", "01"),
    field("01", "11"),
    field("26", merchantAccount),
    field("52", "0000"),
    field("53", "986"),
    field("54", amount.toFixed(2)),
    field("58", "BR"),
    field("59", merchant),
    field("60", city),
    field("62", additional),
    "6304",
  ].join("");
  return payload + crc16Ccitt(payload);
}
