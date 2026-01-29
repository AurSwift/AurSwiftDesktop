# Typography and font-size responsiveness

This guide describes the typography system for the desktop app (Windows and macOS) and how to keep font sizes responsive across small laptops (e.g. 1024×768) through large monitors (2560×1440, 4K).

## Principles

1. **rem-based scale** — All UI font sizes use the `@theme` typography scale (rem). No arbitrary `text-[Npx]` in UI code.
2. **Root font-size** — `html { font-size: 100%; }` so OS/user preferences (and DPI scaling on Windows/macOS) are respected.
3. **Responsive by breakpoint** — Use Tailwind `sm` / `md` / `lg` / `xl` so typography scales with **window size** (Electron window resize).
4. **Minimum size** — Use `text-xs` (0.75rem) as the floor for body/caption. Avoid smaller sizes for readability on small displays.
5. **Target platforms** — Windows and Mac, PC form factors from small laptops to large monitors. QA should cover multiple window sizes and, where possible, OS-level scaling (e.g. Windows 125%/150%, macOS Retina).

## Theme and scale

- **`@theme`** in `packages/renderer/src/index.css` defines `--font-sans` and, optionally, `--text-2xs` (0.6875rem). The default Tailwind scale (`--text-xs` … `--text-2xl`) is rem-based.
- **Body** uses `text-base` (1rem) by default.

## Semantic utilities

Use these component-layer classes instead of ad-hoc `text-sm` / `text-base` / `text-lg` where appropriate:

| Class | Definition | Use for |
|-------|------------|---------|
| `text-caption` | `text-xs sm:text-sm` | Metadata, hints, table secondary text |
| `text-body` | `text-sm sm:text-base` | Default body copy |
| `text-body-large` | `text-base sm:text-lg` | Emphasized body or intro text |
| `text-heading-small` | `text-base sm:text-lg font-semibold` | Small headings |
| `text-heading-medium` | `text-lg sm:text-xl font-semibold` | Medium headings |
| `text-heading-large` | `text-xl sm:text-2xl font-bold` | Large headings |

For very wide layouts, you can add `md:` / `lg:` (e.g. `text-base sm:text-lg lg:text-xl` for hero titles).

## Responsive rules

- Prefer **`text-* sm:text-*`** (or `md:` / `lg:`) over **fixed-only** sizes for feature UI.
- **Tables / dense UI**: e.g. `text-xs sm:text-sm` for secondary, `text-sm sm:text-base` for primary; scale row padding (e.g. `py-2 sm:py-3`) where needed.
- **Modals / dialogs**: Use the same responsive patterns as main views.
- **Auth / license**: The license activation screen uses `clamp()` and `@media` for fluid typography; that pattern can be reused where suitable.

## UI primitives

- **Button**: `text-sm sm:text-base`
- **Label**: `text-xs sm:text-sm`
- **Input / Textarea**: `text-sm sm:text-base`
- **FormDescription / FormMessage**: `text-xs sm:text-sm`

These ensure primitives scale with window size across the app.

## Exceptions

- **Print** (`sales-reports-view.css`): Print-specific overrides (e.g. `font-size: 10pt` for tables) are intentional. Print styles are excluded from the app-wide responsiveness rules.
- **Receipts / QR** (`save-basket-modal`): Inline `font-size` in the receipt/QR HTML template is **output-specific** for physical print. It is not UI and is excluded from the typography system.

## Lint and QA

- **`npm run lint:typography`** (from repo root): Fails if `text-[Npx]` appears in `packages/renderer/src`, to avoid regressions. Receipt/print exceptions are documented above and not scanned.
- **Manual QA**: Test on **Windows and Mac**, resize the app from **small** (e.g. 1024×768) → **medium** (1440×900, 1920×1080) → **large** (2560×1440). Check legibility at minimum window size and that text does not feel undersized on large displays. Test with OS-level scaling where possible.

## References

- Tailwind typography: [Font Size](https://tailwindcss.com/docs/font-size)
- Theme and tokens: `packages/renderer/src/index.css` (`@theme`, `@layer base`, `@layer components`)
