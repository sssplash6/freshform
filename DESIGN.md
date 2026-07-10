# Design system

## Register

Product UI. This is a calm, role-based mentoring ledger for staff, mentors,
and students. It should feel warm and dependable rather than institutional or
like a generic SaaS dashboard.

## Color

- **Navy** is structural chrome and primary action.
- **Orange** means hours, progress, and the active navigation state. The
  accessible orange token is deliberately dark enough for white text.
- **Red** is only destructive or overdrawn state.
- **Mist** is borders and quiet separation, never a primary callout surface.

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
