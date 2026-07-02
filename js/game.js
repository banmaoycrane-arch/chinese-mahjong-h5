/* global MahjongTiles, MahjongRules, MahjongAI, MahjongDifficulty, MahjongWall, MahjongDice */
(function () {
'use strict';

const { createDeck, shuffle, sortHand, removeTilesFrom, tileLabel } = MahjongTiles;
const { canHu, canPeng, canGangFromDiscard, canGangFromDraw, canAnGang, canChi, scoreHand } = MahjongRules;
const { nextSeat, prevSeat, pickDiscard, suggestDiscard, decideClaim, aiDiscardDelay } = MahjongAI;

function createPlayer(seat, isHuman) {
  const name = window.MahjongAvatars
    ? MahjongAvatars.getSeatDisplayName(seat, isHuman)
    : MahjongAI.SEAT_NAMES[seat];
  return { seat, isHuman, hand: [], melds: [], discards: [], name };
}

function createGame(difficultyId) {
  const diff = MahjongDifficulty.get(difficultyId);
  const players = [0, 1, 2, 3].map((s) => createPlayer(s, s === 0));
  let wall = null;
  let dealer = 0;
  let current = 0;
  let phase = 'menu';
  let lastDiscard = null;
  let lastDiscardFrom = -1;
  let drawnTile = null;
  let round = 1;
  const scores = [0, 0, 0, 0];
  let sessionStartScores = [0, 0, 0, 0];
  let roundStartScores = [0, 0, 0, 0];
  let message = '';
  let winner = -1;
  let winInfo = null;
  let selectedTile = null;
  let pendingAction = null;
  let actionButtons = [];
  let gameOver = false;
  let flowStep = null;
  let diceRoll = null;
  let wallBreak = null;
  let lastGangDice = null;
  let listener = null;

  function notify(extra) {
    if (listener) listener(getState(), extra || {});
  }

  function snd(event, data) {
    try {
      if (window.MahjongAudio && typeof MahjongAudio.onGameEvent === 'function') {
        MahjongAudio.onGameEvent(event, data || {});
      }
    } catch (e) {
      console.warn('audio skipped', event, e);
    }
  }

  function start() {
    roundStartScores = scores.slice();
    players.forEach((p) => {
      p.name = window.MahjongAvatars
        ? MahjongAvatars.getSeatDisplayName(p.seat, p.isHuman)
        : p.name;
      p.hand = [];
      p.melds = [];
      p.discards = [];
    });
    drawnTile = null;
    lastDiscard = null;
    lastDiscardFrom = -1;
    winner = -1;
    winInfo = null;
    gameOver = false;
    actionButtons = [];
    selectedTile = null;
    pendingAction = null;
    current = dealer;
    phase = 'flow';
    flowStep = 'prepare';

    const steps = [];
    if (round === 1) steps.push({ step: 'game_start' });
    else steps.push({ step: 'new_round' });
    steps.push({ step: 'dice_wall', data: {} });
    steps.push({ step: 'dice_break', data: {} });
    steps.push({ step: 'shuffle' });
    steps.push({ step: 'deal' });
    steps.push({ step: 'dealer', data: {} });
    steps.push({ step: 'ready' });

    const runFlow = window.MahjongAudio && MahjongAudio.runFlowSequence;
    if (!runFlow) {
      doRollWallDice();
      doRollBreakDice();
      doShuffleAndDeal();
      doDealTiles();
      message = players[dealer].name + ' 坐庄';
      flowStep = null;
      beginTurn();
      return;
    }

    message = '准备开始…';
    diceRoll = null;
    wallBreak = null;
    lastGangDice = null;
    notify();

    MahjongAudio.runFlowSequence(steps, {
      onStep: (step, data, cfg) => {
        flowStep = step;
        if (step === 'dice_wall') {
          const wr = doRollWallDice();
          data.roll = wr;
          data.round = round;
          data.dealer = dealer;
          data.dealerName = players[dealer].name;
          message = window.MahjongDice
            ? MahjongDice.describeWallRoll(dealer, wr)
            : ('色子 ' + wr.sum + ' 点');
        }
        if (step === 'dice_break') {
          const br = doRollBreakDice();
          data.roll = br.break;
          data.breakInfo = br.breakInfo;
          wallBreak = br.breakInfo;
          message = window.MahjongDice
            ? MahjongDice.describeBreakRoll(br.breakInfo)
            : ('色子 ' + br.break.sum + ' 点');
        }
        if (step === 'shuffle') doShuffleAndDeal();
        if (step === 'deal') doDealTiles();
        if (step === 'dealer') {
          data.dealerName = players[dealer].name;
          data.breakInfo = wallBreak;
          message = players[dealer].name + ' 坐庄';
        }
        if (cfg && cfg.label && step !== 'dice_wall' && step !== 'dice_break' && step !== 'dealer') {
          message = cfg.label;
        }
        notify();
      },
      onComplete: () => {
        flowStep = null;
        message = players[dealer].name + ' 坐庄，请出牌';
        beginTurn();
      },
    });
  }

  function doRollWallDice() {
    const roll = window.MahjongDice ? MahjongDice.rollPair() : { d1: 3, d2: 4, sum: 7 };
    diceRoll = { wall: roll, break: null, breakInfo: null };
    return roll;
  }

  function doRollBreakDice() {
    const br = window.MahjongDice ? MahjongDice.rollPair() : { d1: 2, d2: 5, sum: 7 };
    const wallSum = diceRoll && diceRoll.wall ? diceRoll.wall.sum : 7;
    const breakInfo = MahjongWall.calcWallBreak(dealer, wallSum, br.sum);
    diceRoll.break = br;
    diceRoll.breakInfo = breakInfo;
    wallBreak = breakInfo;
    return { break: br, breakInfo };
  }

  function doShuffleAndDeal() {
    const deck = shuffle(createDeck());
    if (!diceRoll || !diceRoll.breakInfo) {
      const wr = diceRoll && diceRoll.wall ? diceRoll.wall : MahjongDice.rollPair();
      const br = MahjongDice.rollPair();
      const breakInfo = MahjongWall.calcWallBreak(dealer, wr.sum, br.sum);
      diceRoll = { wall: wr, break: br, breakInfo };
      wallBreak = breakInfo;
    }
    wall = MahjongWall.createDrawWall(deck, diceRoll.breakInfo);
  }

  function doDealTiles() {
    if (!wall) return;
    wall.skipDun(1);
    let seat = dealer;
    for (let r = 0; r < 3; r++) {
      for (let p = 0; p < 4; p++) {
        for (let t = 0; t < 4; t++) {
          const tile = wall.draw();
          if (tile) players[seat].hand.push(tile);
        }
        seat = (seat + 1) % 4;
      }
    }
    for (let p = 0; p < 4; p++) {
      const tile = wall.draw();
      if (tile) players[(dealer + p) % 4].hand.push(tile);
    }
    players.forEach((p) => { p.hand = sortHand(p.hand); });
  }

  function wallCount() {
    return wall ? wall.remaining() : 0;
  }

  function drawFromWall() {
    return wall ? wall.draw() : null;
  }

  function drawFromTail() {
    return wall ? wall.drawFromTail() : null;
  }

  function beginTurn() {
    let aiExtra = null;
    try {
      if (!wall || wallCount() === 0) { endDraw(); return; }
      const tile = drawFromWall();
      if (!tile) { endDraw(); return; }
      const p = players[current];
      p.hand.push(tile);
      p.hand = sortHand(p.hand);
      drawnTile = p.isHuman ? tile : null;
      if (p.isHuman) {
        phase = 'discard';
        buildHumanDiscardActions();
        message = buildDiscardHint().hintText;
        snd('draw');
        snd('your_turn');
      } else {
        message = p.name + ' 思考中…';
        phase = 'ai-discard';
        aiExtra = { aiDiscard: true, delay: aiDiscardDelay(diff) };
      }
    } catch (err) {
      console.error('beginTurn failed', err);
      flowStep = null;
      if (players[current] && players[current].isHuman) {
        phase = 'discard';
        buildHumanDiscardActions();
        message = '请出牌';
      }
    } finally {
      if (!gameOver && phase !== 'end') notify(aiExtra || {});
    }
  }

  function splitDisplayHand() {
    const p = players[0];
    if (!drawnTile || current !== 0) {
      return { hand: p.hand.slice(), drawn: null };
    }
    return {
      hand: p.hand.filter((t) => t !== drawnTile),
      drawn: drawnTile,
    };
  }

  function buildDiscardHint() {
    const p = players[0];
    const { hand, drawn } = splitDisplayHand();
    const full = drawn ? hand.concat([drawn]) : hand.slice();
    const suggested = suggestDiscard(full, p.melds);
    const name = tileLabel(suggested);
    if (pendingAction) {
      return { suggested, hintText: '请确认操作：' + pendingAction.label };
    }
    if (actionButtons.some((b) => b.type === 'zimo')) {
      return { suggested, hintText: '可先点「自摸胡」，或选一张牌再点「打出」' };
    }
    if (selectedTile) {
      const selName = tileLabel(selectedTile);
      return { suggested, hintText: '已选中【' + selName + '】→ 点下方「打出」确认（建议打【' + name + '】）' };
    }
    return {
      suggested,
      hintText: '① 请先点击要打出的牌（建议【' + name + '】）→ ② 再点「打出」',
    };
  }

  function buildClaimHint(tile) {
    if (pendingAction) {
      return '请确认：' + pendingAction.label + '？点「确认」执行，或「取消」';
    }
    const labels = actionButtons.map((b) => b.label.replace(/^(胡|碰|杠|吃)\s*/, '$1'));
    if (labels.length) {
      return '对方打出【' + tileLabel(tile) + '】→ 请选择：' + labels.join(' / ') + ' / 过';
    }
    return '';
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
    snd(isZimo ? 'zimo' : 'hu', { fan, isZimo });
    notify();
  }

  function afterDiscard(seat, tile) {
    players[seat].discards.push(tile);
    lastDiscard = tile;
    lastDiscardFrom = seat;
    drawnTile = null;
    selectedTile = null;
    pendingAction = null;
    phase = 'claim';
    message = players[seat].name + ' 打出 ' + tileLabel(tile);
    snd('discard', { tileLabel: tileLabel(tile) });

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
      message = buildClaimHint(tile);
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
      snd('peng');
      afterMeldNeedDiscard();
      return;
    }
    if (action === 'gang') {
      addMeld(seat, 'gang', [tile, tile, tile, tile], tile);
      current = seat;
      snd('gang');
      drawGangBonus();
      return;
    }
    if (action === 'chi' && combo) {
      addMeld(seat, 'chi', combo, tile);
      current = seat;
      message = p.name + ' 吃！';
      snd('chi');
      afterMeldNeedDiscard();
      return;
    }
  }

  function drawGangBonus() {
    const p = players[current];
    const gd = MahjongDice.rollPair();
    lastGangDice = gd;
    message = p.name + ' 杠！掷色子补牌 ' + gd.d1 + '+' + gd.d2 + '=' + gd.sum;
    snd('gang_dice', { roll: gd });
    if (wall && wallCount() > 0) {
      const t = drawFromTail();
      if (t) {
        p.hand.push(t);
        p.hand = sortHand(p.hand);
        drawnTile = p.isHuman ? t : null;
      }
    }
    afterMeldNeedDiscard();
  }

  function afterMeldNeedDiscard() {
    const p = players[current];
    if (p.isHuman) {
      phase = 'discard';
      selectedTile = null;
      pendingAction = null;
      buildHumanDiscardActions();
      const hint = buildDiscardHint();
      message = hint.hintText;
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
    if (current !== 0 || phase !== 'discard') return false;
    if (!tile) return false;
    const p = players[0];
    const res = removeTilesFrom(p.hand, [tile]);
    if (!res.ok) return false;
    p.hand = res.hand;
    selectedTile = null;
    pendingAction = null;
    actionButtons = [];
    drawnTile = null;
    afterDiscard(0, tile);
    return true;
  }

  function humanPass() {
    if (phase !== 'human-claim') return;
    pendingAction = null;
    actionButtons = [];
    snd('pass');
    nextTurn();
  }

  function requestAction(btn) {
    pendingAction = btn;
    notify();
  }

  function cancelPendingAction() {
    pendingAction = null;
    notify();
  }

  function confirmPendingAction() {
    if (!pendingAction) return;
    const btn = pendingAction;
    pendingAction = null;
    executeHumanAction(btn);
  }

  function executeHumanAction(btn) {
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
      snd('peng');
      afterMeldNeedDiscard();
      return;
    }
    if (btn.type === 'gang') {
      addMeld(0, 'gang', [btn.tile, btn.tile, btn.tile, btn.tile], btn.tile);
      current = 0;
      snd('gang');
      drawGangBonus();
      return;
    }
    if (btn.type === 'chi' && btn.combo) {
      addMeld(0, 'chi', btn.combo, btn.tile);
      current = 0;
      message = '你吃了！请出牌';
      snd('chi');
      afterMeldNeedDiscard();
      return;
    }
    if (btn.type === 'angang') {
      const t = btn.tile;
      addMeld(0, 'angang', [t, t, t, t], t);
      current = 0;
      snd('angang');
      drawGangBonus();
      return;
    }
    if (btn.type === 'bugang') {
      const peng = players[0].melds.find((m) => m.type === 'peng' && m.claimed && m.claimed.id === btn.tile.id);
      if (peng) {
        peng.type = 'gang';
        peng.tiles.push(btn.tile);
        players[0].hand = removeTilesFrom(players[0].hand, [btn.tile]).hand;
        snd('bugang');
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
    snd('liuju');
    notify();
  }

  function newRound() {
    if (winner >= 0) dealer = winner;
    else dealer = (dealer + 1) % 4;
    round++;
    start();
  }

  function getState() {
    let suggestedDiscard = null;
    let hintText = message;
    const display = splitDisplayHand();
    if (current === 0 && phase === 'discard' && !gameOver) {
      const hint = buildDiscardHint();
      suggestedDiscard = hint.suggested;
      hintText = hint.hintText;
    } else if (phase === 'human-claim' && lastDiscard) {
      hintText = buildClaimHint(lastDiscard);
    }
    return {
      players: players.map((p) => ({
        seat: p.seat,
        isHuman: p.isHuman,
        name: p.name,
        handCount: p.hand.length,
        melds: p.melds,
        discards: p.discards,
      })),
      humanHand: display.hand,
      drawnTile: display.drawn,
      wallCount: wallCount(),
      current,
      dealer,
      phase,
      message: hintText,
      hintText,
      suggestedDiscard,
      lastDiscard,
      lastDiscardFrom,
      selectedTile,
      pendingAction,
      actionButtons,
      scores,
      sessionStartScores,
      roundStartScores,
      round,
      winner,
      winInfo,
      gameOver,
      flowStep,
      diceRoll,
      wallBreak,
      lastGangDice,
      difficulty: diff,
    };
  }

  function selectTile(tile) {
    if (phase !== 'discard' || current !== 0 || pendingAction) return;
    selectedTile = (selectedTile === tile) ? null : tile;
    if (selectedTile) snd('select');
    notify();
  }

  function confirmDiscard() {
    if (!selectedTile) return false;
    return humanDiscard(selectedTile);
  }

  function onUpdate(fn) { listener = fn; }

  phase = 'ready';

  return {
    getState, onUpdate, start, selectTile, confirmDiscard, humanDiscard, humanPass,
    requestAction, confirmPendingAction, cancelPendingAction,
    aiDiscard, newRound,
  };
}

window.MahjongGame = { createGame };
})();
