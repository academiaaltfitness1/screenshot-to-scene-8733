const STX = 0x02;
const ETX = 0x03;
const MAX_FRAME_SIZE = 1029;

export function buildFrame(index, command) {
  if (!/^\\d{2}$/.test(index)) throw new Error("Henry index must contain exactly two digits");
  const payload = Buffer.from(`${index}+${command}`, "ascii");
  if (payload.length > 255) throw new Error("Henry message exceeds the one-byte protocol length");
  const size = Buffer.from([payload.length, 0x00]);
  let checksum = 0;
  for (const byte of Buffer.concat([size, payload])) checksum ^= byte;
  return Buffer.concat([Buffer.from([STX]), size, payload, Buffer.from([checksum, ETX])]);
}

export function parseFrame(frame) {
  if (!Buffer.isBuffer(frame) || frame.length < 8 || frame[0] !== STX || frame.at(-1) !== ETX) {
    throw new Error("Invalid Henry frame boundaries");
  }
  const size = frame[1];
  if (frame.length !== size + 5) throw new Error("Invalid Henry frame length");
  const payload = frame.subarray(3, 3 + size).toString("latin1");
  const index = payload.slice(0, 2);
  const parts = payload.slice(3).split("+");
  if (payload[2] !== "+" || parts.length < 2) throw new Error("Invalid Henry frame payload");
  const [command, version, ...data] = parts;
  return { index, command, err_or_version: version, data: data.join("+"), raw: frame };
}

export class FrameReader {
  constructor(socket) {
    this.buffer = Buffer.alloc(0);
    this.waiters = [];
    this.failure = null;
    socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
    socket.on("error", (error) => this.fail(error));
    socket.on("close", () => this.fail(new Error("Henry TCP connection closed")));
  }

  drain() {
    while (this.waiters.length) {
      const start = this.buffer.indexOf(STX);
      if (start < 0) {
        this.buffer = Buffer.alloc(0);
        return;
      }
      if (start > 0) this.buffer = this.buffer.subarray(start);
      if (this.buffer.length < 5) return;
      const total = this.buffer[1] + 5;
      if (total > MAX_FRAME_SIZE) {
        this.fail(new Error("Henry frame is too large"));
        return;
      }
      if (this.buffer.length < total) return;
      const frame = this.buffer.subarray(0, total);
      this.buffer = this.buffer.subarray(total);
      const waiter = this.waiters.shift();
      try { waiter.resolve(parseFrame(frame)); }
      catch (error) { waiter.reject(error); }
    }
  }

  next(timeoutMs = 30000) {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      };
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(waiter);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(new Error("Timeout waiting for Henry event"));
      }, timeoutMs);
      this.waiters.push(waiter);
      this.drain();
    });
  }

  fail(error) {
    if (this.failure) return;
    this.failure = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }
}

export function allowCommand(seconds, message = "ACESSO LIBERADO") {
  return `REON+00+6]${seconds}]${message}]2`;
}

export function denyCommand(seconds, message = "ACESSO NEGADO") {
  return `REON+00+30]${seconds}]${message}]1`;
}
