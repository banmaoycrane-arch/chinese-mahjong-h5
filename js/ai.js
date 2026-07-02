/* global MahjongTiles, MahjongRules, MahjongDifficulty */
(function () {
'use strict';

const { sortHand, countById, tileLabel } = MahjongTiles;
const { canHu, canPeng, canGangFromDiscard, canChi } = MahjongRules;

const SEAT_NAMES = ['东家(你)', '南家', '西家', '北家'];

/** 逆时针：0东→3北→2西→1南 */
function nextSeat(s) { return (s + 3) % 4; }
function prevSeat(s) { return (s + 1) % 4; }

function tileUsefulness(tile, hand) {
  const c = countById(hand);
  let score = 0;
  if (tile.suit === 'jian') score += 2;
  if (tile.suit === 'feng') score += 1.5;
  score += (c[tile.id] || 0) * 3;
  if (tile.suit !== 'feng' && tile.suit !== 'jian') {
    const lo = hand.some((t) => t.suit === tile.suit && t.value === tile.value - 1);
    const hi = hand.some((t) => t.suit === tile.suit && t.value === tile.value + 1);
    const lo2 = hand.some((t) => t.suit === tile.suit && t.value === tile.value - 2);
    const hi2 = hand.some((t) => t.suit === tile.suit && t.value === tile.value + 2);
    if (lo) score += 2;
    if (hi) score += 2;
    if (lo && hi) score += 3;
    if (lo2) score += 0.5;
    if (hi2) score += 0.5;
  }
  return score;
}

function pickDiscard(hand, melds, diff) {
  const sorted = sortHand(hand);
  if (Math.random() < diff.aiMistakeRate) {
    return sorted[Math.floor(Math.random() * sorted.length)];
  }
  let worst = sorted[0];
  let worstScore = Infinity;
  sorted.forEach((t) => {
    const rest = hand.filter((x, i, arr) => {
      const idx = arr.indexOf(t);
      return i !== idx || arr.lastIndexOf(t) !== idx;
    });
    const s = tileUsefulness(t, rest) + (diff.aiDefense * Math.random() * 2);
    if (s < worstScore) { worstScore = s; worst = t; }
  });
  return worst;
}

function shouldClaim(prob, diff) {
  return Math.random() < prob * diff.aiClaimRate;
}

function decideClaim(seat, hand, melds, tile, fromSeat, diff, isHumanTurn) {
  if (canHu(hand, melds, tile) && shouldClaim(diff.aiHuRate, diff)) {
    return { action: 'hu', tile };
  }
  if (canGangFromDiscard(hand, tile) && shouldClaim(0.6, diff)) {
    return { action: 'gang', tile };
  }
  if (canPeng(hand, tile) && shouldClaim(0.7, diff)) {
    return { action: 'peng', tile };
  }
  const shangJia = prevSeat(seat);
  if (fromSeat === shangJia) {
    const chis = canChi(hand, tile);
    if (chis.length && shouldClaim(0.5, diff)) {
      return { action: 'chi', tile, combo: chis[0] };
    }
  }
  return null;
}

function suggestDiscard(hand, melds) {
  return pickDiscard(hand, melds, { aiMistakeRate: 0, aiDefense: 0 });
}

function aiDiscardDelay(diff) {
  return Math.floor(diff.aiThinkMs * diff.aiDelayMul * (0.7 + Math.random() * 0.6));
}

window.MahjongAI = {
  SEAT_NAMES, nextSeat, prevSeat,
  pickDiscard, suggestDiscard, decideClaim, aiDiscardDelay, tileUsefulness,
};
})();
