#!/usr/bin/env python3
"""Render a terracotta suitcase mouse cursor (32×32 PNG, Safari-safe size)."""
from __future__ import annotations

import math
import os
import struct
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src', 'assets'))
SS = 4


def write_png(path: str, w: int, h: int, rgba: bytearray) -> None:
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    data = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        + chunk(b'IEND', b'')
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


def render(size: int, retracted: bool = False) -> bytearray:
    s = size * SS
    buf = [[0.0, 0.0, 0.0, 0.0] for _ in range(s * s)]

    def plot(x: int, y: int, r: float, g: float, b: float, a: float) -> None:
        if not (0 <= x < s and 0 <= y < s) or a <= 0:
            return
        i = y * s + x
        dst = buf[i]
        out_a = a + dst[3] * (1 - a)
        if out_a < 1e-6:
            return
        buf[i][0] = (r * a + dst[0] * dst[3] * (1 - a)) / out_a
        buf[i][1] = (g * a + dst[1] * dst[3] * (1 - a)) / out_a
        buf[i][2] = (b * a + dst[2] * dst[3] * (1 - a)) / out_a
        buf[i][3] = out_a

    def fill_round_rect(
        x0: float, y0: float, x1: float, y1: float, rad: float, color: tuple[int, int, int], a: float = 1.0
    ) -> None:
        r, g, b = (c / 255.0 for c in color)
        hw = (x1 - x0) / 2
        hh = (y1 - y0) / 2
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        for y in range(int(y0 - 2), int(y1 + 3)):
            for x in range(int(x0 - 2), int(x1 + 3)):
                dx = abs(x + 0.5 - cx)
                dy = abs(y + 0.5 - cy)
                qx = dx - hw + rad
                qy = dy - hh + rad
                sdf = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - rad
                cov = max(0.0, min(1.0, 0.5 - sdf))
                if cov > 0:
                    plot(x, y, r, g, b, a * cov)

    def stroke_capsule(
        x0: float, y0: float, x1: float, y1: float, width: float, color: tuple[int, int, int], a: float = 1.0
    ) -> None:
        r, g, b = (c / 255.0 for c in color)
        hw = width / 2
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy) or 1.0
        ux, uy = dx / length, dy / length
        for y in range(int(min(y0, y1) - hw - 2), int(max(y0, y1) + hw + 3)):
            for x in range(int(min(x0, x1) - hw - 2), int(max(x0, x1) + hw + 3)):
                px = x + 0.5 - x0
                py = y + 0.5 - y0
                t = max(0.0, min(1.0, (px * ux + py * uy) / length))
                qx = x0 + ux * t * length
                qy = y0 + uy * t * length
                d = math.hypot(x + 0.5 - qx, y + 0.5 - qy) - hw
                cov = max(0.0, min(1.0, 0.5 - d))
                if cov > 0:
                    plot(x, y, r, g, b, a * cov)

    def fill_circle(cx: float, cy: float, rad: float, color: tuple[int, int, int], a: float = 1.0) -> None:
        r, g, b = (c / 255.0 for c in color)
        for y in range(int(cy - rad - 2), int(cy + rad + 3)):
            for x in range(int(cx - rad - 2), int(cx + rad + 3)):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rad
                cov = max(0.0, min(1.0, 0.5 - d))
                if cov > 0:
                    plot(x, y, r, g, b, a * cov)

    k = s / 32.0
    terr = (212, 83, 44)
    deep = (147, 55, 28)
    mid = (184, 68, 34)
    cream = (255, 246, 238)
    gloss = (232, 130, 90)
    ink = (42, 26, 18)
    tire = (28, 22, 18)

    # Telescoping handle — the click hotspot sits on the top bar.
    hx0, hx1 = 13.2 * k, 18.8 * k
    hy_join = 10.2 * k
    hy_top = 8.2 * k if retracted else 1.8 * k
    hw = 1.7 * k
    stroke_capsule(hx0, hy_join, hx0, hy_top + 1.2 * k, hw, deep)
    stroke_capsule(hx1, hy_join, hx1, hy_top + 1.2 * k, hw, deep)
    stroke_capsule(hx0, hy_top, hx1, hy_top, hw + 0.35 * k, deep)

    # Upright case
    fill_round_rect(7.2 * k, 10.6 * k, 24.8 * k, 25.6 * k, 2.6 * k, deep)
    fill_round_rect(7.2 * k, 9.6 * k, 24.8 * k, 24.4 * k, 2.6 * k, terr)
    fill_round_rect(7.2 * k, 15.4 * k, 24.8 * k, 18.2 * k, 0.3 * k, mid)
    stroke_capsule(11.2 * k, 11.6 * k, 11.2 * k, 22.8 * k, 0.65 * k, deep, 0.45)
    stroke_capsule(20.8 * k, 11.6 * k, 20.8 * k, 22.8 * k, 0.65 * k, deep, 0.45)
    fill_round_rect(14.2 * k, 14.4 * k, 17.8 * k, 19.2 * k, 0.9 * k, cream)
    fill_round_rect(14.8 * k, 16.0 * k, 17.2 * k, 17.6 * k, 0.4 * k, terr)
    fill_round_rect(9.4 * k, 10.4 * k, 18.6 * k, 11.8 * k, 0.7 * k, gloss, 0.4)

    # Rolling wheels
    fill_circle(11.4 * k, 26.4 * k, 3.05 * k, tire)
    fill_circle(20.6 * k, 26.4 * k, 3.05 * k, tire)
    fill_circle(11.4 * k, 26.4 * k, 1.35 * k, cream)
    fill_circle(20.6 * k, 26.4 * k, 1.35 * k, cream)
    fill_circle(11.4 * k, 26.4 * k, 0.55 * k, ink)
    fill_circle(20.6 * k, 26.4 * k, 0.55 * k, ink)

    out = bytearray(size * size * 4)
    n = SS * SS
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0.0
            for oy in range(SS):
                for ox in range(SS):
                    p = buf[(y * SS + oy) * s + (x * SS + ox)]
                    r += p[0] * p[3]
                    g += p[1] * p[3]
                    b += p[2] * p[3]
                    a += p[3]
            a /= n
            if a > 1e-5:
                r = r / n / a
                g = g / n / a
                b = b / n / a
            i = (y * size + x) * 4
            out[i] = int(max(0, min(255, round(r * 255))))
            out[i + 1] = int(max(0, min(255, round(g * 255))))
            out[i + 2] = int(max(0, min(255, round(b * 255))))
            out[i + 3] = int(max(0, min(255, round(a * 255))))
    return out


def main() -> None:
    os.makedirs(ROOT, exist_ok=True)
    path = os.path.join(ROOT, 'cursor-suitcase.png')
    write_png(path, 32, 32, render(32, False))
    print(path)
    press = os.path.join(ROOT, 'cursor-suitcase-press.png')
    write_png(press, 32, 32, render(32, True))
    print(press)


if __name__ == '__main__':
    main()
