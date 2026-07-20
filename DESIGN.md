# Design system

## Register

Product UI. This is a calm, role-based mentoring ledger for staff, mentors,
and students. It should feel warm and dependable rather than institutional or
like a generic SaaS dashboard.

## Color

- **Brand** (deep blue) is structural chrome and primary action. `brand-dark`
  is its hover; `brand-soft` a tint background.
- **Accent** (orange) means hours, progress, and the active navigation state.
  The bright `accent` is for fills, dots, and bars; `accent-ink` is the same
  hue darkened to pass AA for orange text and stat readouts.
- **Red** is only destructive or overdrawn state.
- **Line** is borders and quiet separation; **canvas** is the page ground and
  **surface** is a card — never use a fill as a primary callout.
- Text is a two-tone system: **ink** for primary, **muted-fg** for secondary.

Use the semantic tokens in `src/app/globals.css`. Do not introduce decorative
gradients, color-coded decoration, or alternate accent colors.

## Type and spacing

Geist is the single product typeface. Numbers use tabular figures. Keep page
headings clear, body copy direct, and data dense enough for staff work without
turning every statistic into a card. Use horizontal rules and whitespace before
adding a container.

## Components

Use native controls unless a custom interaction offers a demonstrated benefit.
Interactive controls need visible keyboard focus and a minimum 44px touch
target. Forms show an inline, announced success or error result. Tables may
scroll horizontally when necessary, but page navigation must remain structural
and usable at phone widths.

## Motion

Motion is brief (150–180ms), easing out, and only conveys interaction or state.
Respect reduced-motion preferences.
