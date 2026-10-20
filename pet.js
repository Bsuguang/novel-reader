'use strict';
// 桌面宠物：纯 SVG + CSS 动画的小动物，无任何依赖。
// 交互：单击弹跳、双击/右键回到阅读器、按住拖动换位置（位置由主进程持久化）。

// 通用脸部（两只眼 + 高光 + 腮红），参数决定眼距
function face(cy, dx, r) {
  return (
    '<g class="pet-eyes">' +
    `<circle cx="${60 - dx}" cy="${cy}" r="${r}" fill="#2f2a26"/>` +
    `<circle cx="${60 + dx}" cy="${cy}" r="${r}" fill="#2f2a26"/>` +
    `<circle cx="${60 - dx + 1.4}" cy="${cy - 1.4}" r="1.2" fill="#fff"/>` +
    `<circle cx="${60 + dx + 1.4}" cy="${cy - 1.4}" r="1.2" fill="#fff"/>` +
    '</g>' +
    `<ellipse cx="${60 - dx - 8}" cy="${cy + 8}" rx="4.5" ry="2.6" fill="#ff9eb5" opacity=".55"/>` +
    `<ellipse cx="${60 + dx + 8}" cy="${cy + 8}" rx="4.5" ry="2.6" fill="#ff9eb5" opacity=".55"/>`
  );
}

const PETS = {
  cat: {
    name: '小猫',
    svg:
      '<svg viewBox="0 0 120 130">' +
      '<path class="pet-tail" d="M88,96 Q112,90 107,64" stroke="#f0a03c" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      '<g class="pet-body">' +
      '<path d="M36,62 L27,32 L54,48 Z" fill="#f0a03c"/><path d="M84,62 L93,32 L66,48 Z" fill="#f0a03c"/>' +
      '<path d="M38,55 L33,40 L47,48 Z" fill="#ffd9a8"/><path d="M82,55 L87,40 L73,48 Z" fill="#ffd9a8"/>' +
      '<ellipse cx="60" cy="84" rx="32" ry="30" fill="#f0a03c"/>' +
      '<ellipse cx="60" cy="96" rx="17" ry="13" fill="#ffe9c8"/>' +
      face(76, 12, 4) +
      '<path d="M56,84 L64,84 L60,89 Z" fill="#e2715b"/>' +
      '<path d="M56,91 Q60,95 64,91" stroke="#7a4a1f" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M18,74 L34,77 M18,84 L34,82 M102,74 L86,77 M102,84 L86,82" stroke="#c99a5f" stroke-width="1.5" stroke-linecap="round"/>' +
      '</g>' +
      '<ellipse cx="60" cy="122" rx="30" ry="5.5" fill="#000" opacity=".12"/>' +
      '</svg>',
  },
  dog: {
    name: '小狗',
    svg:
      '<svg viewBox="0 0 120 130">' +
      '<path class="pet-tail" d="M88,94 Q112,88 105,62" stroke="#b98456" stroke-width="10" fill="none" stroke-linecap="round"/>' +
      '<g class="pet-body">' +
      '<ellipse cx="33" cy="62" rx="12" ry="21" fill="#8a5a33" transform="rotate(20 33 62)"/>' +
      '<ellipse cx="87" cy="62" rx="12" ry="21" fill="#8a5a33" transform="rotate(-20 87 62)"/>' +
      '<ellipse cx="60" cy="84" rx="32" ry="30" fill="#d9a066"/>' +
      '<ellipse cx="60" cy="92" rx="18" ry="15" fill="#f3d9b1"/>' +
      face(74, 12, 4) +
      '<ellipse cx="60" cy="84" rx="5.5" ry="4" fill="#3a2d23"/>' +
      '<path d="M55,90 Q60,95 65,90" stroke="#3a2d23" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path d="M57,93 Q60,100 63,93 Z" fill="#e2715b"/>' +
      '</g>' +
      '<ellipse cx="60" cy="122" rx="30" ry="5.5" fill="#000" opacity=".12"/>' +
      '</svg>',
  },
  rabbit: {
    name: '小兔',
    svg:
      '<svg viewBox="0 0 120 130">' +
      '<g class="pet-body">' +
      '<ellipse cx="48" cy="36" rx="9" ry="25" fill="#fff" stroke="#e6ddd4" stroke-width="1.5"/>' +
      '<ellipse cx="72" cy="36" rx="9" ry="25" fill="#fff" stroke="#e6ddd4" stroke-width="1.5"/>' +
      '<ellipse cx="48" cy="39" rx="4" ry="16" fill="#ffc7d4"/>' +
      '<ellipse cx="72" cy="39" rx="4" ry="16" fill="#ffc7d4"/>' +
      '<ellipse cx="60" cy="86" rx="30" ry="29" fill="#fff" stroke="#e6ddd4" stroke-width="1.5"/>' +
      '<ellipse cx="60" cy="97" rx="15" ry="11" fill="#fdf1f4"/>' +
      face(78, 11, 4) +
      '<path d="M57,86 L63,86 L60,90 Z" fill="#f28ba8"/>' +
      '<path d="M56,92 Q60,95 64,92" stroke="#c9718c" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      '<ellipse cx="60" cy="122" rx="28" ry="5.5" fill="#000" opacity=".1"/>' +
      '</svg>',
  },
  panda: {
    name: '熊猫',
    svg:
      '<svg viewBox="0 0 120 130">' +
      '<g class="pet-body">' +
      '<circle cx="36" cy="54" r="13" fill="#2f2a26"/><circle cx="84" cy="54" r="13" fill="#2f2a26"/>' +
      '<ellipse cx="33" cy="94" rx="10" ry="15" fill="#2f2a26" transform="rotate(18 33 94)"/>' +
      '<ellipse cx="87" cy="94" rx="10" ry="15" fill="#2f2a26" transform="rotate(-18 87 94)"/>' +
      '<ellipse cx="60" cy="86" rx="33" ry="30" fill="#fff" stroke="#e6e2de" stroke-width="1.5"/>' +
      '<ellipse cx="48" cy="76" rx="8.5" ry="10.5" fill="#2f2a26" transform="rotate(-14 48 76)"/>' +
      '<ellipse cx="72" cy="76" rx="8.5" ry="10.5" fill="#2f2a26" transform="rotate(14 72 76)"/>' +
      '<g class="pet-eyes">' +
      '<circle cx="48" cy="76" r="3.4" fill="#fff"/><circle cx="48.8" cy="76.4" r="1.9" fill="#2f2a26"/>' +
      '<circle cx="72" cy="76" r="3.4" fill="#fff"/><circle cx="72.8" cy="76.4" r="1.9" fill="#2f2a26"/>' +
      '</g>' +
      '<ellipse cx="60" cy="86" rx="4.5" ry="3.2" fill="#2f2a26"/>' +
      '<path d="M55,92 Q60,96 65,92" stroke="#2f2a26" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="49" cy="90" rx="5" ry="2.8" fill="#ff9eb5" opacity=".5"/>' +
      '<ellipse cx="71" cy="90" rx="5" ry="2.8" fill="#ff9eb5" opacity=".5"/>' +
      '</g>' +
      '<ellipse cx="60" cy="122" rx="30" ry="5.5" fill="#000" opacity=".12"/>' +
      '</svg>',
  },
  fox: {
    name: '狐狸',
    svg:
      '<svg viewBox="0 0 120 130">' +
      '<path class="pet-tail" d="M86,98 Q114,92 107,62 Q103,50 93,55 Q101,76 82,90 Z" fill="#ef8354"/>' +
      '<circle cx="96" cy="56" r="6.5" fill="#fff"/>' +
      '<g class="pet-body">' +
      '<path d="M34,66 L26,32 L56,48 Z" fill="#ef8354"/><path d="M86,66 L94,32 L64,48 Z" fill="#ef8354"/>' +
      '<path d="M32,50 L28,37 L42,46 Z" fill="#3a2d23"/><path d="M88,50 L92,37 L78,46 Z" fill="#3a2d23"/>' +
      '<ellipse cx="60" cy="84" rx="32" ry="30" fill="#ef8354"/>' +
      '<ellipse cx="60" cy="95" rx="16" ry="13" fill="#fff"/>' +
      '<ellipse cx="60" cy="85" rx="13" ry="9" fill="#fff"/>' +
      face(76, 12, 4) +
      '<ellipse cx="60" cy="84" rx="4.5" ry="3.2" fill="#3a2d23"/>' +
      '<path d="M56,90 Q60,94 64,90" stroke="#3a2d23" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</g>' +
      '<ellipse cx="60" cy="122" rx="30" ry="5.5" fill="#000" opacity=".12"/>' +
      '</svg>',
  },
  chick: {
    name: '小鸡',
    svg:
      '<svg viewBox="0 0 120 130">' +
      '<g class="pet-body">' +
      '<path d="M56,46 Q57,32 66,36" stroke="#e8b923" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
      '<ellipse class="pet-tail" cx="29" cy="88" rx="9" ry="15" fill="#f2c01e" transform="rotate(18 29 88)"/>' +
      '<ellipse class="pet-tail" cx="91" cy="88" rx="9" ry="15" fill="#f2c01e" transform="rotate(-18 91 88)"/>' +
      '<circle cx="60" cy="84" r="32" fill="#ffd93d"/>' +
      '<ellipse cx="60" cy="98" rx="15" ry="11" fill="#ffe98a"/>' +
      face(78, 12, 4) +
      '<path d="M54,86 L66,86 L60,94 Z" fill="#f28c28"/>' +
      '</g>' +
      '<ellipse cx="60" cy="122" rx="28" ry="5.5" fill="#000" opacity=".1"/>' +
      '</svg>',
  },
};

