/* Redtooth Protocol — codec
   Encoding scheme:
   1. SVG text -> UTF-8 bytes -> deflate-compress (CompressionStream, fallback to raw bytes)
   2. Bytes -> Base32 (RFC4648, Crockford-safe alphabet, no padding ambiguity)
      Alphabet excludes I, L, O, U to avoid being misheard/mistyped over the phone.
   3. Output split into 5-char groups separated by single spaces, 8 groups per line.
   4. A 4-character checksum group (CRC-16 of the payload, base32) is appended,
      separated by a "::" marker, so the receiver can verify the transcription
      before reverting.
*/

const RT_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32, 32 chars, excludes I/L/O/U
const RT_BASE = RT_ALPHABET.length;

// ---------- bit-level base32 (arbitrary alphabet) ----------
function bytesToRTString(bytes) {
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += RT_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += RT_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function rtStringToBytes(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str) {
    const idx = RT_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // ignore separators/whitespace
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// ---------- CRC-16/CCITT-FALSE checksum ----------
function crc16(bytes) {
  let crc = 0xFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc;
}

function crc16ToRTString(crc) {
  // 16 bits -> 4 base32 chars (20 bits, top padded with zeros)
  const bytes = new Uint8Array([(crc >>> 8) & 0xff, crc & 0xff]);
  let bits = 0, value = 0, out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
  }
  // pad to 20 bits
  value = value << (20 - bits);
  bits = 20;
  while (bits >= 5) {
    out += RT_ALPHABET[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
  return out;
}

// ---------- compression ----------
async function compressBytes(bytes) {
  if (typeof CompressionStream === "undefined") return { data: bytes, compressed: false };
  try {
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const out = [];
    const reader = cs.readable.getReader();
    let r;
    while (!(r = await reader.read()).done) out.push(r.value);
    const total = out.reduce((a, c) => a + c.length, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of out) { merged.set(c, off); off += c.length; }
    return { data: merged, compressed: true };
  } catch (e) {
    return { data: bytes, compressed: false };
  }
}

async function decompressBytes(bytes, compressed) {
  if (!compressed) return bytes;
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const out = [];
  const reader = ds.readable.getReader();
  let r;
  while (!(r = await reader.read()).done) out.push(r.value);
  const total = out.reduce((a, c) => a + c.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of out) { merged.set(c, off); off += c.length; }
  return merged;
}

// ---------- public API ----------

/**
 * Encode an SVG text string into a Redtooth transmission code.
 * Returns { code, groups, checksumGroup, raw, byteLength }
 */
async function rtEncodeSVG(svgText) {
  const utf8 = new TextEncoder().encode(svgText);
  const { data, compressed } = await compressBytes(utf8);

  // Prefix one flag byte: bit0 = compressed
  const payload = new Uint8Array(data.length + 1);
  payload[0] = compressed ? 1 : 0;
  payload.set(data, 1);

  const checksum = crc16(payload);
  const body = bytesToRTString(payload);
  const checksumGroup = crc16ToRTString(checksum);

  const groups = [];
  for (let i = 0; i < body.length; i += 5) groups.push(body.slice(i, i + 5));

  const code = groups.join(" ") + " :: " + checksumGroup;

  return {
    code,
    groups,
    checksumGroup,
    raw: body,
    byteLength: payload.length,
    originalBytes: utf8.length,
  };
}

/**
 * Decode a Redtooth transmission code back into an SVG text string.
 * Throws an Error with a human-readable message on failure.
 * Returns { svgText, checksumOk }
 */
async function rtDecodeToSVG(inputCode) {
  if (!inputCode || !inputCode.trim()) {
    throw new Error("No transmission code entered.");
  }

  let working = inputCode.trim();
  let providedChecksum = null;

  const sepIndex = working.indexOf("::");
  if (sepIndex !== -1) {
    providedChecksum = working.slice(sepIndex + 2).trim().toUpperCase();
    working = working.slice(0, sepIndex);
  }

  // Normalize: uppercase, strip everything not in the alphabet
  const cleaned = working.toUpperCase().split("").filter(c => RT_ALPHABET.includes(c)).join("");

  if (cleaned.length === 0) {
    throw new Error("Transmission code contains no valid Redtooth characters.");
  }

  const payload = rtStringToBytes(cleaned);

  if (payload.length < 1) {
    throw new Error("Transmission code is too short to contain a payload.");
  }

  let checksumOk = null;
  if (providedChecksum) {
    const cleanChecksum = providedChecksum.split("").filter(c => RT_ALPHABET.includes(c)).join("");
    const actual = crc16(payload);
    const actualGroup = crc16ToRTString(actual);
    checksumOk = (cleanChecksum === actualGroup);
  }

  const flag = payload[0];
  const compressed = (flag & 1) === 1;
  const body = payload.slice(1);

  let bytes;
  try {
    bytes = await decompressBytes(body, compressed);
  } catch (e) {
    throw new Error("Failed to reconstruct file — the transmission code appears to be corrupted or mistyped.");
  }

  let svgText;
  try {
    svgText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) {
    throw new Error("Failed to reconstruct file — decoded data is not valid text. Check the transmission code for typos.");
  }

  const trimmed = svgText.trim();
  if (!trimmed.toLowerCase().includes("<svg")) {
    throw new Error("Decoded data does not look like an SVG file. Check the transmission code for typos.");
  }

  return { svgText, checksumOk };
}
