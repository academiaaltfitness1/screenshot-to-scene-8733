import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildFrame, parseFrame, FrameReader, allowCommand, denyCommand } from "./henry-protocol.js";

test("Henry packet round-trip preserves index, command and payload", () => {
  const frame = buildFrame("07", "REON+00+6]5]ACESSO LIBERADO]2");
  const parsed = parseFrame(frame);
  assert.equal(parsed.index, "07");
  assert.equal(parsed.command, "REON");
  assert.equal(parsed.err_or_version, "00");
  assert.equal(parsed.data, "6]5]ACESSO LIBERADO]2");
});

test("FrameReader handles fragmented and coalesced TCP frames", async () => {
  const socket = new EventEmitter();
  const reader = new FrameReader(socket);
  const first = buildFrame("01", "REON+00+6]5]OK]2");
  const second = buildFrame("02", "REON+00+30]5]BLOQUEADO]1");
  const pendingFirst = reader.next(1000);
  socket.emit("data", first.subarray(0, 4));
  socket.emit("data", Buffer.concat([first.subarray(4), second]));
  assert.equal((await pendingFirst).index, "01");
  assert.equal((await reader.next(1000)).index, "02");
});

test("access commands use configured release time and safe display text", () => {
  assert.equal(allowCommand(5, "Bem-vindo à academia"), "REON+00+6]5]Bem-vindo a academia]2");
  assert.equal(denyCommand(5, "Mensalidade vencida"), "REON+00+30]5]Mensalidade vencida]1");
});