let currentAnimal = 'cat';

function render(animal) {
  currentAnimal = PETS[animal] ? animal : 'cat';
  const el = document.getElementById('pet');
  el.innerHTML = PETS[currentAnimal].svg;
}

function bounce() {
  const el = document.getElementById('pet');
  el.classList.remove('bounce');
  void el.offsetWidth; // 重置动画
  el.classList.add('bounce');
}

// ---------- 交互 ----------
(function init() {
  // 读取设置里选中的动物（主进程每次显示前会重载本页，保证拿到最新值）
  try {
    window.api
      .getConfig()
      .then((cfg) => render((cfg && cfg.settings && cfg.settings.pet) || 'cat'))
      .catch(() => render('cat'));
  } catch (e) {
    render('cat');
  }

  const el = document.getElementById('pet');
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    lastX = e.screenX;
    lastY = e.screenY;
    window.api.petDragStart({ x: e.screenX, y: e.screenY });
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (Math.abs(e.screenX - lastX) + Math.abs(e.screenY - lastY) > 3) moved = true;
    lastX = e.screenX;
    lastY = e.screenY;
    window.api.petDragMove({ x: e.screenX, y: e.screenY });
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    window.api.petDragEnd();
    if (!moved) bounce(); // 原地单击：弹跳一下
  });
  el.addEventListener('dblclick', () => window.api.petRestore());
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.api.petRestore();
  });
})();
