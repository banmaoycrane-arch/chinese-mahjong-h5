/* global MahjongTiles */
(function () {
'use strict';

const { sortHand, countById } = MahjongTiles;

/** 面子：顺子或刻子 */
function isShun(a, b, c) {
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  if (a.suit === 'feng' || a.suit === 'jian') return false;
  const v = [a.value, b.value, c.value].sort((x, y) => x - y);
  return v[0] + 1 === v[1] && v[1] + 1 === v[2];
}

function isKe(a, b, c) {
  return a.id === b.id && b.id === c.id;
}

/** 递归拆牌：4组面子+1对将 */
function canWinRecursive(tiles, meldsNeeded, pairAllowed) {
  if (tiles.length === 0) return meldsNeeded === 0 && !pairAllowed;

  const sorted = sortHand(tiles);
  const counts = countById(sorted);
  const ids = Object.keys(counts);

  if (pairAllowed) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (counts[id] >= 2) {
        const rest = removeN(sorted, id, 2);
        if (canWinRecursive(rest, meldsNeeded, false)) return true;
      }
    }
  }

  if (meldsNeeded <= 0) return false;

  const first = sorted[0];
  const same = sorted.filter((t) => t.id === first.id);
  if (same.length >= 3) {
    const rest = removeN(sorted, first.id, 3);
    if (canWinRecursive(rest, meldsNeeded - 1, pairAllowed)) return true;
  }

  if (first.suit !== 'feng' && first.suit !== 'jian') {
    const need = [first.value, first.value + 1, first.value + 2];
    if (need[2] <= 9) {
      const a = first;
      const b = sorted.find((t) => t.suit === a.suit && t.value === need[1]);
      const c = sorted.find((t) => t.suit === a.suit && t.value === need[2]);
      if (b && c) {
        let rest = sorted.slice();
        rest = removeOne(rest, a);
        rest = removeOne(rest, b);
        rest = removeOne(rest, c);
        if (canWinRecursive(rest, meldsNeeded - 1, pairAllowed)) return true;
      }
    }
  }
  return false;
}

function removeOne(tiles, tile) {
  const out = tiles.slice();
  const idx = out.findIndex((t) => t.id === tile.id);
  if (idx >= 0) out.splice(idx, 1);
  return out;
}

function removeN(tiles, id, n) {
  let left = n;
  return tiles.filter((t) => {
    if (t.id === id && left > 0) { left--; return false; }
    return true;
  });
}

/** 七对 */
function isSevenPairs(tiles) {
  if (tiles.length !== 14) return false;
  const c = countById(tiles);
  return Object.keys(c).length === 7 && Object.values(c).every((n) => n === 2);
}

/** 手牌+已亮面子是否可胡（含自摸多一张） */
function canHu(hand, melds, extraTile) {
  const all = hand.slice();
  if (extraTile) all.push(extraTile);
  const meldCount = melds.length;
  const needMelds = 4 - meldCount;
  if (all.length !== needMelds * 3 + 2) return false;
  if (isSevenPairs(all)) return true;
  return canWinRecursive(all, needMelds, true);
}

function canPeng(hand, tile) {
  return hand.filter((t) => t.id === tile.id).length >= 2;
}

function canGangFromDiscard(hand, tile) {
  return hand.filter((t) => t.id === tile.id).length >= 3;
}

function canGangFromDraw(hand, tile) {
  return hand.filter((t) => t.id === tile.id).length === 3;
}

function canAnGang(hand) {
  const c = countById(hand);
  return Object.keys(c).filter((id) => c[id] === 4).map((id) => {
    const t = hand.find((x) => x.id === id);
    return { tile: t, id };
  });
}

function canChi(hand, tile) {
  if (tile.suit === 'feng' || tile.suit === 'jian') return [];
  const combos = [];
  const v = tile.value;
  const suit = tile.suit;
  const has = (val) => hand.some((t) => t.suit === suit && t.value === val);

  if (v >= 3 && has(v - 2) && has(v - 1)) {
    combos.push([
      hand.find((t) => t.suit === suit && t.value === v - 2),
      hand.find((t) => t.suit === suit && t.value === v - 1),
      tile,
    ]);
  }
  if (v >= 2 && v <= 8 && has(v - 1) && has(v + 1)) {
    combos.push([
      hand.find((t) => t.suit === suit && t.value === v - 1),
      tile,
      hand.find((t) => t.suit === suit && t.value === v + 1),
    ]);
  }
  if (v <= 7 && has(v + 1) && has(v + 2)) {
    combos.push([
      tile,
      hand.find((t) => t.suit === suit && t.value === v + 1),
      hand.find((t) => t.suit === suit && t.value === v + 2),
    ]);
  }
  return combos;
}

/** 番型简计（基础） */
function scoreHand(hand, melds, extraTile, isZimo) {
  let fan = 1;
  if (isZimo) fan += 1;
  const all = hand.slice();
  if (extraTile) all.push(extraTile);
  if (isSevenPairs(all)) fan += 2;
  const c = countById(all);
  if (Object.keys(c).some((id) => c[id] === 4)) fan += 1;
  return fan;
}

window.MahjongRules = {
  canHu, canPeng, canGangFromDiscard, canGangFromDraw, canAnGang, canChi,
  isSevenPairs, scoreHand, isShun, isKe,
};
})();
