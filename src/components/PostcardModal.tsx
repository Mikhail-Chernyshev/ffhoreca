import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/LocaleContext';
import { useToast } from './ToastProvider';
import { loadCountryFlagAsync } from '../lib/loadCountryFlag';
import {
  drawPostcard,
  postcardFilename,
  type PostcardData,
} from '../lib/postcard';
import { mapShareUrl } from '../lib/shareUrl';
import { canSharePostcardFile, sharePostcard } from '../lib/webShare';

type Props = {
  data: PostcardData;
  onClose: () => void;
  kicker?: string;
};

async function flagsForCodes(
  codes: string[],
): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    codes.map(async (code) => {
      const img = await Promise.race([
        loadCountryFlagAsync(code),
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 3500);
        }),
      ]);
      if (img) map.set(code, img);
    }),
  );
  return map;
}

export function PostcardModal({ data, onClose, kicker }: Props) {
  const t = useT();
  const { push } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobRef = useRef<Blob | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [shareReady, setShareReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    blobRef.current = null;
    setReady(false);
    setShareReady(false);

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        const flags = await flagsForCodes(data.countryCodes);
        if (cancelled) return;
        drawPostcard(canvas, data, flags);
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png');
        });
        if (cancelled) return;
        blobRef.current = blob;
        setReady(true);
        if (blob) {
          const file = new File([blob], postcardFilename(data.username), {
            type: 'image/png',
          });
          setShareReady(canSharePostcardFile(file));
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const withBlob = useCallback(async () => {
    if (blobRef.current) return blobRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
  }, []);

  const download = useCallback(async () => {
    const blob = await withBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = postcardFilename(data.username);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [data.username, withBlob]);

  const share = useCallback(async () => {
    const blob = await withBlob();
    if (!blob) return;
    const file = new File([blob], postcardFilename(data.username), {
      type: 'image/png',
    });
    const url = data.username ? mapShareUrl(data.username) : data.mapUrl;
    setBusy('share');
    try {
      const result = await sharePostcard({
        file,
        title: t('postcard.title'),
        text: t('postcard.shareText', {
          name: data.name,
          percent: data.percent,
        }),
        url,
      });
      if (result === 'aborted') return;
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        push(t('postcard.copiedLink'));
      } catch {
        push(t('postcard.shareError'), 'error');
      }
    } finally {
      setBusy(null);
    }
  }, [data.mapUrl, data.name, data.percent, data.username, push, t, withBlob]);

  const copyImage = useCallback(async () => {
    const blob = await withBlob();
    if (!blob) return;
    setBusy('copyImage');
    try {
      const item = new ClipboardItem({
        'image/png': blob as Blob,
      });
      await navigator.clipboard.write([item]);
      push(t('postcard.copiedImage'));
    } catch {
      push(t('postcard.copyError'), 'error');
    } finally {
      setBusy(null);
    }
  }, [push, t, withBlob]);

  const copyLink = useCallback(async () => {
    const url = data.username ? mapShareUrl(data.username) : data.mapUrl;
    setBusy('copyLink');
    try {
      await navigator.clipboard.writeText(url);
      push(t('postcard.copiedLink'));
    } catch {
      push(t('postcard.copyError'), 'error');
    } finally {
      setBusy(null);
    }
  }, [data.mapUrl, data.username, push, t]);

  return createPortal(
    <div
      className="postcard-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="postcard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="postcard-modal-title"
      >
        <div className="postcard-modal__head">
          <div>
            {kicker ? <p className="postcard-modal__kicker">{kicker}</p> : null}
            <h2 id="postcard-modal-title" className="postcard-modal__title">
              {t('postcard.title')}
            </h2>
          </div>
          <button
            type="button"
            className="postcard-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <div className="postcard-modal__preview">
          <canvas
            ref={canvasRef}
            className={
              ready
                ? 'postcard-modal__canvas'
                : 'postcard-modal__canvas postcard-modal__canvas--busy'
            }
            width={1080}
            height={1350}
          />
          {!ready ? (
            <p className="postcard-modal__status">{t('postcard.preparing')}</p>
          ) : null}
        </div>
        <div className="postcard-modal__actions">
          {shareReady ? (
            <button
              type="button"
              className="postcard-modal__btn postcard-modal__btn--primary"
              disabled={!ready || busy !== null}
              onClick={() => void share()}
            >
              {t('postcard.share')}
            </button>
          ) : null}
          <button
            type="button"
            className={
              shareReady
                ? 'postcard-modal__btn postcard-modal__btn--ghost'
                : 'postcard-modal__btn postcard-modal__btn--primary'
            }
            disabled={!ready || busy !== null}
            onClick={() => void download()}
          >
            {t('postcard.download')}
          </button>
          <button
            type="button"
            className="postcard-modal__btn postcard-modal__btn--ghost"
            disabled={!ready || busy !== null}
            onClick={() => void copyImage()}
          >
            {t('postcard.copyImage')}
          </button>
          <button
            type="button"
            className="postcard-modal__btn postcard-modal__btn--ghost"
            disabled={busy !== null}
            onClick={() => void copyLink()}
          >
            {t('postcard.copyLink')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
