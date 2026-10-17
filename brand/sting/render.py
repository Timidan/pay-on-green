"""Generate the Pay-on-Green vector assets and render the 60 fps logo films.

Requires the repository's Next font, fontTools, rsvg-convert, and ffmpeg.
Run: python brand/sting/render.py assets|sting|loop
"""
from __future__ import annotations

import math
import json
import os
import subprocess
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[2]
INK, DESK, PAPER, GREEN, RED = "#0F1214", "#F3F5F6", "#FBF8F1", "#22C55E", "#AF3526"
FONT = TTFont(ROOT / "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")
MONO = TTFont(ROOT / "node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2")


def glyphs(message: str, size: float, color: str, x=0, baseline=0, stagger=None, font=FONT):
    """Outline text so every exported mark is independent of installed fonts."""
    advance = 0.0
    elements = []
    glyph_map, glyph_set = font.getBestCmap(), font.getGlyphSet()
    upm = font["head"].unitsPerEm
    for index, char in enumerate(message):
        name = glyph_map[ord(char)]
        pen = SVGPathPen(glyph_set)
        glyph_set[name].draw(pen)
        d = pen.getCommands()
        attrs = f' opacity="{stagger(index):.4f}"' if stagger else ""
        elements.append(f'<path d="{d}" fill="{color}" transform="translate({x + advance * size / upm:.3f} {baseline}) scale({size / upm:.6f} {-size / upm:.6f})"{attrs}/>')
        advance += font["hmtx"][name][0]
    return "".join(elements), advance * size / upm


def svg(body, width, height, view=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="{view or f"0 0 {width} {height}"}">{body}</svg>'


# 80-unit grid: 16-unit tile radius; receipt spans x17..63 and y11..65.
# Its 46-unit width and 5-unit teeth survive a 16 px favicon. Check terminals
# land on whole grid units; the heavy 6-unit stroke carries the silhouette.
TEETH = "M17 54H63V59L58 65L53 59L48 65L43 59L38 65L33 59L28 65L23 59L17 65Z"
PAPER_SHAPE = "M17 11H63V59L58 65L53 59L48 65L43 59L38 65L33 59L28 65L23 59L17 65Z"
CHECK = "M26 39L34 47L53 28"


def mark(inner=False, inverse=False, lines=True):
    tile, paper, check = (PAPER, INK, PAPER) if inverse else (INK, PAPER, INK)
    box = "" if inner else f'<rect width="80" height="80" rx="16" fill="{tile}"/>'
    ruled = f'<path d="M25 22H51M25 28H43" stroke="{tile}" opacity=".38" stroke-width="2.5" stroke-linecap="round"/>' if lines else ""
    return f'{box}<path d="{PAPER_SHAPE}" fill="{paper}"/>{ruled}<path d="{TEETH}" fill="{GREEN}"/><path d="{CHECK}" fill="none" stroke="{check}" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter"/>'


def write_svg(path, body, w, h):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(svg(body, w, h), encoding="utf8")


def render_png(svg_path, png_path, w, h):
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "-o", str(png_path), str(svg_path)], check=True)


def assets():
    assets_dir = ROOT / ".github/assets"
    write_svg(assets_dir / "mark.svg", mark(), 80, 80)
    write_svg(assets_dir / "mark-inverse.svg", mark(inverse=True), 80, 80)
    write_svg(ROOT / "app/icon.svg", mark(lines=False), 80, 80)
    for inverse in (False, True):
        fg = PAPER if inverse else INK
        suffix = "-inverse" if inverse else ""
        letters, length = glyphs("Pay-on-Green", 52, fg, 107, 58)
        write_svg(assets_dir / f"wordmark{suffix}.svg", f'{mark(inverse=inverse)}{letters}', math.ceil(107 + length + 9), 80)
        _, stack_len = glyphs("Pay-on-Green", 40, fg)
        stack_x = (max(80, stack_len) - stack_len) / 2
        stack, _ = glyphs("Pay-on-Green", 40, fg, stack_x, 129)
        emblem_x = (max(80, stack_len) - 80) / 2
        write_svg(assets_dir / f"wordmark-stacked{suffix}.svg", f'<g transform="translate({emblem_x:.2f} 0)">{mark(inverse=inverse)}</g>{stack}', math.ceil(max(80, stack_len)), 145)

    apple = ROOT / "brand/sting/apple.svg"
    write_svg(apple, mark(lines=False), 80, 80)
    render_png(apple, ROOT / "app/apple-icon.png", 180, 180)

    # The same outlined lockup drives social preview and repository banner.
    for out, width, height in [(ROOT / "app/opengraph-image.png", 1200, 630), (ROOT / "app/twitter-image.png", 1200, 630), (assets_dir / "banner.png", 1280, 640)]:
        logo_size = 136
        headline, text_len = glyphs("Pay-on-Green", 88, INK, 0, 0)
        total = logo_size + 36 + text_len
        left = (width - total) / 2
        baseline = height / 2 + 37
        headline, _ = glyphs("Pay-on-Green", 88, INK, left + logo_size + 36, baseline)
        small, small_w = glyphs("THE TEST TURNS GREEN. THE AGENT GETS PAID.", 20, INK, 0, 0, font=MONO)
        small, _ = glyphs("THE TEST TURNS GREEN. THE AGENT GETS PAID.", 20, INK, (width - small_w) / 2, height / 2 + 133, font=MONO)
        body = f'<rect width="{width}" height="{height}" fill="{DESK}"/><path d="M64 64H{width-64}M64 {height-64}H{width-64}" stroke="#D4DCDC" stroke-width="2"/><g transform="translate({left:.2f} {height/2-82:.2f}) scale(1.7)">{mark()}</g>{headline}{small}'
        temp = ROOT / "brand/sting/social.svg"
        write_svg(temp, body, width, height)
        render_png(temp, out, width, height)


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def clamp(t):
    return max(0.0, min(1.0, t))


