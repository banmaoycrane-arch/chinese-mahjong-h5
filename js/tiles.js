/* global */
(function () {
'use strict';

/** 万筒条 1-9，风 东南西北，箭 中发白 */
const SUITS = {
  wan:  { name: '万', color: '#c0392b' },
  tong: { name: '筒', color: '#2980b9' },
  tiao: { name: '条', color: '#27ae60' },
  feng: { name: '风', color: '#8e44ad' },
  jian: { name: '箭', color: '#d35400' },
};

const FENG_NAMES = ['东', '南', '西', '北'];
const JIAN_NAMES = ['中', '发', '白'];

function tileKey(suit, value) {
  return suit + ':' + value;
}

function makeTile(suit, value) {
  return { suit, value, id: tileKey(suit, value) };
}

function tileLabel(tile) {
  if (!tile) return '';
  if (tile.suit === 'feng') return FENG_NAMES[tile.value - 1];
  if (tile.suit === 'jian') return JIAN_NAMES[tile.value - 1];
  return tile.value + SUITS[tile.suit].name;
}

function compareTiles(a, b) {
  const order = { wan: 0, tong: 1, tiao: 2, feng: 3, jian: 4 };
  if (order[a.suit] !== order[b.suit]) return order[a.suit] - order[b.suit];
  return a.value - b.value;
}

function sortHand(tiles) {
  return tiles.slice().sort(compareTiles);
}

function createDeck() {
  const deck = [];
  ['wan', 'tong', 'tiao'].forEach((suit) => {
    for (let v = 1; v <= 9; v++) {
      for (let c = 0; c < 4; c++) deck.push(makeTile(suit, v));
    }
  });
  for (let v = 1; v <= 4; v++) {
    for (let c = 0; c < 4; c++) deck.push(makeTile('feng', v));
  }
  for (let v = 1; v <= 3; v++) {
    for (let c = 0; c < 4; c++) deck.push(makeTile('jian', v));
  }
  return deck;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function countById(tiles) {
  const m = {};
  tiles.forEach((t) => { m[t.id] = (m[t.id] || 0) + 1; });
  return m;
}

function removeTilesFrom(hand, toRemove) {
  const need = countById(toRemove);
  const out = [];
  const left = [];
  hand.forEach((t) => {
    if (need[t.id]) { need[t.id]--; out.push(t); }
    else left.push(t);
  });
  const ok = Object.values(need).every((n) => n === 0);
  return ok ? { ok: true, hand: left, removed: out } : { ok: false };
}

window.MahjongTiles = {
  SUITS, FENG_NAMES, JIAN_NAMES,
  tileKey, makeTile, tileLabel, compareTiles, sortHand,
  createDeck, shuffle, countById, removeTilesFrom,
};
})();
