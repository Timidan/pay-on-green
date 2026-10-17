# Design

Pay-on-Green's look is an "analyst's desk": a quiet tool on a cool near-white surface. Most of the interface is ink and greys. The one accent is green, and it means one thing: paid. Panels are separated by 1px borders. The receipt is the only warm element, so the money is always the thing the eye lands on.

## Colour

| Token | Value | Use |
|---|---|---|
| `bg` | `#F3F5F6` | Page |
| `card` | `#FFFFFF` | Panels |
| `fg` | `#0F1214` | Text and the primary button |
| `muted` | `#556068` | Captions and metadata |
| `line` | `#E0E4E7` | Hairlines |
| `accent` | `#22C55E` | The hero's "green", the CTA shimmer |
| `pass` / `pass-soft` | `#08704F` / `#E0F2EA` | Passing tests, added lines |
| `fail` / `fail-soft` | `#AF3526` / `#FBE7E3` | Failing tests, removed lines |
| `warn` / `warn-soft` | `#6A5200` / `#FBF1D2` | Rejected patches |
| `paper` | `#FBF8F1` | The receipt |

Pass and fail are never shown by colour alone: every state also has a word (GREEN, RED, CAPTURED, RELEASED) and a mark.

## Typography

Geist for the interface and headings (600, negative tracking at display sizes). Geist Mono for the receipt, IDs, model names and test output.

## Motion

- The hero rises and de-blurs in under 800 ms, staggered by 120 ms.
- The pixel-field "$5" drifts behind the headline and reacts to the pointer.
- Receipt lines print in over 260 ms; the stamp lands with a short overshoot.
- `prefers-reduced-motion` turns all of it off and shows still text.
