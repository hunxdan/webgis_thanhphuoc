# Cắt (subset) font OFL thành woff gọn: Latin + Latin mở rộng + tiếng Việt.
# Dùng: python3 tools/make-fonts.py   (cần fontTools)
from fontTools import subset
from fontTools.ttLib import TTFont
import os
OUT='assets/fonts'; os.makedirs(OUT,exist_ok=True)
U=[*range(0x20,0x7f),*range(0xa0,0x180),*range(0x180,0x250),0x1e00,*range(0x1ea0,0x1efa),
   *range(0x300,0x31a),0x323,*range(0x2000,0x2070),0x20ab,0x20ac,0x2122,0x2190,0x2191,0x2192,0x2193,0x2197,0x2198,0x2212,0x2215,0x2248,0x2260,0x2264,0x2265,0x25cf,0x25cb,0x2715,0x2713,0xd7]
jobs=[('/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf','lora.woff'),
      ('/usr/share/fonts/truetype/google-fonts/Lora-Italic-Variable.ttf','lora-italic.woff'),
      ('/usr/share/fonts/opentype/inter/Inter-Regular.otf','inter-400.woff'),
      ('/usr/share/fonts/opentype/inter/Inter-Medium.otf','inter-500.woff'),
      ('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf','inter-600.woff')]
for src,dst in jobs:
    o=subset.Options(); o.flavor='woff'; o.layout_features=['kern','liga','calt','tnum','case','ccmp','locl','mark','mkmk','ss01','zero']; o.name_IDs=[1,2,3,4,6]; o.notdef_outline=True
    f=TTFont(src); s=subset.Subsetter(o); s.populate(unicodes=U); s.subset(f)
    f.flavor='woff'; f.save(f'{OUT}/{dst}'); print(dst, os.path.getsize(f'{OUT}/{dst}')//1024,'KB')
