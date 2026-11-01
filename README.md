# StegoSafe

**Hide in plain sight.** An open-source, browser-based image steganography tool with authenticated encryption.

## Features (MVP)
- Encrypt messages with AES-256-GCM using a password-derived key (PBKDF2 / SHA-256).
- Hide encrypted bytes in PNG pixel-channel least-significant bits.
- Extract and decrypt messages with the correct password.
- Process images locally in the browser; no application server or API key is required.

## Run locally
```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
npm run preview
```

## Important limitations
- PNG input is required. JPEG recompression, resizing, format conversion, or image editing can destroy the hidden payload.
- This MVP uses sequential LSB embedding and does not provide resistance to steganalysis.
- The app has not undergone an independent security audit. Do not use it for high-risk or legally sensitive secrets.
- Losing the password means the message cannot be recovered.
- The browser processes data locally; avoid untrusted browser extensions on sensitive sessions.

## Roadmap
- Capacity estimator and image preview.
- Drag-and-drop and clipboard support.
- File payload support and robust format/version validation.
- Automated tests, accessibility review, and security review.
- Improved embedding schemes and optional keyed pixel traversal.

## License
MIT
