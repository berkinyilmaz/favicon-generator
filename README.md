# Favicon Generator
One logo. Every icon your website needs — packed into a ready-to-drop-in folder.

---

## Live Demo
- https://favicon-generator-rho.vercel.app/
---

## Features
- Drag & drop (or click) to upload any PNG, JPG, WebP, GIF, or SVG
- Instantly generates 6 favicons at every important size (16, 32, 48, 180, 192, 512)
- Multi-image `favicon.ico` (16/32/48) with PNG-embedded frames
- Live browser-tab preview so you see the icon in context before you ship
- Adjust background color, padding, and rounded corners in real time
- One-click ZIP download — includes `site.webmanifest` and a `README.txt`
- Copy the `<head>` snippet with the correct `<link>` tags
- 100% client-side — your logo never leaves your browser
- Keyboard-friendly with visible focus rings

---

## Tech Stack
- React 19 (Vite 5)
- Pure CSS with custom properties — Apple-inspired dark UI, no framework
- Canvas API for high-quality resampling
- Hand-rolled ICO encoder and STORED-mode ZIP writer (no dependencies)
- Inline SVG icons

---

## How It Works
1. Drop or pick your logo (square works best, 512×512+ recommended)
2. Choose an optional background — transparent, white, black, indigo, or a custom color
3. Fine-tune padding and rounded corners with the sliders
4. Grab the whole pack as a ZIP, download a single size, or copy the HTML snippet

> Everything runs entirely in your browser — image resizing, ICO encoding, and ZIP packing all happen locally.

---

## Installation
```bash
git clone https://github.com/berkinyilmaz/favicon-generator.git
cd favicon-generator
npm install
npm run dev
```

---

## What's in the ZIP
```
favicon-pack.zip
├── favicon.ico                   (multi-size: 16, 32, 48)
├── favicon-16x16.png
├── favicon-32x32.png
├── favicon-48x48.png
├── apple-touch-icon.png          (180×180)
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── site.webmanifest
└── README.txt                    (paste-ready <head> snippet)
```

---

## Privacy
Everything runs **locally in your browser**. No uploads, no proxies, no logging.

---

## About The Build Log
This is **Part 2** of *The Build Log* series — small, focused web tools shipped one at a time.
# favicon-generator
