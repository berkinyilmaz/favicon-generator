# The Build Log · Part 2 — Favicon Generator

*The Build Log* serisinin ikinci projesi. Part 1 (`device-preview`) ile aynı tasarım dilinde bir devam — bir logo yükle, tüm favicon boyutlarını, `favicon.ico`'yu, `site.webmanifest`'i ve `<head>` snippet'ini tek tıkla al.

---

## Konsept

Slide notlarındaki problem: her yeni site açıldığında favicon dosyalarını hazırlamak sıkıcı. RealFaviconGenerator gibi araçlar var ama upload/download döngüsü ve tarayıcıya çeşitli permission'lar istemesi gündelik iş akışı için ağır. Çözüm: **logoyu drop et, 8 boyut + ICO + manifest anında hazır, tek ZIP indir.**

Slide 2 (Learn. Build. Ship.) — Coddy üzerinden file processing öğrendim → bu aracı kurdum.
Slide 3 (One Logo. Every Icon.) — favicon.ico, Apple icons, Android icons, manifest — hepsi tek upload'tan.
Slide 4 (CTA) — "Comment ICON and I will send you the link."

---

## Tasarım Dili (Part 1 ile birebir)

`device-preview` sistemini birebir koruduk — token'lar, spacing, tipografi ve micro-interactions aynı.

- Dark-first zemin `#0a0a0c` + üstte hafif radial gradient
- Tek aksan: indigo `#6366f1` — primary CTA, focus, active chip
- Surface katmanları (`--surface`, `--surface-2`, `--surface-3`) — kart derinliği için
- Köşeler: 20 (kartlar) / 14 (input) / pill (CTA + chip)
- Preview cell'de checker background — transparency'yi görsel olarak vurgular
- Tipografi: Inter (sans), SF Mono (dosya adı + boyut)
- Micro-interactions 180ms — chip hover'da color shift, primary CTA hover'da translateY + glow, preview cell hover'da download icon fade-in
- Pure CSS + CSS custom properties — Tailwind YOK, TypeScript YOK
- Bağımlılık sıfır (React/ReactDOM dışında) — ZIP ve ICO encoder'lar el yazması

---

## Stack

| Katman | Seçim | Neden |
|---|---|---|
| Framework | React 19 + Vite 5 | Seri standardı |
| Styling | Pure CSS + design tokens | Part 1 ile aynı |
| State | `useState` + `useEffect` + `useCallback` + `useMemo` + `useRef` | Tek dosyada manage edilebilir |
| Resize | Canvas 2D API + `imageSmoothingQuality: 'high'` | En temiz resampling native olarak var |
| ICO encoder | El yazması, PNG-embedded | Modern tarayıcılar için `favicon.ico` içine PNG gömmek yeterli |
| ZIP writer | El yazması STORED (compression YOK) | Küçük dosyalar için compression overhead'e değmez, kod ~60 satır |
| Font | Inter (400/500/600/700) | Seri stack'i |
| Bağımlılık sayısı | Sıfır (React/ReactDOM dışında) | Lean |

---

## Özellikler

1. **Drop zone** — drag & drop veya click, PNG/JPG/WebP/GIF/SVG kabul eder, 8 MB limit, validation + error inline
2. **Live preview grid** — 6 boyut (16/32/48/180/192/512) checker background üzerinde, hover'da download butonu fade in
3. **Browser tab mockup** — Chrome-style tab bar, favicon 14×14 tabında canlı görünüyor
4. **3 ayar** — background (transparent/white/black/indigo/custom color picker), padding %, rounded corners % (50=circle)
5. **favicon.ico multi-size** — 16+32+48 PNG-embedded, `file` komutu doğruluyor
6. **ZIP paketi** — 6 PNG + ICO + manifest + README, ortalama 300 KB
7. **HTML `<head>` snippet** — Copy button ile clipboard'a, feedback state 1.4s
8. **Reset** — header'da trash icon, tüm state sıfırlanır
9. **Responsive** — 900 / 720 / 600 breakpoint'leri, mobile'da split 1 kolon + preview grid 2 kolon

---

## Mimari Notlar

### Dosya yapısı
```
favicon-generator/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── PROJECT_NOTES.md  ← bu dosya
└── src/
    ├── main.jsx       (React mount)
    ├── App.jsx        (tüm UI + Canvas resize + ICO encoder + ZIP writer)
    └── styles.css     (design tokens + card/dropzone/preview stilleri)
```

