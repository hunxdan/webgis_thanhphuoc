// icons.js — biểu tượng của bản cũ (SVG nhúng dạng văn bản), đổi sang bảng màu mới bằng currentColor.
import layer from '../icons/LayerToggleIcon.svg';
import gps from '../icons/GeolocationIcon.svg';
import home from '../icons/HomeExtentIcon.svg';
import ruler from '../icons/RulerIcon.svg';
import basemap from '../icons/BasemapIcon.svg';
import thua from '../icons/ThuadatIcon.svg';
import qh from '../icons/QuyhoachIcon.svg';
import copy from '../icons/CopyIcon.svg';

const SRC = { layer, gps, home, ruler, basemap, thua, qh, copy };
const cache = new Map();

function recolor(txt) {
  return txt
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    .replace(/fill="url\(#[^)]*\)"/g, 'fill="currentColor"')
    .replace(/fill="#D3FB8C"/gi, 'fill="currentColor" fill-opacity=".45"')
    .replace(/fill="#B6E561"/gi, 'fill="currentColor" fill-opacity=".72"')
    .replace(/fill="#99C54A"/gi, 'fill="currentColor"')
    .replace(/stroke="white"/gi, 'stroke="#fbf4e4"')
    .replace(/stroke="#FF0000"/gi, 'stroke="#922b32"')
    .replace(/<svg ([^>]*?)width="\d+" height="\d+"/, '<svg $1');
}
/** Trả về phần tử <svg> mới (đổi màu theo màu chữ hiện tại). */
export function oldIcon(name, size = 22) {
  let doc = cache.get(name);
  if (!doc) { doc = new DOMParser().parseFromString(recolor(SRC[name]), 'image/svg+xml').documentElement; cache.set(name, doc); }
  const el = document.importNode(doc, true);
  el.setAttribute('width', size); el.setAttribute('height', size); el.setAttribute('aria-hidden', 'true'); el.setAttribute('focusable', 'false');
  return el;
}
