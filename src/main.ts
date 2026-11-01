import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="topbar"><a class="brand" href="#"><span class="brand-icon">◈</span> StegoSafe</a><span class="local">● Browser-only processing</span></header>
  <main>
    <section class="hero"><div class="eyebrow">PRIVATE BY DESIGN · OPEN SOURCE</div><h1>Hide in <span>plain sight.</span></h1><p>Encrypt a message, conceal it inside an image, and recover it with your password. Your files stay on this device.</p></section>
    <nav class="tabs" aria-label="Tools"><button class="tab active" data-tab="encode">↗ Encode message</button><button class="tab" data-tab="decode">↙ Decode image</button></nav>
    <section class="panel" id="encode-panel">
      <label class="field-label" for="encode-image">1. Choose a PNG image</label>
      <label class="drop" for="encode-image"><span class="drop-icon">＋</span><strong id="encode-file-name">Choose an image</strong><small>PNG recommended · select from your device</small></label>
      <input id="encode-image" type="file" accept="image/png" hidden />
      <label class="field-label" for="message">2. Secret message</label><textarea id="message" rows="4" placeholder="Write the message you want to hide…"></textarea>
      <label class="field-label" for="password">3. Encryption password</label><input id="password" type="password" autocomplete="new-password" placeholder="Use a strong password (8+ characters)" />
      <button class="primary" id="encode-button">Encrypt & hide message</button>
      <p class="status" id="encode-status" role="status"></p>
      <a class="download hidden" id="download-image" download="stegosafe.png">Download encoded PNG ↓</a>
    </section>
    <section class="panel hidden" id="decode-panel">
      <label class="field-label" for="decode-image">1. Choose the encoded PNG</label>
      <label class="drop" for="decode-image"><span class="drop-icon">＋</span><strong id="decode-file-name">Choose an image</strong><small>Use the original encoded PNG; avoid re-saving or resizing it</small></label>
      <input id="decode-image" type="file" accept="image/png" hidden />
      <label class="field-label" for="decode-password">2. Decryption password</label><input id="decode-password" type="password" autocomplete="current-password" placeholder="Enter the password used to encode" />
      <button class="primary" id="decode-button">Extract & decrypt</button>
      <p class="status" id="decode-status" role="status"></p>
      <label class="field-label" for="decoded-message">Recovered message</label><textarea id="decoded-message" rows="5" readonly placeholder="Your recovered message appears here…"></textarea>
    </section>
    <aside class="notice"><strong>Important</strong><p>StegoSafe is an early MVP. Use PNG files only. Keep your password safe: it cannot be recovered. This tool has not yet undergone an independent security audit. Do not rely on it for high-risk secrets.</p></aside>
  </main>
  <footer>StegoSafe · Open-source image steganography · <a href="https://github.com/vajidek/stegosafe" target="_blank" rel="noreferrer">GitHub</a></footer>
