/* global */
(function () {
'use strict';

/**
 * 设备类型判定（宽 + 高 + 是否触屏）
 * phone  ≤767   手机
 * tablet 768–1023  平板
 * laptop 1024–1439 笔记本
 * desktop ≥1440   台式 / 大屏
 */
function detectDeviceType() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const touch = window.matchMedia('(pointer: coarse)').matches
    || navigator.maxTouchPoints > 0;

  if (w <= 767 || (touch && w <= 820 && h <= 500)) return 'phone';
  if (w <= 1023) return 'tablet';
  if (w <= 1439) return 'laptop';
  return 'desktop';
}

function applyDeviceClasses() {
  const root = document.documentElement;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const type = detectDeviceType();
  const orientation = w >= h ? 'landscape' : 'portrait';

  root.dataset.device = type;
  root.dataset.orientation = orientation;
  root.dataset.touch = window.matchMedia('(pointer: coarse)').matches ? '1' : '0';

  const hint = document.getElementById('rotate-hint');
  if (hint) {
    const showRotate = type === 'phone' && orientation === 'portrait';
    hint.classList.toggle('hidden', !showRotate);
  }
}

function initDeviceLayout(options) {
  options = options || {};
  applyDeviceClasses();

  let timer = null;
  function onResize() {
    clearTimeout(timer);
    timer = setTimeout(applyDeviceClasses, 120);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  const statusBtn = document.getElementById('btn-status');
  const statusPanel = document.getElementById('status-panel');
  if (statusBtn && statusPanel) {
    statusBtn.addEventListener('click', () => {
      statusPanel.classList.toggle('panel-open');
      statusBtn.classList.toggle('active', statusPanel.classList.contains('panel-open'));
    });
    document.addEventListener('click', (e) => {
      if (!statusPanel.classList.contains('panel-open')) return;
      if (statusPanel.contains(e.target) || statusBtn.contains(e.target)) return;
      statusPanel.classList.remove('panel-open');
      statusBtn.classList.remove('active');
    });
  }

  if (options.onChange) onResize();
  return { applyDeviceClasses, detectDeviceType };
}

window.MahjongDevice = { initDeviceLayout, applyDeviceClasses, detectDeviceType };
})();