def film_frame(t: float, width: int, height: int, loop=False):
    """A pose-to-pose receipt, verdict and wordmark sequence in vector space."""
    bg = f'<rect width="{width}" height="{height}" fill="{DESK}"/>'
    scale = height / (350 if not loop else 310)
    mark_w = 80 * scale
    name_size = 42 * scale
    word, word_w = glyphs("Pay-on-Green", name_size, INK, 0, 0)
    lock_width = mark_w + 25 * scale + word_w
    left = (width - lock_width) / 2
    centered = (width - mark_w) / 2
    slide = ease((t - 1.62) / .43) if not loop else 0
    x = centered + (left - centered) * slide
    y = (height - mark_w) / 2
    if loop:
        x = (width - mark_w) / 2
        y = (height - mark_w) / 2
    # Feed follows a short downward anticipation; stop overshoots by 2 units.
    feed = (32 + 3 * ease(t / .13)) if t < .13 else (35 * (1 - ease((t - .13) / .68)) - 2 * math.sin(math.pi * clamp((t - .70) / .30)))
    if loop:
        feed = 0
    l1 = ease((t - .53) / .40) if not loop else 1
    l2 = ease((t - .69) / .40) if not loop else 1
    verdict = 0 if loop else clamp((t - 1.01) / .20)
    flicker = (RED if int(t * 34) % 3 != 0 else GREEN) if (not loop and 1.01 < t < 1.26) else RED
    fill = ease((t - 1.21) / .30) if not loop else 1 - ease(((t % 6.0) - .55) / .16) + ease(((t % 6.0) - .74) / .70)
    fill = min(1, fill)
    stamp = ease((t - 1.39) / .15) if not loop else 1
    if not loop and t < 1.39:
        stamp = 0
    stamp_y = -13 * (1 - stamp) if not loop else -8 * math.sin(math.pi * clamp(((t % 6.0) - .75) / .45))
    squash = 1 + .18 * math.sin(math.pi * clamp((t - 1.52) / .20)) if not loop else 1 + .10 * math.sin(math.pi * clamp(((t % 6.0) - .97) / .23))
    recoil = -2.0 * math.sin(math.pi * clamp((t - 1.57) / .30)) if not loop else -1.1 * math.sin(math.pi * clamp(((t % 6.0) - 1.01) / .25))
    reveal = ease((t - 2.02) / .70)
    if loop:
        reveal = 0

    # Fixed clip is the printer slot. Paper moves; print strokes overlap the feed.
    breathe = 1 if loop or t < 3 else .965 + .035 * math.cos((t - 3) * math.pi * 2)
    slot_opacity = .43 if loop else .43 * (1 - ease((t - 1.42) / .28))
    mark_svg = f'''<defs><clipPath id="slot"><rect x="17" y="10" width="46" height="55"/></clipPath><clipPath id="edge"><rect x="17" y="53" width="{46*fill:.3f}" height="12"/></clipPath></defs>
      <rect width="80" height="80" rx="16" fill="{INK}"/>
      <g clip-path="url(#slot)"><g transform="translate(0 {feed + recoil:.3f})"><path d="{PAPER_SHAPE}" fill="{PAPER}"/>
      <path d="M25 22H51" stroke="{INK}" opacity=".38" stroke-width="2.5" stroke-dasharray="26" stroke-dashoffset="{26*(1-l1):.2f}"/>
      <path d="M25 28H43" stroke="{INK}" opacity=".38" stroke-width="2.5" stroke-dasharray="18" stroke-dashoffset="{18*(1-l2):.2f}"/>
      <path d="{TEETH}" fill="{flicker}" opacity="{verdict:.3f}"/>
      <g clip-path="url(#edge)" opacity="{breathe:.3f}"><path d="{TEETH}" fill="{GREEN}"/></g>
      <g opacity="{stamp:.3f}" transform="translate(0 {stamp_y:.3f}) translate(40 38) scale({1/squash:.4f} {squash:.4f}) translate(-40 -38)"><path d="{CHECK}" fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter"/></g></g></g>
      <path d="M13 66H67" stroke="{PAPER}" stroke-width="2" opacity="{slot_opacity:.3f}"/>'''
    body = bg + f'<g transform="translate({x:.2f} {y:.2f}) scale({scale:.5f})">{mark_svg}</g>'
    if not loop:
        baseline = height/2 + name_size*.36
        offset = x + mark_w + 25*scale
        # Characters rise on a 35 ms cascade. Their forms are paths, not font text.
        for i, ch in enumerate("Pay-on-Green"):
            path, pre = glyphs("Pay-on-Green"[:i], name_size, INK)
            letter, _ = glyphs(ch, name_size, INK, offset + pre, baseline + 10*scale*(1-ease((t-2.05-i*.035)/.20)), lambda _: ease((t-2.05-i*.035)/.20))
            body += letter
        body += f'<path d="M{left:.2f} {height*.79:.2f}H{width-left:.2f}" stroke="#D4DCDC" stroke-width="2" opacity="{reveal:.3f}"/>'
    return svg(body, width, height)


