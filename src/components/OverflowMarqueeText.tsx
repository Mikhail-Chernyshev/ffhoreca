import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function OverflowMarqueeText({ children, className, title }: Props) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shiftPx, setShiftPx] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const measure = () => {
      setShiftPx(Math.max(0, inner.scrollWidth - container.clientWidth));
    };

    measure();

    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(container);
    ro?.observe(inner);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [children]);

  const canScroll = shiftPx > 0;
  const durationSec = Math.max(3.5, Math.min(12, 3 + shiftPx / 28));

  return (
    <span
      ref={containerRef}
      className={[
        'overflow-marquee',
        canScroll ? 'overflow-marquee--scrollable' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      title={title}
    >
      <span
        ref={innerRef}
        className="overflow-marquee__inner"
        style={
          canScroll
            ? ({
                '--overflow-marquee-shift': `${shiftPx}px`,
                '--overflow-marquee-duration': `${durationSec}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </span>
  );
}
