"""Remove the background from a character image: python cutout.py in.png out.png"""

import sys

from PIL import Image
from rembg import remove

if len(sys.argv) != 3:
    raise SystemExit("Usage: cutout.py <input image> <output.png>")
image = Image.open(sys.argv[1]).convert("RGBA")
result = remove(image)
box = result.getbbox()
(result.crop(box) if box else result).save(sys.argv[2], "PNG")
print(f"Saved transparent sticker to {sys.argv[2]}")
