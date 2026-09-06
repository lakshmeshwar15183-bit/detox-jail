#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = "assets"
BG = (6, 8, 15)          # #06080F
CARD_BG = (15, 19, 32)   # #0F1320
CARD_BORDER = (26, 31, 46) # #1A1F2E
CARD_BORDER2 = (42, 49, 72) # #2A3148
VAULT_BG = (10, 13, 24)  # #0A0D18
BAR_BG = (26, 31, 46)    # #1A1F2E
BAR_BORDER = (42, 49, 120) # a bit brighter
TEXT_WHITE = (255, 255, 255)
TEXT_MUTED = (139, 147, 184) # #8B93B8
TEXT_SUBTLE = (90, 99, 120) # #5A6378
ACCENT = (34, 197, 94) # #22C55E just for dot
JAIL_RED = (239, 68, 68) # #EF4444

def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception as e:
        print(f"failed {path} {e}")
        try:
            return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
        except:
            return ImageFont.load_default()

# Try premium fonts
TITLE_FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TITLE_FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
MONO_FONT_PATH = "/System/Library/Fonts/Supplemental/Andale Mono.ttf"
MONO_FALLBACK = "/System/Library/Fonts/Monaco.ttf"

def get_title_font(size):
    for p in [TITLE_FONT_BLACK, TITLE_FONT_PATH, "/System/Library/Fonts/HelveticaNeue.ttc", "/System/Library/Fonts/Helvetica.ttc"]:
        try:
            # for ttc need index 1 maybe
            return ImageFont.truetype(p, size)
        except:
            continue
    return ImageFont.load_default()

def get_mono_font(size):
    for p in [MONO_FONT_PATH, MONO_FALLBACK, "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"]:
        try:
            return ImageFont.truetype(p, size)
        except:
            continue
    return ImageFont.load_default()

