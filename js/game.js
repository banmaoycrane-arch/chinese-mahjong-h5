/* global MahjongTiles, MahjongRules, MahjongAI, MahjongDifficulty */
(function () {
'use strict';

const { createDeck, shuffle, sortHand, removeTilesFrom, tileLabel } = MahjongTiles;
const { canHu, canPeng, canGangFromDiscard, canGangFromDraw, canAnGang, canChi, scoreHand } = MahjongRules;
const { nextSeat, prevSeat, pickDiscard, decideClaim, aiDiscardDelay } = MahjongAI;

function createPlayer(seat, isHuman) {
  return { seat, isHuman, hand: [], melds: [], discards: [], name: MahjongAI.SEAT_NAMES[seat] };
}

function createGame(difficultyId) {
  const diff = MahjongDifficulty.get(difficultyId);
  const players = [0, 1, 2, 3].map((s) => createPlayer(s, s === 0));
  let wall = [];
  let dealer = 0;
  let current = 0;
  let phase = 'menu';
  let lastDiscard = null;
  let lastDiscardFrom = -1;
  let drawnTile = null;
  let round = 1;
  const scores = [0, 0, 0, 0];
  let message = '';
  let winner = -1;
  let winInfo = null;
  let selectedTile = null;
  let actionButtons = [];
  let gameOver = false;
  let listener = null;

  function notify(extra) {
    if (listener) listener(getState(), extra || {});
  }

  function start() {
    players.forEach((p) => { p.hand = []; p.melds = []; p.discards = []; });
    wall = shuffle(createDeck());
    for (let i = 0; i < 13; i++) {
      players.forEach((p) => p.hand.push(wall.pop()));
    }
    players.forEach((p) => { p.hand = sortHand(p.hand); });
    current = dealer;
    drawnTile = null;
    lastDiscard = null;
    lastDiscardFrom = -1;
    winner = -1;
    winInfo = null;
    gameOver = false;
    actionButtons = [];
    message = players[dealer].name + ' 坐庄';
    beginTurn();
  }

  function beginTurn() {
    if (wall.length === 0) { endDraw(); return; }
    const tile = wall.pop();
    const p = players[current];
    p.hand.push(tile);
    p.hand = sortHand(p.hand);
    drawnTile = p.isHuman ? tile : null;
    message = p.name + (p.isHuman ? ' 请打牌' : ' 思考中…');
    if (p.isHuman) {
      phase = 'discard';
      buildHumanDiscardActions();
    } else {
      phase = 'ai-discard';
      notify({ aiDiscard: true, delay: aiDiscardDelay(diff) });
      return;
    }
    notify();
  }

  function buildHumanDiscardActions() {
    actionButtons = [];
    const p = players[0];
    const anGangs = canAnGang(p.hand);
    anGangs.forEach((g) => {
      actionButtons.push({ type: 'angang', tile: g.tile, label: '暗杠 ' + tileLabel(g.tile) });
    });
    const drawn = drawnTile;
    if (drawn) {
      const handWithoutDrawn = p.hand.filter((t) => t !== drawn);
      if (canGangFromDraw(handWithoutDrawn, drawn)) {
        actionButtons.push({ type: 'bugang', tile: drawn, label: '补杠 ' + tileLabel(drawn) });
      }
      if (canHu(handWithoutDrawn, p.melds, drawn)) {
        actionButtons.push({ type: 'zimo', tile: drawn, label: '自摸胡！' });
      }
    }
  }

  function buildHumanClaimActions(tile, from) {
    actionButtons = [];
    const p = players[0];
    if (canHu(p.hand, p.melds, tile)) {
      actionButtons.push({ type: 'hu', tile, label: '胡 ' + tileLabel(tile) });
    }
    if (canGangFromDiscard(p.hand, tile)) {
      actionButtons.push({ type: 'gang', tile, label: '杠 ' + tileLabel(tile) });
    }
    if (canPeng(p.hand, tile)) {
      actionButtons.push({ type: 'peng', tile, label: '碰 ' + tileLabel(tile) });
    }
    if (from === prevSeat(0)) {
      canChi(p.hand, tile).forEach((combo) => {
        actionButtons.push({ type: 'chi', tile, combo, label: '吃 ' + combo.map(tileLabel).join('') });
      });
    }
  }

  function removeDiscardFromPlayer(tile) {
    const fp = players[lastDiscardFrom];
    if (fp.discards.length && fp.discards[fp.discards.length - 1].id === tile.id) {
      fp.discards.pop();
    }
  }

  function addMeld(seat, type, tiles, claimed) {
    const p = players[seat];
    p.melds.push({ type, tiles: tiles.slice(), claimed: claimed || null });
    if (type === 'chi') {
      const toRemove = tiles.filter((t) => t !== claimed);
      p.hand = removeTilesFrom(p.hand, toRemove).hand;
    } else if (type === 'peng') {
      p.hand = removeTilesFrom(p.hand, p.hand.filter((t) => t.id === claimed.id).slice(0, 2)).hand;
    } else if (type === 'gang') {
      p.hand = removeTilesFrom(p.hand, p.hand.filter((t) => t.id === claimed.id).slice(0, 3)).hand;
    } else if (type === 'angang') {
      p.hand = removeTilesFrom(p.hand, p.hand.filter((t) => t.id === claimed.id)).hand;
    }
    removeDiscardFromPlayer(claimed);
  }

  function doWin(seat, tile, isZimo) {
    const p = players[seat];
    winner = seat;
    const fan = scoreHand(p.hand, p.melds, isZimo ? tile : null, isZimo);
    const mul = diff.id === 'hell' ? 2 : diff.id === 'hard' ? 1.5 : 1;
    const pay = Math.floor(10 * fan * mul);
    if (isZimo) {
      for (let i = 0; i < 4; i++) if (i !== seat) scores[i] -= pay;
      scores[seat] += pay * 3;
    } else {
      scores[lastDiscardFrom] -= pay * 3;
      scores[seat] += pay * 3;
    }
    winInfo = { seat, tile, isZimo, fan, pay, name: p.name };
    phase = 'end';
    gameOver = true;
    message = p.name + (isZimo ? ' 自摸' : ' 点炮胡') + '，' + fan + ' 番';
    actionButtons = [];
    notify();
  }

  function afterDiscard(seat, tile) {
    lastDiscard = tile;
    lastDiscardFrom = seat;
    drawnTile = null;
    selectedTile = null;
    phase = 'claim';
    message = players[seat].name + ' 打出 ' + tileLabel(tile);

    const claims = [];
    let s = nextSeat(seat);
    for (let step = 0; step < 3; step++) {
      const c = decideClaim(s, players[s].hand, players[s].melds, tile, seat, diff, false);
      if (c) claims.push({ seat: s, ...c });
      if (c && c.action === 'hu') break;
      s = nextSeat(s);
    }

    if (claims.length) {
      const hu = claims.find((c) => c.action === 'hu');
      const pick = hu || claims[0];
      setTimeout(() => resolveClaim(pick), hu ? 400 : 650);
      return;
    }

    buildHumanClaimActions(tile, seat);
    if (actionButtons.length) {
      phase = 'human-claim';
      message = '可以吃碰杠胡，或点「过」';
      notify();
      return;
    }
    nextTurn();
  }

  function resolveClaim(claim) {
    const { seat, action, tile, combo } = claim;
    const p = players[seat];
    actionButtons = [];

    if (action === 'hu') {
      doWin(seat, tile, false);
      return;
    }
    if (action === 'peng') {
      addMeld(seat, 'peng', [tile, tile, tile], tile);
      current = seat;
      message = p.name + ' 碰！';
      afterMeldNeedDiscard();
      return;
    }
    if (action === 'gang') {
      addMeld(seat, 'gang', [tile, tile, tile, tile], tile);
      current = seat;
      drawGangBonus();
      return;
    }
    if (action === 'chi' && combo) {
      addMeld(seat, 'chi', combo, tile);
      current = seat;
      message = p.name + ' 吃！';
      afterMeldNeedDiscard();
      return;
    }
  }

  function drawGangBonus() {
    const p = players[current];
    message = p.name + ' 杠！';
    if (wall.length) {
      const t = wall.pop();
      p.hand.push(t);
      p.hand = sortHand(p.hand);
      drawnTile = p.isHuman ? t : null;
    }
    afterMeldNeedDiscard();
  }

  function afterMeldNeedDiscard() {
    const p = players[current];
    if (p.isHuman) {
      phase = 'discard';
      buildHumanDiscardActions();
      notify();
    } else {
      phase = 'ai-discard';
      notify({ aiDiscard: true, delay: aiDiscardDelay(diff) });
    }
  }

  function nextTurn() {
    lastDiscard = null;
    current = nextSeat(lastDiscardFrom >= 0 ? lastDiscardFrom : current);
    beginTurn();
  }

  function humanDiscard(tile) {
    if (current !== 0 || (phase !== 'discard' && phase !== 'human-claim')) return false;
    const p = players[0];
    const res = removeTilesFrom(p.hand, [tile]);
    if (!res.ok) return false;
    p.hand = res.hand;
    actionButtons = [];
    afterDiscard(0, tile);
    return true;
  }

  function humanPass() {
    if (phase !== 'human-claim') return;
    actionButtons = [];
    nextTurn();
  }

  function humanAction(btn) {
    if (btn.type === 'zimo') {
      doWin(0, btn.tile, true);
      return;
    }
    if (btn.type === 'hu') {
      doWin(0, btn.tile, false);
      return;
    }
    if (btn.type === 'peng') {
      addMeld(0, 'peng', [btn.tile, btn.tile, btn.tile], btn.tile);
      current = 0;
      message = '你碰了！请出牌';
      afterMeldNeedDiscard();
      return;
    }
    if (btn.type === 'gang') {
      addMeld(0, 'gang', [btn.tile, btn.tile, btn.tile, btn.tile], btn.tile);
      current = 0;
      drawGangBonus();
      return;
    }
    if (btn.type === 'chi' && btn.combo) {
      addMeld(0, 'chi', btn.combo, btn.tile);
      current = 0;
      message = '你吃了！请出牌';
      afterMeldNeedDiscard();
      return;
    }
    if (btn.type === 'angang') {
      const t = btn.tile;
      addMeld(0, 'angang', [t, t, t, t], t);
      current = 0;
      drawGangBonus();
      return;
    }
    if (btn.type === 'bugang') {
      const peng = players[0].melds.find((m) => m.type === 'peng' && m.claimed && m.claimed.id === btn.tile.id);
      if (peng) {
        peng.type = 'gang';
        peng.tiles.push(btn.tile);
        players[0].hand = removeTilesFrom(players[0].hand, [btn.tile]).hand;
        drawGangBonus();
      }
    }
  }

  function aiDiscard() {
    if (phase !== 'ai-discard' || current === 0) return;
    const p = players[current];
    const tile = pickDiscard(p.hand, p.melds, diff);
    const res = removeTilesFrom(p.hand, [tile]);
    if (!res.ok) return;
    p.hand = res.hand;
    afterDiscard(current, tile);
  }

  function endDraw() {
    phase = 'end';
    gameOver = true;
    winner = -1;
    message = '流局，牌墙已尽';
    actionButtons = [];
    notify();
  }

  function newRound() {
    if (winner >= 0) dealer = winner;
    else dealer = (dealer + 1) % 4;
    round++;
    start();
  }

  function getState() {
    return {
      players: players.map((p) => ({
        seat: p.seat,
        isHuman: p.isHuman,
        name: p.name,
        handCount: p.hand.length,
        melds: p.melds,
        discards: p.discards,
      })),
      humanHand: players[0].hand,
      drawnTile: current === 0 ? drawnTile : null,
      wallCount: wall.length,
      current,
      dealer,
      phase,
      message,
      lastDiscard,
      lastDiscardFrom,
      selectedTile,
      actionButtons,
      scores,
      round,
      winner,
      winInfo,
      gameOver,
      difficulty: diff,
    };
  }

  function selectTile(tile) {
    if (phase !== 'discard' || current !== 0) return;
    selectedTile = selectedTile && selectedTile.id === tile.id ? null : tile;
    notify();
  }

  function onUpdate(fn) { listener = fn; }

  phase = 'ready';

  return {
    getState, onUpdate, start, selectTile, humanDiscard, humanPass, humanAction,
    aiDiscard, newRound,
  };
}

window.MahjongGame = { createGame };
})();
