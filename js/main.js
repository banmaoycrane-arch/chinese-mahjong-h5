/* global MahjongUI, MahjongDifficulty */
(function () {
'use strict';

document.addEventListener('DOMContentLoaded', function () {
  const saved = MahjongDifficulty.loadSaved();
  const d = MahjongDifficulty.get(saved);
  const el = document.getElementById('saved-diff-name');
  if (el) el.textContent = d.icon + ' ' + d.name;
  MahjongUI.initUI();
});

})();