def draw_icon(size=1024, out_path="assets/icon.png", transparent=False):
    if transparent:
        img = Image.new("RGBA", (size, size), (0,0,0,0))
    else:
        img = Image.new("RGBA", (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)

    # subtle outer jail bars pattern (very faint vertical lines across bg)
    if not transparent:
        for x in range(0, size, 170):
            draw.rectangle([x, 0, x+1, size], fill=(15,19,32,255))

    # card
    pad = int(size * 0.15625) # 160 for 1024
    card_l, card_t, card_r, card_b = pad, pad, size-pad, size-pad
    radius = int(size * 0.03125) # 32
    # draw card with rounded rect
    draw.rounded_rectangle([card_l, card_t, card_r, card_b], radius=radius, fill=CARD_BG+(255,), outline=CARD_BORDER+(255,), width=2)

    # vault area inside card
    vault_pad = int(size * 0.0586) # 60
    vault_l = card_l + vault_pad
    vault_t = card_t + vault_pad
    vault_r = card_r - vault_pad
    vault_b = card_b - int(size*0.28) # leave room for text
    # vault bg
    vault_radius = int(size*0.02)
    draw.rounded_rectangle([vault_l, vault_t, vault_r, vault_b], radius=vault_radius, fill=VAULT_BG+(255,), outline=CARD_BORDER+(255,), width=1)

    # vault bars - 5 vertical bars
    vault_w = vault_r - vault_l
    vault_h = vault_b - vault_t
    bar_n = 5
    bar_w = int(size * 0.018) # ~18px for 1024
    gap = (vault_w - bar_n*bar_w) // (bar_n+1)
    bar_t = vault_t + int(size*0.02)
    bar_b = vault_b - int(size*0.02)
    # centered vault icon "▦" area? We'll just draw bars
    for i in range(bar_n):
        x0 = vault_l + gap + i*(bar_w+gap)
        x1 = x0 + bar_w
        # bar bg
        draw.rounded_rectangle([x0, bar_t, x1, bar_b], radius=bar_w//2, fill=BAR_BG+(255,), outline=CARD_BORDER2+(255,), width=1)
        # bolts top and bottom
        bolt_r = max(3, int(size*0.006))
        for by in [bar_t+int(size*0.015), bar_b-int(size*0.015)]:
            cx = (x0+x1)//2
            draw.ellipse([cx-bolt_r, by-bolt_r, cx+bolt_r, by+bolt_r], fill=CARD_BORDER2+(255,))
    # central lock icon - small diamond / circle in middle bar
    # Draw central emphasized: middle bar highlight
    mid = bar_n//2
    mx0 = vault_l + gap + mid*(bar_w+gap)
    mx1 = mx0 + bar_w
    # highlight middle bar with subtle red tint border for JAIL feel
    draw.rounded_rectangle([mx0-2, bar_t-2, mx1+2, bar_b+2], radius=bar_w//2+2, outline=JAIL_RED+(60,), width=2)
    # central lock circle
    lock_r = int(size*0.055)
    cx, cy = size//2, (vault_t+vault_b)//2
    draw.ellipse([cx-lock_r, cy-lock_r, cx+lock_r, cy+lock_r], fill=(239,68,68,255), outline=(255,255,255,30), width=2)
    # lock inner: small rect for shackle?
    # draw white jail icon inside lock: "▦" simulated as small rect with bars
    inner = int(lock_r*0.45)
    draw.rectangle([cx-inner, cy-inner//2, cx+inner, cy+inner], fill=(255,255,255,255))
    # small bars inside lock rect
    for bx in [cx-inner//2, cx, cx+inner//2]:
        draw.rectangle([bx-1, cy-inner//2, bx+1, cy+inner], fill=JAIL_RED+(255,))

    # Text "DON'T" below vault
    title = "DON'T"
    # try to fit width: we want approx 60% of card width
    # iterative font size
    target_w = (card_r-card_l) * 0.70
    # start size 140 for 1024
    fs = int(size*0.105)
    font = get_title_font(fs)
    # measure and adjust
    for _ in range(3):
        bbox = draw.textbbox((0,0), title, font=font)
        w = bbox[2]-bbox[0]
        if w > target_w:
            fs = int(fs*0.92)
            font = get_title_font(fs)
        else:
            break
    bbox = draw.textbbox((0,0), title, font=font)
    w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
    tx = (size - w)//2
    # baseline: just below vault_b + padding
    ty = vault_b + int(size*0.045)
    # add slight letter spacing simulation by drawing with tracking? We'll just draw as is but with extra spacing maybe not needed
    draw.text((tx, ty), title, font=font, fill=TEXT_WHITE+(255,))

    # Subtitle "SCREEN JAIL"
    sub = "SCREEN  JAIL"
    sub_fs = int(size*0.028)
    sub_font = get_mono_font(sub_fs)
    # need to increase tracking: we do manual spacing 6px
    # We'll draw by measuring and then draw with spacing
    # Simpler: draw with increased letter spacing via drawing each char
    # Calculate total width with spacing 2px per char
    tracking = int(size*0.006)
    # measure each char
    total_w = 0
    char_ws = []
    for ch in sub:
        if ch == " ":
            cw = sub_fs//2
        else:
            bbox = draw.textbbox((0,0), ch, font=sub_font)
            cw = bbox[2]-bbox[0]
        char_ws.append(cw)
        total_w += cw + tracking
    total_w -= tracking
    sx = (size - total_w)//2
    sy = ty + h + int(size*0.038)
    x = sx
    for i,ch in enumerate(sub):
        draw.text((x, sy), ch, font=sub_font, fill=TEXT_MUTED+(255,))
        x += char_ws[i] + tracking

    # bottom micro tagline
    micro = "OFFLINE  •  SECURE  •  COM.DONT.JAIL"
    micro_fs = int(size*0.012)
    micro_font = get_mono_font(micro_fs)
    # center micro
    bbox = draw.textbbox((0,0), micro, font=micro_font)
    mw = bbox[2]-bbox[0]
    mx = (size - mw)//2
    my = card_b - int(size*0.045)
    draw.text((mx, my), micro, font=micro_font, fill=TEXT_SUBTLE+(255,))

    # top mono header inside card: "— DON'T —"
    top_txt = "—  DON'T  —"
    top_fs = int(size*0.014)
    top_font = get_mono_font(top_fs)
    bbox = draw.textbbox((0,0), top_txt, font=top_font)
    tw = bbox[2]-bbox[0]
    tx2 = (size - tw)//2
    ty2 = card_t + int(size*0.02)
    draw.text((tx2, ty2), top_txt, font=top_font, fill=TEXT_SUBTLE+(255,))

    img = img.convert("RGB") if not transparent else img
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    img.save(out_path, "PNG")
    print(f"saved {out_path} {size}x{size} transparent={transparent}")

def draw_splash():
    # splash: 2048x2048 centered, but expo expects 1284x2778 portrait. We'll make 2048x2048 and also 1284x2778 variant
    for sz, name in [(2048, "assets/splash.png"), (1284, "assets/splash-1284.png")]:
        if "1284" in name:
            w, h = 1284, 2778
            img = Image.new("RGB", (w, h), BG)
            draw = ImageDraw.Draw(img)
            # center card for splash: 700x700
            card_s = 720
            cl = (w - card_s)//2
            ct = (h - card_s)//2 - 120
            cr = cl + card_s
            cb = ct + card_s
            # we reuse draw_icon logic scaled: just paste scaled icon central
            # generate temp icon 1024 and resize to 720 and paste
            tmp = Image.new("RGB", (1024,1024), BG)
            # Instead create splash directly with same vault graphic but larger canvas: just draw icon centered into larger canvas by pasting
            # We'll generate a 1024 icon in memory and paste
            # Quick: create icon temp file then open
            draw_icon(size=1024, out_path="/tmp/splash_tmp.png", transparent=False)
            icon = Image.open("/tmp/splash_tmp.png")
            icon = icon.resize((card_s, card_s), Image.LANCZOS)
            img.paste(icon, (cl, ct))
            # add app name below card
            # use fonts
            title = "DON'T"
            fs = 96
            font = get_title_font(fs)
            draw = ImageDraw.Draw(img)
            bbox = draw.textbbox((0,0), title, font=font)
            tw = bbox[2]-bbox[0]
            tx = (w - tw)//2
            ty = cb + 48
            draw.text((tx, ty), title, font=font, fill=TEXT_WHITE)
            sub = "Your apps go to jail so you can go free."
            sub_fs = 24
            sub_font = get_mono_font(sub_fs)
            bbox = draw.textbbox((0,0), sub, font=sub_font)
            sw = bbox[2]-bbox[0]
            sx = (w - sw)//2
            sy = ty + 110
            draw.text((sx, sy), sub, font=sub_font, fill=TEXT_MUTED)
            img.save(name, "PNG")
            print(f"saved {name} {w}x{h}")
        else:
            # 2048 square splash (legacy)
            draw_icon(size=2048, out_path=name, transparent=False)

def draw_favicon():
    # 48x48 and 32x32 favicon and 192 for android-chrome
    for sz in [48, 32, 192, 512]:
        draw_icon(size=sz, out_path=f"assets/favicon-{sz}.png", transparent=False)
    # also classic favicon.png 48
    draw_icon(size=48, out_path="assets/favicon.png", transparent=False)
    print("favicon variants done")

if __name__ == "__main__":
    draw_icon(size=1024, out_path="assets/icon.png", transparent=False)
    # adaptive foreground: transparent bg, card only
    draw_icon(size=1024, out_path="assets/adaptive-icon.png", transparent=False) # solid for now (backgroundColor #06080F will double but ok)
    # try transparent version for adaptive if wanted
    draw_icon(size=1024, out_path="assets/adaptive-icon-transparent.png", transparent=True)
    draw_splash()
    draw_favicon()
    print("all logos done")