`;

let encodeFile: File | null = null;
let decodeFile: File | null = null;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = (id: string, message: string, error = false) => {
  const el = $(id); el.textContent = message; el.className = "status" + (error ? " error" : " success");
};
document.querySelectorAll<HTMLButtonElement>(".tab").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  button.classList.add("active");
  $("encode-panel").classList.toggle("hidden", button.dataset.tab !== "encode");
  $("decode-panel").classList.toggle("hidden", button.dataset.tab !== "decode");
}));
$("encode-image").addEventListener("change", (e) => {
  encodeFile = (e.target as HTMLInputElement).files?.[0] ?? null;
  $("encode-file-name").textContent = encodeFile?.name ?? "Choose an image";
});
$("decode-image").addEventListener("change", (e) => {
  decodeFile = (e.target as HTMLInputElement).files?.[0] ?? null;
  $("decode-file-name").textContent = decodeFile?.name ?? "Choose an image";
});

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt as BufferSource, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const byte of bytes) for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
}
function bitsToBytes(bits: number[]): Uint8Array {
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) for (let j = 0; j < 8; j++) out[i] = (out[i] << 1) | bits[i * 8 + j];
  return out;
}
function imageData(file: File): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; data: ImageData }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas"); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas is not supported by this browser."));
      ctx.drawImage(img, 0, 0);
      resolve({ canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
    img.src = url;
  });
}
function embed(data: ImageData, payload: Uint8Array): void {
  const bits = bytesToBits(payload);
  const capacity = data.width * data.height * 3;
  if (bits.length > capacity) throw new Error("Message is too large for this image. Choose a larger PNG.");
  let bit = 0;
  for (let i = 0; i < data.data.length && bit < bits.length; i++) {
    if (i % 4 === 3) continue;
    data.data[i] = (data.data[i] & 0xfe) | bits[bit++];
  }
}
function extract(data: ImageData): Uint8Array {
  const bits: number[] = [];
  for (let i = 0; i < data.data.length; i++) if (i % 4 !== 3) bits.push(data.data[i] & 1);
  const bytes = bitsToBytes(bits);
  if (bytes.length < 4 || new TextDecoder().decode(bytes.slice(0, 4)) !== "SGS1") throw new Error("No StegoSafe payload found in this image.");
  const length = new DataView(bytes.buffer).getUint32(4, false);
  if (length > bytes.length - 8) throw new Error("Image data is incomplete or corrupted.");
  return bytes.slice(8, 8 + length);
}
$("encode-button").addEventListener("click", async () => {
  try {
    if (!encodeFile) throw new Error("Select a PNG image first.");
    const message = $("message").value;
    const password = $("password").value;
    if (!message.trim()) throw new Error("Enter a message to hide.");
    if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
    status("encode-status", "Encrypting locally…");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(message)));
    const payload = new Uint8Array(4 + 16 + 12 + 4 + encrypted.length);
    payload.set(new TextEncoder().encode("SGS1"), 0); payload.set(salt, 4); payload.set(iv, 20);
    new DataView(payload.buffer).setUint32(32, encrypted.length, false); payload.set(encrypted, 36);
    const { canvas, ctx, data } = await imageData(encodeFile);
    // Include a fixed header and payload length before the encrypted bytes.
    const packed = new Uint8Array(8 + payload.length);
    packed.set(new TextEncoder().encode("SGS1"), 0); new DataView(packed.buffer).setUint32(4, payload.length, false); packed.set(payload, 8);
    embed(data, packed); ctx.putImageData(data, 0, 0);
    const link = $("download-image") as HTMLAnchorElement;
    link.href = canvas.toDataURL("image/png"); link.classList.remove("hidden");
    status("encode-status", "Message encrypted and hidden. Download your PNG.");
  } catch (e) { status("encode-status", e instanceof Error ? e.message : "Encoding failed.", true); }
});
$("decode-button").addEventListener("click", async () => {
  try {
    if (!decodeFile) throw new Error("Select the encoded PNG first.");
    const password = $("decode-password").value;
    if (!password) throw new Error("Enter the decryption password.");
    status("decode-status", "Reading image and decrypting locally…");
    const { data } = await imageData(decodeFile);
    const packed = extract(data);
    if (new TextDecoder().decode(packed.slice(0, 4)) !== "SGS1") throw new Error("Unsupported payload version.");
    const salt = packed.slice(4, 20), iv = packed.slice(20, 32);
    const length = new DataView(packed.buffer, packed.byteOffset).getUint32(32, false);
    if (length !== packed.length - 36) throw new Error("Payload length is invalid.");
    const key = await deriveKey(password, salt);
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, packed.slice(36));
    $("decoded-message").value = new TextDecoder().decode(clear);
    status("decode-status", "Message successfully authenticated and recovered.");
  } catch (e) { $("decoded-message").value = ""; status("decode-status", e instanceof Error ? e.message : "Decoding failed.", true); }
});
