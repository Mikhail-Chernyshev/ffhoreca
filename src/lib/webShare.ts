type ShareNav = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

function canShare(data: ShareData): boolean {
  const nav = navigator as ShareNav;
  if (typeof nav.share !== 'function') return false;
  if (typeof nav.canShare !== 'function') return true;
  try {
    return nav.canShare(data);
  } catch {
    return false;
  }
}

/** files + url вместе часто кидают TypeError в Chrome/Safari. */
export async function sharePostcard(input: {
  file: File;
  title: string;
  text: string;
  url: string;
}): Promise<'shared' | 'aborted'> {
  const nav = navigator as ShareNav;
  if (typeof nav.share !== 'function') {
    throw new Error('share-unsupported');
  }

  const attempts: ShareData[] = [
    { files: [input.file], title: input.title, text: input.text },
    { files: [input.file], title: input.title },
    { title: input.title, text: input.text, url: input.url },
    { title: input.title, text: `${input.text}\n${input.url}` },
  ];

  let lastError: unknown;
  for (const data of attempts) {
    if (data.files && !canShare({ files: data.files })) continue;
    try {
      await nav.share(data);
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'aborted';
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('share-failed');
}

export function canSharePostcardFile(file: File): boolean {
  return canShare({ files: [file] }) || typeof navigator.share === 'function';
}