def verify_video(path: Path, width: int, height: int, codec: str, frames: int | None = None):
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)], capture_output=True, text=True, check=True)
    streams = [s for s in json.loads(probe.stdout)["streams"] if s["codec_type"] == "video"]
    if len(streams) != 1 or (streams[0]["codec_name"], streams[0]["width"], streams[0]["height"]) != (codec, width, height):
        raise RuntimeError(f"invalid video: {path}")
    if codec == "h264" and (streams[0]["pix_fmt"] != "yuv420p" or streams[0]["avg_frame_rate"] != "60/1" or int(streams[0]["nb_frames"]) != frames):
        raise RuntimeError(f"invalid H.264 frames: {path}")


def pipe_video(out: Path, width: int, height: int, duration: float, loop=False):
    frames = round(duration * 60)
    temp = out.with_name(out.stem + ".rendering" + out.suffix)
    ff = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", "60", "-vcodec", "png", "-i", "-", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(temp)], stdin=subprocess.PIPE)
    try:
        for frame in range(frames):
            image = subprocess.run(["rsvg-convert", "-w", str(width), "-h", str(height)], input=film_frame(frame/60, width, height, loop).encode(), stdout=subprocess.PIPE, check=True).stdout
            ff.stdin.write(image)
            if frame % 60 == 0:
                print(f"{out.name}: {frame}/{frames}", flush=True)
    finally:
        ff.stdin.close()
        if ff.wait():
            raise RuntimeError(f"ffmpeg failed: {temp}")
    verify_video(temp, width, height, "h264", frames)
    os.replace(temp, out)


def transcode(source: Path, out: Path, options: list[str], width: int, height: int, codec: str, frames: int | None = None):
    temp = out.with_name(out.stem + ".rendering" + out.suffix)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), *options, str(temp)], check=True)
    verify_video(temp, width, height, codec, frames)
    os.replace(temp, out)


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "assets":
        assets()
    elif mode == "sting":
        out = ROOT / "brand"
        out.mkdir(exist_ok=True)
        pipe_video(out / "logo-sting.mp4", 3840, 2160, 4.5)
        transcode(out / "logo-sting.mp4", out / "logo-sting-1080.mp4", ["-vf", "scale=1920:1080:flags=lanczos", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart"], 1920, 1080, "h264", 270)
    elif mode == "loop":
        out = ROOT / "brand"
        out.mkdir(exist_ok=True)
        pipe_video(out / "logo-loop.mp4", 720, 720, 6, True)
        transcode(out / "logo-loop.mp4", out / "logo-loop.webp", ["-loop", "0", "-c:v", "libwebp_anim", "-lossless", "0", "-quality", "90"], 720, 720, "webp_anim")
    else:
        raise SystemExit("use assets, sting, or loop")
