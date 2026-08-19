import "server-only";

/**
 * The shell every email shares, as inline-styled HTML plus a plain-text twin.
 *
 * Inline styles and a single column on purpose: mail clients strip <style>
 * blocks, ignore most modern CSS, and Outlook will not do flexbox or grid. No
 * images either — the brand here is the type and one orange rule, and an image
 * that a client blocks by default is worse than no image.
 *
 * Colours are the tokens from globals.css written out by hand, since a mail
 * client never sees our stylesheet: brand #124b84, accent #f18d05, ink #1a2733,
 * muted #6b7480, line #e5e6e8, canvas #f4f5f6.
 */

/**
 * How a row's figure is coloured. Three levels, not two, because "expiring
 * soon" and "already lost" are different facts and DESIGN.md reserves red for
 * the second: hours you can still book are not a loss yet.
 *
 * `urgent` is the palette's amber text token (#8a5a08) rather than the bright
 * accent (#f18d05) — orange that light fails contrast at body-text size, and
 * unlike the app there is no large stat readout here to carry it.
 */
export type RowTone = "normal" | "urgent" | "lost";

const ROW_COLOR: Record<RowTone, string> = {
  normal: "#1a2733",
  urgent: "#8a5a08",
  lost: "#b42318",
};

export type Section = {
  heading: string;
  /** Plain sentences, or `label: value` rows rendered as a small table. */
  lines: string[];
  rows?: { label: string; value: string; muted?: string; tone?: RowTone }[];
};

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderEmail({
  preheader,
  title,
  intro,
  sections,
  cta,
  unsubscribeUrl,
  footerNote,
}: {
  /** The grey line a client shows beside the subject. */
  preheader: string;
  title: string;
  intro: string;
  sections: Section[];
  /**
   * `tone` follows DESIGN.md: brand blue is the primary action, and accent
   * orange belongs to hours — so only the Book button wears it, matching the
   * orange one students already press on /student/book.
   */
  cta?: { label: string; url: string; tone?: "brand" | "accent" };
  /**
   * Omitted for one-time transactional mail (a welcome, an approval): only a
   * recurring email has a series to opt out of, and a lone notice wearing a
   * "turn off these weekly emails" link would promise a cadence it doesn't have.
   */
  unsubscribeUrl?: string;
  footerNote: string;
}): { html: string; text: string } {
  const sectionHtml = sections
    .map((section) => {
      const rows = (section.rows ?? [])
        .map(
          (row) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e6e8;font-size:15px;color:#1a2733;">
              ${escapeHtml(row.label)}
              ${row.muted ? `<div style="font-size:13px;color:#6b7480;margin-top:2px;">${escapeHtml(row.muted)}</div>` : ""}
            </td>
            <td align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e5e6e8;font-size:15px;font-weight:600;white-space:nowrap;color:${ROW_COLOR[row.tone ?? "normal"]};">
              ${escapeHtml(row.value)}
            </td>
          </tr>`
        )
        .join("");

      return `
        <tr><td style="padding:24px 0 0 0;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#124b84;">
            ${escapeHtml(section.heading)}
          </div>
          ${section.lines
            .map(
              (line) =>
                `<p style="margin:8px 0 0 0;font-size:15px;line-height:1.5;color:#1a2733;">${escapeHtml(line)}</p>`
            )
            .join("")}
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;">${rows}</table>` : ""}
        </td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f6;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e6e8;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td style="height:3px;background:#f18d05;"></td></tr>
    <tr><td style="padding:24px 28px 0 28px;">
      <div style="font-size:15px;font-weight:700;color:#124b84;">freshlog</div>
      <h1 style="margin:12px 0 0 0;font-size:24px;line-height:1.25;font-weight:700;color:#1a2733;">${escapeHtml(title)}</h1>
      <p style="margin:10px 0 0 0;font-size:15px;line-height:1.5;color:#6b7480;">${escapeHtml(intro)}</p>
    </td></tr>
    <tr><td style="padding:0 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sectionHtml}</table>
    </td></tr>
    ${
      cta
        ? `<tr><td style="padding:26px 28px 0 28px;">
            <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${cta.tone === "accent" ? "#f18d05" : "#124b84"};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">${escapeHtml(cta.label)}</a>
          </td></tr>`
        : ""
    }
    <tr><td style="padding:26px 28px 24px 28px;">
      <div style="border-top:1px solid #e5e6e8;padding-top:14px;font-size:12px;line-height:1.5;color:#6b7480;">
        ${escapeHtml(footerNote)}
        ${unsubscribeUrl ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7480;text-decoration:underline;">Turn off these weekly emails</a>` : ""}
      </div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  // The text twin is not a fallback nobody reads — it is what a screen reader in
  // plain-text mode and every "show original" view gets.
  const text = [
    title,
    "",
    intro,
    ...sections.flatMap((section) => [
      "",
      section.heading.toUpperCase(),
      ...section.lines,
      ...(section.rows ?? []).map(
        (row) =>
          `  - ${row.label}: ${row.value}${row.muted ? ` (${row.muted})` : ""}`
      ),
    ]),
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    "",
    "—",
    footerNote,
    ...(unsubscribeUrl ? [`Turn off these weekly emails: ${unsubscribeUrl}`] : []),
  ].join("\n");

  return { html, text };
}