### State şeması
```js
{
  source: { name, image (HTMLImageElement), width, height, dataUrl } | null,
  background: 'transparent' | '#ffffff' | ...,
  padding: 0–30,     // % of size
  radius: 0–50,      // % of half-size, 50 = tam daire
  dragActive: false,
  error: '',
  previews: { 'favicon-16x16.png': dataUrl, ... },
  busy: false,
  downloadState: 'idle' | 'working' | 'done',
  copyState: 'idle' | 'done',
}
```

### Canvas rendering algoritması
Her size için (16, 32, 48, 180, 192, 512):
1. Canvas oluştur (size × size), `imageSmoothingQuality: 'high'`
2. Rounded corner varsa `arcTo` ile path çiz + fill (background varsa) + `clip()`
3. Background varsa (rounded yoksa) `fillRect` ile solid fill
4. Görseli `contain` mantığı ile ortala: `scale = min(box/iw, box/ih)`, padding %'ye göre inset
5. `drawImage` ile çiz
6. `toDataURL('image/png')` — canlı preview için
7. Download'da `toBlob` — ZIP entry olarak

### ICO encoder
Multi-image ICO formatı = `ICONDIR (6 bytes)` + `ICONDIRENTRY × N (16 bytes each)` + `PNG data × N`. Modern tarayıcılar (IE11+, Chrome, Safari, Firefox) PNG-embedded ICO'yu kabul eder → BMP encoding gerekmiyor.

### Stored ZIP writer
Compression olmadan (`method = 0`) ZIP yazımı ~60 satır: her entry için Local File Header + veri, sonra Central Directory + End of Central Directory. CRC32 tablosu bir kere modül scope'unda üretiliyor. Fayda: kod küçük, hız hızlı, PNG'ler zaten sıkıştırılmış olduğu için compression fayda vermez.

### Preview yeniden render
`useEffect` bağımlılıkları: `[source, background, padding, radius]`. Ayar değişince tüm 6 canvas yeniden çizilir, ~40 ms toplam (512×512 en pahalısı). `cancelled` flag ile eski render iptal edilir.

### Erişilebilirlik
- Tüm interaktif elementlerde `aria-label` / `aria-pressed`
- Drop zone `role="button"` + Enter/Space klavye desteği
- `:focus-visible` ile belirgin indigo focus ring
- Range input'ları etiketli (`htmlFor` → `id`)
- Hidden file input `aria-hidden="true"`

---

## Yapı / Bileşenler

- **Header** — title/sub + sağda reset butonu (source varsa)
- **DropZone** — dashed border kart, drag active state indigo glow, iki hint chip + primary CTA
- **Split** — Source card | Settings card grid (2 kolon → 1 kolon mobile)
  - **SourceCard** — 96×96 checker thumbnail + filename + dims + Replace/Remove
  - **SettingsCard** — background chip row + custom color picker + 2 range slider
- **BrowserTabPreview** — Chrome-style tab bar, aktif tab live favicon + 2 mock inactive tab
- **PreviewGrid** — 3×2 grid (2×3 mobile), her cell'de canvas + name + context + download icon
- **DownloadBar** — primary ZIP CTA + favicon.ico + Copy snippet
- **HtmlSnippetCard** — mono-font `<pre>` with all `<link>` tags
- **Credit footer**

---

## Tamamlandı / Test

- `npm install` — temiz (61 paket, 7s)
- `npm run build` — temiz (333ms, 13.22 kB CSS gzip 3.18 kB, 211.96 kB JS gzip 66.21 kB)
- `npm run dev` — `localhost:5174` 200 OK
- ZIP paketi doğrulandı: 9 dosya, 323 KB, tüm PNG'ler `file` komutuyla valid RGBA, favicon.ico multi-image (16/32/48) valid
- Browser tab preview canlı çalışıyor, favicon 14 px'de crisp
- Rounded corners live preview'e yansıyor (Canvas 2D `arcTo` clip)
- Mobile (390×844) responsive: split 1 kolon, preview grid 2 kolon, download bar tam genişlik
- Klavye ile drop zone açılabiliyor (Enter/Space)

---

## Sonraki Adımlar (opsiyonel)

- SVG için doğrudan raster export (browser Image() zaten yapıyor ama size hint gerekebilir)
- Custom size input (kullanıcının kendi size'ını eklemesi)
- Batch mode — çoklu logo yükleyip her biri için ayrı paket
- browserconfig.xml (Microsoft tile) — nadiren gerekli ama isteyene
- Compressed ZIP (DEFLATE) — CompressionStream API destekleyen tarayıcılarda küçültme
