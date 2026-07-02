/* global MahjongRules, MahjongTiles, MahjongAvatars */
(function () {
'use strict';

const { canHu, scoreHand } = MahjongRules;
const { tileLabel } = MahjongTiles;

const WIND = ['东', '南', '西', '北'];

function meldTypeLabel(type) {
  return { chi: '吃', peng: '碰', gang: '杠', angang: '暗杠' }[type] || type;
}

/** 亮明面子贡献番数（简化） */
function meldsFan(melds) {
  let fan = 0;
  melds.forEach((m) => {
    if (m.type === 'gang' || m.type === 'angang') fan += 1;
    else if (m.type === 'peng') fan += 0;
  });
  return fan;
}

/** 统计四方已打出牌数 */
function totalDiscards(players) {
  return players.reduce((n, p) => n + p.discards.length, 0);
}

function formatProfit(n) {
  if (n > 0) return '+' + n;
  if (n < 0) return String(n);
  return '0';
}

function buildSituation(state) {
  const human = state.players[0];
  const hand = state.humanHand.slice();
  if (state.drawnTile) hand.push(state.drawnTile);

  let currentFan = 0;
  let fanLabel = '—';
  let canWinNow = false;
  let winType = '';

  if (state.phase === 'human-claim' && state.lastDiscard && canHu(state.humanHand, human.melds, state.lastDiscard)) {
    canWinNow = true;
    currentFan = scoreHand(state.humanHand, human.melds, state.lastDiscard, false);
    winType = '点炮胡';
    fanLabel = currentFan + ' 番';
  } else if (canHu(state.humanHand, human.melds, state.drawnTile)) {
    canWinNow = true;
    currentFan = scoreHand(state.humanHand, human.melds, state.drawnTile, true);
    winType = '自摸';
    fanLabel = currentFan + ' 番';
  } else {
    const exposed = meldsFan(human.melds);
    if (human.melds.length > 0) {
      fanLabel = '面子 ' + human.melds.length + ' 组' + (exposed ? ' · 杠+' + exposed + '番' : '');
    } else {
      fanLabel = '尚未成牌';
    }
  }

  const roundProfit = state.scores[0] - (state.roundStartScores ? state.roundStartScores[0] : 0);
  const sessionProfit = state.scores[0] - (state.sessionStartScores ? state.sessionStartScores[0] : 0);

  const meldDesc = human.melds.length
    ? human.melds.map((m) => meldTypeLabel(m.type)).join('、')
    : '无';

  const dealerWind = WIND[state.dealer] || '东';
  const myWind = '东';
  const isDealer = state.dealer === 0;
  const turnName = state.players[state.current] ? state.players[state.current].name : '';

  let phaseDesc = '等待';
  if (state.gameOver) phaseDesc = '本局结束';
  else if (state.phase === 'discard' && state.current === 0) phaseDesc = '轮到您出牌';
  else if (state.phase === 'human-claim') phaseDesc = '可选择吃碰杠胡';
  else if (state.phase === 'discard' || state.phase === 'ai-discard') phaseDesc = turnName + ' 思考中';
  else if (state.phase === 'flow') phaseDesc = state.flowStep ? '准备中…' : '即将开始';
  else if (state.phase === 'playing') phaseDesc = '准备出牌…';

  const lines = [
    '第 ' + state.round + ' 局 · ' + (isDealer ? '您坐庄' : dealerWind + '家坐庄'),
    phaseDesc,
    '牌墙剩余 ' + state.wallCount + ' 张 · 全场已出 ' + totalDiscards(state.players) + ' 张',
  ];

  if (state.lastDiscard && !state.gameOver) {
    lines.push('最新出牌：【' + tileLabel(state.lastDiscard) + '】(' + (state.players[state.lastDiscardFrom] || {}).name + ')');
  }
  if (state.wallBreak) {
    const b = state.wallBreak;
    lines.push('起抓：' + b.wallSeatName + '家墙第' + b.stackFromRight + '墩（色子' + b.wallSum + '+' + b.breakSum + '）');
  } else if (state.diceRoll && state.diceRoll.wall) {
    const w = state.diceRoll.wall;
    lines.push('定墙色子：' + w.d1 + '+' + w.d2 + '=' + w.sum + '点');
    if (state.diceRoll.break) {
      const b = state.diceRoll.break;
      lines.push('定墩色子：' + b.d1 + '+' + b.d2 + '=' + b.sum + '点');
    }
  }
  if (state.lastGangDice) {
    const g = state.lastGangDice;
    lines.push('最近杠补色子：' + g.d1 + '+' + g.d2 + '=' + g.sum + '点（牌尾补牌）');
  }

  return {
    currentFan,
    fanLabel,
    canWinNow,
    winType,
    roundProfit,
    sessionProfit,
    score: state.scores[0],
    meldCount: human.melds.length,
    meldDesc,
    discardCount: human.discards.length,
    totalTableDiscards: totalDiscards(state.players),
    phaseDesc,
    situationLines: lines,
    isDealer,
  };
}

function buildPlayerCard(seat, state) {
  const p = state.players[seat];
  const isHuman = p.isHuman;
  const avatar = isHuman ? MahjongAvatars.loadPlayerAvatar() : MahjongAvatars.getAiCharacter(seat);
  const char = isHuman ? null : MahjongAvatars.getAiCharacter(seat);
  const roundP = state.scores[seat] - (state.roundStartScores ? state.roundStartScores[seat] : 0);
  const sessionP = state.scores[seat] - (state.sessionStartScores ? state.sessionStartScores[seat] : 0);

  let actionText = '';
  let justDiscarded = false;
  if (!isHuman && !state.gameOver) {
    if (state.current === seat) {
      actionText = (state.phase === 'ai-discard' || state.phase === 'discard') ? '正在出牌…' : '等待反应…';
    } else if (state.lastDiscardFrom === seat && state.lastDiscard) {
      actionText = '打出【' + tileLabel(state.lastDiscard) + '】';
      justDiscarded = true;
    } else {
      actionText = '等待中';
    }
  }

  return {
    seat,
    isHuman,
    isDealer: state.dealer === seat,
    isTurn: state.current === seat && !state.gameOver,
    name: isHuman ? MahjongAvatars.loadPlayerName() : (char ? char.name.split('·')[1] || char.name : p.name),
    fullName: MahjongAvatars.getSeatDisplayName(seat, isHuman),
    emoji: avatar.emoji,
    bg: avatar.bg,
    title: isHuman ? '玩家' : char.title,
    tip: isHuman ? '您的专属头像' : char.tip,
    score: state.scores[seat],
    roundProfit: roundP,
    sessionProfit: sessionP,
    handCount: p.handCount,
    melds: p.melds.length,
    discards: p.discards.length,
    actionText,
    justDiscarded,
  };
}

window.MahjongStatus = { buildSituation, buildPlayerCard, formatProfit, meldsFan };
})();
