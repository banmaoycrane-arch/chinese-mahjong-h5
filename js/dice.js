/* global MahjongWall */
(function () {
'use strict';

const DICE_DOTS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function face(n) {
  return DICE_DOTS[Math.max(0, Math.min(5, (n || 1) - 1))];
}

function renderDie(el, value, rolling) {
  if (!el) return;
  const span = el.querySelector('.die-face') || el;
  if (rolling) {
    span.textContent = DICE_DOTS[Math.floor(Math.random() * 6)];
    el.classList.add('rolling');
  } else {
    span.textContent = face(value);
    el.classList.remove('rolling');
  }
}

function rollPair() {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return { d1, d2, sum: d1 + d2 };
}

function describeWallRoll(dealer, wallRoll) {
  const sum = wallRoll.sum;
  const wallSeat = (dealer + (sum - 1) % 4) % 4;
  const wallName = MahjongWall ? MahjongWall.seatWind(wallSeat) : '';
  return sum + ' 点 → 从' + wallName + '家牌墙起数';
}

function describeBreakRoll(info) {
  if (!info) return '';
  return info.breakSum + ' 点 → ' + info.wallSeatName + '家墙右端第' + info.stackFromRight + '墩起抓';
}

function describeGangRoll(roll) {
  return roll.sum + ' 点，从牌尾补牌';
}

window.MahjongDice = {
  face,
  renderDie,
  rollPair,
  DICE_DOTS,
  describeWallRoll,
  describeBreakRoll,
  describeGangRoll,
};
})();
