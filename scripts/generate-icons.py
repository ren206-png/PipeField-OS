#!/usr/bin/env python3
"""
Generate iOS and Android app icons for PipeField OS.
Requires: pip install Pillow
Run: python3 scripts/generate-icons.py
"""
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow...")
    os.system(f"{sys.executable} -m pip install Pillow")
    from PIL import Image, ImageDraw, ImageFont

def make_icon(size: int) -> Image.Image:
    """Draw the PipeField OS icon at the given pixel size."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background — rounded square (the OS clips to shape, but we fill anyway)
    bg_color = (10, 13, 18)  # #0a0d12  surface-900
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=size * 0.22,
        fill=bg_color,
    )

    # Accent gradient simulation — two overlapping circles
    accent1 = (79, 142, 247)   # brand-500 #4f8ef7
    accent2 = (99,  91, 255)   # brand-600 #635bff

    cx, cy = size / 2, size / 2
    r = size * 0.30

    # Glow circle 1
    glow_size = int(r * 2.6)
    glow = Image.new('RGBA', (glow_size, glow_size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(glow_size // 2, 0, -1):
        alpha = int(80 * (i / (glow_size // 2)))
        gd.ellipse(
            [glow_size // 2 - i, glow_size // 2 - i,
             glow_size // 2 + i, glow_size // 2 + i],
            fill=(*accent1, alpha),
        )
    img.paste(glow, (int(cx - glow_size / 2), int(cy - glow_size / 2)), glow)

    # Pipe symbol — three horizontal bars (like piping segments)
    bar_w   = int(size * 0.52)
    bar_h   = max(2, int(size * 0.055))
    bar_gap = int(size * 0.10)
    bar_x   = int(cx - bar_w / 2)

    for i, color in enumerate([accent1, accent2, accent1]):
        bar_y = int(cy - bar_gap) + (i * bar_gap) - bar_h // 2
        draw.rounded_rectangle(
            [bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
            radius=bar_h // 2,
            fill=color,
        )

    # Weld dot — small circle on center bar (represents a weld joint)
    dot_r = max(2, int(size * 0.042))
    dot_x = int(cx)
    dot_y = int(cy) - bar_h // 2 + bar_h // 2
    draw.ellipse(
        [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
        fill=(255, 255, 255),
    )

    return img


# ── iOS icon sizes ────────────────────────────────────────────
IOS_SIZES = [
    (20,  '20x20@1x'),
    (40,  '20x20@2x'),
    (60,  '20x20@3x'),
    (29,  '29x29@1x'),
    (58,  '29x29@2x'),
    (87,  '29x29@3x'),
    (40,  '40x40@1x'),
    (80,  '40x40@2x'),
    (120, '40x40@3x'),
    (60,  '60x60@1x'),
    (120, '60x60@2x'),
    (180, '60x60@3x'),
    (76,  '76x76@1x'),
    (152, '76x76@2x'),
    (167, '83.5x83.5@2x'),
    (1024,'1024x1024@1x'),  # App Store
]

# ── Android sizes ─────────────────────────────────────────────
ANDROID_SIZES = [
    (48,  'mipmap-mdpi'),
    (72,  'mipmap-hdpi'),
    (96,  'mipmap-xhdpi'),
    (144, 'mipmap-xxhdpi'),
    (192, 'mipmap-xxxhdpi'),
]

out_ios     = 'ios-icons'
out_android = 'android-icons'
os.makedirs(out_ios,     exist_ok=True)
os.makedirs(out_android, exist_ok=True)

print("Generating iOS icons…")
for size, label in IOS_SIZES:
    icon = make_icon(size)
    # iOS requires JPEG (no transparency) for App Store icon
    rgb = Image.new('RGB', (size, size), (10, 13, 18))
    rgb.paste(icon, mask=icon.split()[3])
    path = os.path.join(out_ios, f'Icon-{label}.png')
    rgb.save(path, 'PNG')
    print(f"  ✓ {path}")

print("\nGenerating Android icons…")
for size, density in ANDROID_SIZES:
    icon = make_icon(size)
    d = os.path.join(out_android, density)
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, 'ic_launcher.png')
    icon.save(path, 'PNG')
    print(f"  ✓ {path}")

# Also save a 1024 master copy
master = make_icon(1024)
master.save('icon-master.png', 'PNG')
print("\n✓ icon-master.png (1024×1024)")
print("\nDone! Copy the ios-icons/ folder into your Xcode project.")
