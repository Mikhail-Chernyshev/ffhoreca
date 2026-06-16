/** Боты мессенджеров и соцсетей, которые читают Open Graph без JS. */
const LINK_PREVIEW_CRAWLER =
  /bot|crawler|spider|preview|telegram|facebookexternalhit|whatsapp|slack|discord|linkedin|twitter|embed/i;

export function isLinkPreviewCrawler(userAgent: string | undefined): boolean {
  if (!userAgent?.trim()) return false;
  return LINK_PREVIEW_CRAWLER.test(userAgent);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type SharePageParams = {
  title: string;
  description: string;
  shareUrl: string;
  mapUrl: string;
  imageUrl: string;
  redirectBrowsers: boolean;
};

export function buildSharePageHtml(p: SharePageParams): string {
  const redirectBlock = p.redirectBrowsers
    ? `<script>location.replace(${JSON.stringify(p.mapUrl)});</script>
  <noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(p.mapUrl)}" /></noscript>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(p.title)}</title>
  <meta name="description" content="${escapeHtml(p.description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Tips from trips" />
  <meta property="og:title" content="${escapeHtml(p.title)}" />
  <meta property="og:description" content="${escapeHtml(p.description)}" />
  <meta property="og:url" content="${escapeHtml(p.shareUrl)}" />
  <meta property="og:image" content="${escapeHtml(p.imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(p.title)}" />
  <meta name="twitter:description" content="${escapeHtml(p.description)}" />
  <meta name="twitter:image" content="${escapeHtml(p.imageUrl)}" />
  <link rel="canonical" href="${escapeHtml(p.shareUrl)}" />
  ${redirectBlock}
</head>
<body>
  <p><a href="${escapeHtml(p.mapUrl)}">${escapeHtml(p.title)}</a></p>
</body>
</html>`;
}
