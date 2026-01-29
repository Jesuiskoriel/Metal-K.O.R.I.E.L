require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;

const LADDER_CHANNEL_NAME = 'ladder';
const MATCH_CATEGORY_NAME = 'Matchs Ladder';
const DATA_PATH = path.join(__dirname, 'data.json');
const PLAYERS_CSV_PATH = path.join(__dirname, 'ladder_players.csv');
const TEAMS_CSV_PATH = path.join(__dirname, 'ladder_teams.csv');
const README_USER_PATH = path.join(__dirname, 'README_USER.md');
const MAIN_GUILD_ID = '1199795989310091344';
const STARTING_ELO = 1000;
const K_BO3 = 32;
const K_BO5 = 40;

const SINS = ['pride', 'greed', 'lust', 'envy', 'gluttony', 'wrath', 'sloth'];
const STAGES = [
  'Battlefield',
  'Small Battlefield',
  'Hollow Bastion',
  'Smashville',
  'Pokemon Stadium 2',
  'Town and City',
  'Kalos Pokemon League',
  'Final Destination',
  "Yoshi's Story"
];
const FIGHTERS = [
  'Mario',
  'Donkey Kong',
  'Link',
  'Samus',
  'Dark Samus',
  'Yoshi',
  'Kirby',
  'Fox',
  'Pikachu',
  'Luigi',
  'Ness',
  'Captain Falcon',
  'Jigglypuff',
  'Peach',
  'Daisy',
  'Bowser',
  'Ice Climbers',
  'Sheik',
  'Zelda',
  'Dr. Mario',
  'Pichu',
  'Falco',
  'Marth',
  'Lucina',
  'Young Link',
  'Ganondorf',
  'Mewtwo',
  'Roy',
  'Chrom',
  'Mr. Game & Watch',
  'Meta Knight',
  'Pit',
  'Dark Pit',
  'Zero Suit Samus',
  'Wario',
  'Snake',
  'Ike',
  'Pokémon Trainer',
  'Diddy Kong',
  'Lucas',
  'Sonic',
  'King Dedede',
  'Olimar',
  'Lucario',
  'R.O.B.',
  'Toon Link',
  'Wolf',
  'Villager',
  'Mega Man',
  'Wii Fit Trainer',
  'Rosalina & Luma',
  'Little Mac',
  'Greninja',
  'Mii Brawler',
  'Mii Swordfighter',
  'Mii Gunner',
  'Palutena',
  'Pac-Man',
  'Robin',
  'Shulk',
  'Bowser Jr.',
  'Duck Hunt',
  'Ryu',
  'Ken',
  'Cloud',
  'Corrin',
  'Bayonetta',
  'Inkling',
  'Ridley',
  'Simon',
  'Richter',
  'King K. Rool',
  'Isabelle',
  'Incineroar',
  'Piranha Plant',
  'Joker',
  'Hero',
  'Banjo & Kazooie',
  'Terry',
  'Byleth',
  'Min Min',
  'Steve',
  'Sephiroth',
  'Pyra/Mythra',
  'Kazuya',
  'Sora'
];

const LADDER_RULES = [
  '**Règles ladder (MVP)**',
  `- Format des sets : BO3 ou BO5 (accord obligatoire).`,
  `- Elo de départ : ${STARTING_ELO}.`,
  `- K-factor : BO3 = ${K_BO3}, BO5 = ${K_BO5}.`,
  `- Stages : ${STAGES.join(', ')}.`,
  `- RPS : gagnant ban 3 → perdant ban 4 → gagnant choisit entre 2.`,
  `- Chaque game est reportée (les 2 joueurs doivent confirmer).`,
  `- Entre les games : perdant ban 4 → gagnant pick direct.`,
  `- Gentleman : accord des 2 joueurs pour choisir un stage direct (sans bans).`,
  `- Random map : disponible au moment du pick.`,
  `- Annulation : les 2 joueurs doivent valider.`
].join('\n');

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    return { users: {}, guilds: {}, queues: {}, matches: {} };
  }
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    const queues = data.queues || {};
    if (!data.queues && Array.isArray(data.queue)) {
      queues[MAIN_GUILD_ID] = data.queue;
    }
    return {
      users: data.users || {},
      guilds: data.guilds || {},
      queues,
      matches: data.matches || {}
    };
  } catch {
    return { users: {}, guilds: {}, queues: {}, matches: {} };
  }
}

function saveData() {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  exportCsv();
}

let data = loadData();

function getUser(userId) {
  if (!data.users[userId]) {
    data.users[userId] = { camp: null, points: STARTING_ELO, wins: 0, losses: 0 };
  }
  if (typeof data.users[userId].points !== 'number') {
    data.users[userId].points = STARTING_ELO;
  }
  return data.users[userId];
}

function getGuildUser(guildId, userId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = { users: {} };
  if (!data.guilds[guildId].users[userId]) {
    data.guilds[guildId].users[userId] = { points: STARTING_ELO, wins: 0, losses: 0 };
  }
  if (typeof data.guilds[guildId].users[userId].points !== 'number') {
    data.guilds[guildId].users[userId].points = STARTING_ELO;
  }
  return data.guilds[guildId].users[userId];
}

function getQueue(guildId) {
  if (!data.queues[guildId]) data.queues[guildId] = [];
  return data.queues[guildId];
}

function isInMatch(userId) {
  return Object.values(data.matches).some((m) => m.players.includes(userId) && m.status === 'open');
}

async function ensureMatchCategory(guild) {
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === MATCH_CATEGORY_NAME
  );
  if (!category) {
    category = await guild.channels.create({
      name: MATCH_CATEGORY_NAME,
      type: ChannelType.GuildCategory
    });
  }
  return category;
}

async function createMatchChannel(guild, playerA, playerB) {
  const category = await ensureMatchCategory(guild);
  const channel = await guild.channels.create({
    name: `match-${playerA.username}-vs-${playerB.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: playerA.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      },
      {
        id: playerB.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }
    ]
  });
  return channel;
}

function formatUserLine(userId, stats) {
  const campLabel = stats.camp ? formatSinLabel(stats.camp) : 'Sans équipe';
  const name = stats.username || userId;
  return `${name} — ${stats.points} pts (${stats.wins}W/${stats.losses}L) [${campLabel}]`;
}

function buildTopEmbed(title, lines, top1AvatarUrl) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setColor(0xe74c3c);
  if (top1AvatarUrl) embed.setThumbnail(top1AvatarUrl);
  return embed;
}

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getHelpText() {
  try {
    return fs.readFileSync(README_USER_PATH, 'utf8').trim();
  } catch {
    return 'Aide indisponible pour le moment.';
  }
}

async function sendLongMessage(channel, text) {
  const maxLen = 1900;
  const lines = text.split('\n');
  let chunk = '';
  let lastSent = null;
  for (const line of lines) {
    if ((chunk + '\n' + line).length > maxLen) {
      if (chunk && chunk !== lastSent) {
        await channel.send(chunk);
        lastSent = chunk;
      }
      chunk = line;
    } else {
      chunk = chunk ? `${chunk}\n${line}` : line;
    }
  }
  if (chunk && chunk !== lastSent) await channel.send(chunk);
}

function exportCsv() {
  const userEntries = Object.entries(data.users || {});
  const playersHeader = ['user_id', 'pseudo', 'equipe', 'points', 'wins', 'losses'];
  const playerLines = [playersHeader.join(',')];

  userEntries.forEach(([userId, stats]) => {
    const team = stats.camp ? formatSinLabel(stats.camp) : '';
    playerLines.push(
      [
        userId,
        stats.username || '',
        team,
        stats.points ?? '',
        stats.wins ?? 0,
        stats.losses ?? 0
      ].map(csvEscape).join(',')
    );
  });

  fs.writeFileSync(PLAYERS_CSV_PATH, playerLines.join('\n'));

  const teamTotals = {};
  userEntries.forEach(([, stats]) => {
    if (!stats.camp) return;
    const team = formatSinLabel(stats.camp);
    teamTotals[team] = (teamTotals[team] || 0) + (stats.points || 0);
  });

  const teamsHeader = ['equipe', 'points_total'];
  const teamLines = [teamsHeader.join(',')];
  Object.entries(teamTotals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([team, total]) => {
      teamLines.push([team, total].map(csvEscape).join(','));
    });

  fs.writeFileSync(TEAMS_CSV_PATH, teamLines.join('\n'));
}

function formatSinLabel(sin) {
  return sin.charAt(0).toUpperCase() + sin.slice(1);
}

async function setUserCampAndRole(member, sin) {
  if (member.guild.id !== MAIN_GUILD_ID) {
    return { ok: false, error: 'Les équipes sont uniquement actives sur le serveur principal.' };
  }
  const role = member.guild.roles.cache.find((r) => r.name.toLowerCase() === sin);
  if (!role) {
    return { ok: false, error: `Le rôle "${formatSinLabel(sin)}" est introuvable. Crée-le d'abord.` };
  }

  const user = getUser(member.id);
  user.camp = sin;
  saveData();

  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role).catch(() => {});
  }

  return { ok: true };
}

function calcK(bo) {
  return bo === 'bo5' ? K_BO5 : K_BO3;
}

function applyElo(winner, loser, bo) {
  const k = calcK(bo);
  const ratingDiff = loser.points - winner.points;
  const expectedWinner = 1 / (1 + Math.pow(10, ratingDiff / 400));
  const expectedLoser = 1 - expectedWinner;
  const upsetFactor = Math.min(2, Math.max(0.5, 1 + ratingDiff / 400));
  winner.points = Math.round(winner.points + k * upsetFactor * (1 - expectedWinner));
  loser.points = Math.round(loser.points + k * upsetFactor * (0 - expectedLoser));
}

function getRequiredWins(bo) {
  return bo === 'bo5' ? 3 : 2;
}

function initSet(match) {
  if (match.set) return;
  const [a, b] = match.players;
  match.set = {
    bo: match.bo || 'bo3',
    game: 1,
    wins: { [a]: 0, [b]: 0 },
    requiredWins: getRequiredWins(match.bo || 'bo3'),
    reports: {},
    reportPromptedFor: 0
  };
  saveData();
}

function buildFindRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('find_match').setLabel('Trouver un match').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('leave_queue').setLabel('Quitter la file').setStyle(ButtonStyle.Secondary)
  );
}

function buildTeamSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('team_select')
    .setPlaceholder('Choisis ton équipe')
    .addOptions(
      SINS.map((sin) => ({
        label: formatSinLabel(sin),
        value: sin
      }))
    );
  return new ActionRowBuilder().addComponents(select);
}

function buildReportMenu(playerA, playerB) {
  const reportSelect = new StringSelectMenuBuilder()
    .setCustomId('report_select')
    .setPlaceholder('Reporter le résultat')
    .addOptions([
      { label: `Gagnant: ${playerA.username} (bo3)`, value: `${playerA.id}|bo3` },
      { label: `Gagnant: ${playerA.username} (bo5)`, value: `${playerA.id}|bo5` },
      { label: `Gagnant: ${playerB.username} (bo3)`, value: `${playerB.id}|bo3` },
      { label: `Gagnant: ${playerB.username} (bo5)`, value: `${playerB.id}|bo5` }
    ]);

  const reportRow = new ActionRowBuilder().addComponents(reportSelect);
  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cancel_match').setLabel('Annuler le match').setStyle(ButtonStyle.Danger)
  );

  return { reportRow, cancelRow };
}

function buildGameReportMenu(playerA, playerB, gameNum) {
  const reportSelect = new StringSelectMenuBuilder()
    .setCustomId('game_report')
    .setPlaceholder(`Gagnant de la game ${gameNum}`)
    .addOptions([
      { label: `Gagnant: ${playerA.username}`, value: playerA.id },
      { label: `Gagnant: ${playerB.username}`, value: playerB.id }
    ]);

  return new ActionRowBuilder().addComponents(reportSelect);
}

async function postReportControls(channel, match) {
  if (match.reportPosted) return;
  const [a, b] = match.players;
  const memberA = await channel.guild.members.fetch(a);
  const memberB = await channel.guild.members.fetch(b);
  const { reportRow, cancelRow } = buildReportMenu(memberA.user, memberB.user);
  await channel.send({
    content: 'Quand c’est fini, reporte le résultat :',
    components: [reportRow, cancelRow]
  });
  match.reportPosted = true;
  saveData();
}

function buildBoRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bo3').setLabel('BO3').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bo5').setLabel('BO5').setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('gentleman')
      .setLabel('Gentleman (direct map, sans bans)')
      .setStyle(ButtonStyle.Secondary)
  );
}

function encodeStageId(stage) {
  return stage.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function buildStageButtons(remaining, prefix) {
  const rows = [];
  let current = new ActionRowBuilder();
  let count = 0;

  remaining.forEach((stage) => {
    const id = `${prefix}:${encodeStageId(stage)}`;
    const btn = new ButtonBuilder().setCustomId(id).setLabel(stage).setStyle(ButtonStyle.Secondary);
    if (count === 5) {
      rows.push(current);
      current = new ActionRowBuilder();
      count = 0;
    }
    current.addComponents(btn);
    count += 1;
  });
  if (count > 0) rows.push(current);
  return rows;
}

function buildRandomRow(customId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel('Random map').setStyle(ButtonStyle.Secondary)
  );
}

function buildRpsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rps_rock').setLabel('Pierre').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rps_paper').setLabel('Feuille').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rps_scissors').setLabel('Ciseaux').setStyle(ButtonStyle.Secondary)
  );
}

function buildCharacterSelectRows() {
  const rows = [];
  const pageSize = 25;
  const pages = Math.ceil(FIGHTERS.length / pageSize);
  for (let i = 0; i < pages; i += 1) {
    const slice = FIGHTERS.slice(i * pageSize, (i + 1) * pageSize);
    const select = new StringSelectMenuBuilder()
      .setCustomId(`char_page_${i + 1}`)
      .setPlaceholder(`Choisis ton perso (page ${i + 1}/${pages})`)
      .addOptions(slice.map((name) => ({ label: name, value: name })));
    rows.push(new ActionRowBuilder().addComponents(select));
  }
  return rows;
}

async function postBoChoiceStart(channel, match) {
  match.boVotes = {};
  match.boCooldown = {};
  match.gentlemanVotes = {};
  match.bo = null;
  saveData();
  await channel.send({
    content:
      'Choisissez le format du set : BO3 ou BO5. Les deux joueurs doivent être d’accord.\n' +
      'Gentleman = aller direct sur le stage sans se faire chier avec les bans (accord des 2 joueurs).',
    components: [buildBoRow()]
  });
}

async function postStageFlowStart(channel, match) {
  match.stageState = {
    phase: 'rps',
    rps: {},
    rpsWinner: null,
    rpsLoser: null,
    remaining: [...STAGES],
    banNeed: 0,
    banSelected: [],
    stageIdMap: {}
  };
  saveData();
  await channel.send({
    content: `RPS : <@${match.players[0]}> <@${match.players[1]}> choisissez Pierre/Feuille/Ciseaux.`,
    components: [buildRpsRow()]
  });
}

async function promptCharacterSelect(channel, match, pending, payload = {}) {
  initSet(match);
  match.charSelect = {
    game: match.set.game,
    pending,
    payload,
    selections: {}
  };
  saveData();
  await channel.send({
    content: `Sélection des personnages (game ${match.set.game}). Les 2 joueurs doivent choisir.`,
    components: buildCharacterSelectRows()
  });
}

async function promptBan(channel, match, playerId, count) {
  if (match.stageState.remaining.length < count) {
    await channel.send('Erreur: pas assez de stages pour continuer les bans.');
    return;
  }
  match.stageState.banNeed = count;
  match.stageState.banSelected = [];
  match.stageState.stageIdMap = {};
  match.stageState.remaining.forEach((s) => {
    match.stageState.stageIdMap[encodeStageId(s)] = s;
  });
  saveData();
  const rows = buildStageButtons(match.stageState.remaining, 'ban_stage');
  await channel.send({
    content: `<@${playerId}> bannis ${count} stage(s).`,
    components: rows
  });
}

async function promptWinnerChoose(channel, match, playerId) {
  match.stageState.stageIdMap = {};
  match.stageState.remaining.forEach((s) => {
    match.stageState.stageIdMap[encodeStageId(s)] = s;
  });
  saveData();
  const rows = buildStageButtons(match.stageState.remaining, 'winner_pick');
  const randomRow = match.stageState.remaining.length === 2 ? buildRandomRow('random_pick') : null;
  await channel.send({
    content: `<@${playerId}> choisis le stage final parmi les 2 (ou Random).`,
    components: randomRow ? [...rows, randomRow] : rows
  });
}

async function promptWinnerPickPostgame(channel, match, playerId) {
  match.stageState.stageIdMap = {};
  match.stageState.remaining.forEach((s) => {
    match.stageState.stageIdMap[encodeStageId(s)] = s;
  });
  saveData();
  const rows = buildStageButtons(match.stageState.remaining, 'winner_pick');
  const randomRow = match.stageState.remaining.length === 2 ? buildRandomRow('random_pick') : null;
  await channel.send({
    content: `<@${playerId}> choisis le stage pour la prochaine game.`,
    components: randomRow ? [...rows, randomRow] : rows
  });
}

async function promptPick(channel, match, playerId) {
  match.stageState.stageIdMap = {};
  match.stageState.remaining.forEach((s) => {
    match.stageState.stageIdMap[encodeStageId(s)] = s;
  });
  saveData();
  const rows = buildStageButtons(match.stageState.remaining, 'pick_stage');
  const randomRow = match.stageState.remaining.length === 2 ? buildRandomRow('random_pick') : null;
  await channel.send({
    content: `<@${playerId}> choisis le stage parmi les ${match.stageState.remaining.length} restants.`,
    components: randomRow ? [...rows, randomRow] : rows
  });
}

async function promptGentlemanPick(channel, match) {
  match.stageState = {
    phase: 'gentleman_pick',
    p1: null,
    p2: null,
    remaining: [...STAGES],
    banNeed: 0,
    banSelected: [],
    stageIdMap: {}
  };
  match.stageState.remaining.forEach((s) => {
    match.stageState.stageIdMap[encodeStageId(s)] = s;
  });
  saveData();
  const rows = buildStageButtons(match.stageState.remaining, 'gentle_pick');
  const randomRow = match.stageState.remaining.length === 2 ? buildRandomRow('random_gentle') : null;
  await channel.send({
    content: `Gentleman activé : <@${match.players[0]}> <@${match.players[1]}> choisissez directement le stage (sans bans).`,
    components: randomRow ? [...rows, randomRow] : rows
  });
}

async function promptGameReport(channel, match) {
  initSet(match);
  if (match.set.reportPromptedFor === match.set.game) return;
  const [a, b] = match.players;
  const memberA = await channel.guild.members.fetch(a);
  const memberB = await channel.guild.members.fetch(b);
  const row = buildGameReportMenu(memberA.user, memberB.user, match.set.game);
  await channel.send({
    content: `Reportez le gagnant de la **game ${match.set.game}** (les 2 joueurs doivent confirmer).`,
    components: [row]
  });
  match.set.reportPromptedFor = match.set.game;
  saveData();
}

async function finalizeMatch(channel, match, winnerId, bo) {
  const loserId = match.players.find((id) => id !== winnerId);
  const winner = getUser(winnerId);
  const loser = getUser(loserId);

  applyElo(winner, loser, bo);
  winner.wins += 1;
  loser.losses += 1;

  const guildWinner = getGuildUser(channel.guild.id, winnerId);
  const guildLoser = getGuildUser(channel.guild.id, loserId);
  applyElo(guildWinner, guildLoser, bo);
  guildWinner.wins += 1;
  guildLoser.losses += 1;

  match.status = 'closed';
  saveData();

  await channel.send(
    `Résultat confirmé (${bo}). Gagnant: <@${winnerId}> (Elo ${winner.points}). Perdant: <@${loserId}> (Elo ${loser.points}).`
  );
  await channel.send('Ce salon sera supprimé dans 30 secondes.');

  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 30000);
}

async function finalizeCancel(channel, match) {
  match.status = 'cancelled';
  saveData();
  await channel.send('Match annulé. Ce salon sera supprimé dans 30 secondes.');
  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 30000);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const handledMessages = new Set();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith('!')) return;
  if (handledMessages.has(message.id)) return;
  handledMessages.add(message.id);
  setTimeout(() => handledMessages.delete(message.id), 10000);

  const [command, ...args] = message.content.trim().split(/\s+/);
  const cmd = command.toLowerCase();

  const isLadderChannel = true;
  const match = data.matches[message.channel.id];
  const isMatchChannel = Boolean(match);

  if (cmd === '!help') {
    const help = `**Metal K.O.R.I.E.L — Aide**\n\n${getHelpText()}`;
    await sendLongMessage(message.channel, help);
    return;
  }

  if (!isLadderChannel && !isMatchChannel) {
    return;
  }

  if (cmd === '!ladder') {
    if (!isLadderChannel) return;
    if (message.guild.id !== MAIN_GUILD_ID) {
      await message.channel.send({
        content: `Panel ladder : clique sur “Trouver un match” pour lancer une recherche.\n\n${LADDER_RULES}`,
        components: [buildFindRow()]
      });
      return;
    }
    const user = getUser(message.author.id);
    if (!user.camp) {
      await message.channel.send(
        `Tu n’as pas d’équipe. Choisis-en une avec \`!team <nom>\`.\nÉquipes : ${SINS.map(formatSinLabel).join(', ')}.`
      );
      return;
    }
    await message.channel.send({
      content: `Panel ladder : équipe **${formatSinLabel(user.camp)}** détectée.\nClique sur “Trouver un match” pour lancer une recherche.\n\n${LADDER_RULES}`,
      components: [buildFindRow()]
    });
    return;
  }

  if (cmd === '!killall') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.channel.send('Commande réservée aux admins.');
      return;
    }
    const matchIds = Object.keys(data.matches);
    for (const channelId of matchIds) {
      const ch = message.guild.channels.cache.get(channelId);
      if (ch && ch.guild.id === message.guild.id) {
        await ch.delete().catch(() => {});
      }
    }
    data.matches = Object.fromEntries(
      Object.entries(data.matches).filter(([id]) => {
        const ch = message.guild.channels.cache.get(id);
        return ch && ch.guild.id !== message.guild.id;
      })
    );
    data.queues[message.guild.id] = [];
    saveData();
    await message.channel.send('Tous les matchs ont été stoppés et les salons supprimés.');
    return;
  }

  if (cmd === '!ranking') {
    if (!isLadderChannel) return;
    const entries = Object.entries(data.users);
    if (entries.length === 0) {
      await message.channel.send('Aucune donnée de ladder.');
      return;
    }
    const top = entries
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 10);

    const lines = top.map(([userId, stats], idx) => {
      if (message.guild.id === MAIN_GUILD_ID) {
        return `${idx + 1}. ${formatUserLine(userId, stats)}`;
      }
      const name = stats.username || userId;
      return `${idx + 1}. ${name} — ${stats.points} pts (${stats.wins}W/${stats.losses}L)`;
    });
    let top1AvatarUrl = null;
    try {
      const top1Id = top[0][0];
      const user = await client.users.fetch(top1Id);
      top1AvatarUrl = user.displayAvatarURL({ size: 128 });
    } catch {}
    const embed = buildTopEmbed('Top 10 (Global)', lines, top1AvatarUrl);
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (cmd === '!pr' || cmd === '!personalrank') {
    if (!isLadderChannel) return;
    const entries = Object.entries(data.users);
    if (entries.length === 0) {
      await message.channel.send('Aucune donnée de ladder.');
      return;
    }
    const sorted = entries.sort((a, b) => b[1].points - a[1].points);
    const idx = sorted.findIndex(([userId]) => userId === message.author.id);
    const rank = idx >= 0 ? idx + 1 : sorted.length + 1;
    const user = getUser(message.author.id);
    const name = user.username || message.author.username;
    const camp = message.guild.id === MAIN_GUILD_ID ? ` [${formatSinLabel(user.camp)}]` : '';
    await message.channel.send(
      `**${name}**${camp} — Rang global: **#${rank}** sur **${sorted.length}** joueurs (${user.points} pts).`
    );
    return;
  }

  if (cmd === '!lr' || cmd === '!localrank') {
    if (!isLadderChannel) return;
    getGuildUser(message.guild.id, message.author.id);
    const guild = data.guilds[message.guild.id];
    const entries = guild ? Object.entries(guild.users || {}) : [];
    if (entries.length === 0) {
      await message.channel.send('Aucune donnée de ladder pour ce serveur.');
      return;
    }
    const sorted = entries.sort((a, b) => b[1].points - a[1].points);
    const idx = sorted.findIndex(([userId]) => userId === message.author.id);
    const rank = idx >= 0 ? idx + 1 : sorted.length + 1;
    const user = getUser(message.author.id);
    const name = user.username || message.author.username;
    const local = getGuildUser(message.guild.id, message.author.id);
    await message.channel.send(
      `**${name}** — Rang serveur: **#${rank}** sur **${sorted.length}** joueurs (${local.points} pts).`
    );
    return;
  }

  if (cmd === '!servranking') {
    if (!isLadderChannel) return;
    getGuildUser(message.guild.id, message.author.id);
    const guild = data.guilds[message.guild.id];
    const entries = guild ? Object.entries(guild.users || {}) : [];
    if (entries.length === 0) {
      await message.channel.send('Aucune donnée de ladder pour ce serveur.');
      return;
    }
    const top = entries
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 10);

    const lines = top.map(([userId, stats], idx) => {
      const name = data.users[userId]?.username || userId;
      return `${idx + 1}. ${name} — ${stats.points} pts (${stats.wins}W/${stats.losses}L)`;
    });
    let top1AvatarUrl = null;
    try {
      const top1Id = top[0][0];
      const user = await client.users.fetch(top1Id);
      top1AvatarUrl = user.displayAvatarURL({ size: 128 });
    } catch {}
    const embed = buildTopEmbed('Top 10 (Serveur)', lines, top1AvatarUrl);
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (cmd === '!team' || cmd === '!camp') {
    if (!isLadderChannel) return;
    if (message.guild.id !== MAIN_GUILD_ID) {
      await message.channel.send('Les équipes sont uniquement actives sur le serveur principal.');
      return;
    }
    const sin = (args[0] || '').toLowerCase();
    if (!sin) {
      await message.channel.send({
        content: 'Choisis ton équipe :',
        components: [buildTeamSelectRow()]
      });
      return;
    }
    if (!SINS.includes(sin)) {
      await message.channel.send(`Choisis une équipe valide : ${SINS.map(formatSinLabel).join(', ')}`);
      return;
    }
    const res = await setUserCampAndRole(message.member, sin);
    if (!res.ok) {
      await message.channel.send(res.error);
      return;
    }
    const user = getUser(message.author.id);
    user.username = message.author.username;
    getGuildUser(message.guild.id, message.author.id);
    saveData();
    await message.channel.send({
      content: `Équipe **${formatSinLabel(sin)}** définie pour <@${message.author.id}>. Clique pour trouver un match :`,
      components: [buildFindRow()]
    });
    return;
  }

  if (cmd === '!char') {
    if (!isMatchChannel) return;
    if (!match.charSelect) {
      await message.channel.send('Aucune sélection de personnage en cours.');
      return;
    }
    if (!match.players.includes(message.author.id)) {
      await message.channel.send('Seuls les joueurs du match peuvent choisir.');
      return;
    }
    const query = args.join(' ').trim().toLowerCase();
    if (!query) {
      await message.channel.send('Usage : `!char <nom>`');
      return;
    }
    const hits = FIGHTERS.filter((f) => f.toLowerCase().includes(query));
    if (hits.length === 0) {
      await message.channel.send('Aucun perso trouvé.');
      return;
    }
    if (hits.length > 10) {
      await message.channel.send(`Trop de résultats (${hits.length}). Sois plus précis.`);
      return;
    }
    if (hits.length > 1) {
      await message.channel.send(`Résultats : ${hits.join(', ')}`);
      return;
    }
    const pick = hits[0];
    match.charSelect.selections[message.author.id] = pick;
    saveData();
    await message.channel.send(`Perso choisi : **${pick}**.`);
    const [a, b] = match.players;
    if (match.charSelect.selections[a] && match.charSelect.selections[b]) {
      await message.channel.send(
        `Personnages confirmés : <@${a}> **${match.charSelect.selections[a]}** / <@${b}> **${match.charSelect.selections[b]}**`
      );
      const pending = match.charSelect.pending;
      const payload = match.charSelect.payload || {};
      match.charSelect = null;
      saveData();
      if (pending === 'rps') {
        await postStageFlowStart(message.channel, match);
      } else if (pending === 'gentle') {
        await promptGentlemanPick(message.channel, match);
        await promptGameReport(message.channel, match);
      } else if (pending === 'postgame') {
        match.stageState = {
          phase: 'postgame_ban4',
          rpsWinner: payload.winnerId,
          rpsLoser: payload.loserId,
          remaining: [...STAGES],
          banNeed: 0,
          banSelected: [],
          stageIdMap: {},
          pickWinner: payload.winnerId,
          banPlayer: payload.loserId
        };
        saveData();
        await message.channel.send(
          `Nouvelle game : <@${payload.loserId}> ban 4 stages, puis <@${payload.winnerId}> choisit le stage.`
        );
        await promptBan(message.channel, match, payload.loserId, 4);
      }
    }
    return;
  }

  if (cmd === '!find') {
    if (!isLadderChannel) return;
    const user = getUser(message.author.id);
    user.username = message.author.username;
    getGuildUser(message.guild.id, message.author.id);
    saveData();
    if (message.guild.id === MAIN_GUILD_ID && !user.camp) {
      await message.channel.send('Choisis d’abord une équipe avec `!team <sin>`');
      return;
    }
    if (isInMatch(message.author.id)) {
      await message.channel.send('Tu es déjà dans un match.');
      return;
    }
    const queue = getQueue(message.guild.id);
    if (queue.includes(message.author.id)) {
      await message.channel.send('Tu es déjà dans la file.');
      return;
    }

    const opponentId = queue.find((id) => id !== message.author.id);
    if (!opponentId) {
      queue.push(message.author.id);
      saveData();
      await message.channel.send('Recherche d’un adversaire...');
      return;
    }

    data.queues[message.guild.id] = queue.filter((id) => id !== opponentId);
    saveData();

    const opponent = await message.guild.members.fetch(opponentId);
    const channel = await createMatchChannel(message.guild, message.member, opponent);

    data.matches[channel.id] = {
      players: [message.author.id, opponentId],
      reports: {},
      cancel: {},
      status: 'open'
    };
    saveData();

    await channel.send(`Match trouvé : <@${message.author.id}> vs <@${opponentId}>`);
    await channel.send(LADDER_RULES);
    await postBoChoiceStart(channel, data.matches[channel.id]);

    await message.channel.send(`Match créé : ${channel}`);
    return;
  }

  if (cmd === '!leave') {
    if (!isLadderChannel) return;
    const queue = getQueue(message.guild.id);
    if (!queue.includes(message.author.id)) {
      await message.channel.send('Tu n’es pas dans la file.');
      return;
    }
    data.queues[message.guild.id] = queue.filter((id) => id !== message.author.id);
    saveData();
    await message.channel.send('Tu as quitté la file.');
    return;
  }

  if (cmd === '!report') {
    if (!isMatchChannel) return;
    const mention = message.mentions.users.first();
    const bo = (args[1] || '').toLowerCase();
    if (!mention || !['bo3', 'bo5'].includes(bo)) {
      await message.channel.send('Usage : `!report @gagnant bo3` ou `!report @gagnant bo5`');
      return;
    }
    if (!match.players.includes(message.author.id)) {
      await message.channel.send('Seuls les joueurs du match peuvent reporter.');
      return;
    }
    if (!match.players.includes(mention.id)) {
      await message.channel.send('Le gagnant doit être un des deux joueurs.');
      return;
    }

    match.reports[message.author.id] = { winnerId: mention.id, bo };
    saveData();

    const reports = Object.values(match.reports);
    if (reports.length < 2) {
      await message.channel.send('Report reçu. En attente de l’autre joueur.');
      return;
    }

    const [r1, r2] = reports;
    if (r1.winnerId !== r2.winnerId || r1.bo !== r2.bo) {
      await message.channel.send('Les reports ne correspondent pas. Merci de re‑reporter.');
      return;
    }

    await finalizeMatch(message.channel, match, r1.winnerId, r1.bo);
    return;
  }

  if (cmd === '!cancel') {
    if (!isMatchChannel) return;
    if (!match.players.includes(message.author.id)) {
      await message.channel.send('Seuls les joueurs du match peuvent annuler.');
      return;
    }
    match.cancel[message.author.id] = true;
    saveData();
    const count = Object.keys(match.cancel).length;
    if (count < 2) {
      await message.channel.send('Demande d’annulation reçue. En attente de l’autre joueur.');
      return;
    }
    await finalizeCancel(message.channel, match);
    return;
  }

  if (cmd === '!forcewin') {
    if (!isMatchChannel) return;
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await message.channel.send('Commande réservée aux modérateurs.');
      return;
    }
    const mention = message.mentions.users.first();
    const bo = (args[1] || '').toLowerCase();
    if (!mention || !['bo3', 'bo5'].includes(bo)) {
      await message.channel.send('Usage : `!forcewin @joueur bo3` ou `!forcewin @joueur bo5`');
      return;
    }
    if (!match.players.includes(mention.id)) {
      await message.channel.send('Le gagnant doit être un des deux joueurs.');
      return;
    }
    await finalizeMatch(message.channel, match, mention.id, bo);
    return;
  }

  if (cmd === '!gentleman') {
    if (!isMatchChannel) return;
    const bo = (args[0] || '').toLowerCase();
    if (!['bo3', 'bo5'].includes(bo)) {
      await message.channel.send('Usage : `!gentleman bo3` ou `!gentleman bo5`');
      return;
    }
    if (!match.players.includes(message.author.id)) {
      await message.channel.send('Seuls les joueurs du match peuvent choisir.');
      return;
    }
    if (match.stageState && match.stageState.phase && match.stageState.phase !== 'rps' && match.stageState.phase !== 'gentleman_pick') {
      await message.channel.send('Le gentleman n’est plus possible à ce stade.');
      return;
    }
    match.gentlemanBoVotes = match.gentlemanBoVotes || {};
    match.gentlemanBoVotes[message.author.id] = bo;
    saveData();

    const [a, b] = match.players;
    if (match.gentlemanBoVotes[a] && match.gentlemanBoVotes[b]) {
      if (match.gentlemanBoVotes[a] !== match.gentlemanBoVotes[b]) {
        match.gentlemanBoVotes = {};
        saveData();
        await message.channel.send('Pas d’accord sur le format gentleman. Revotez.');
        return;
      }
      match.bo = match.gentlemanBoVotes[a];
      saveData();
      initSet(match);
      await message.channel.send(`Gentleman accepté : format **${match.bo.toUpperCase()}**.`);
      await postReportControls(message.channel, match);
      await promptCharacterSelect(message.channel, match, 'gentle');
      return;
    }
    await message.channel.send('Gentleman proposé. En attente de l’autre joueur.');
    return;
  }

});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.inGuild()) return;

  const isLadderChannel = true;
  const match = interaction.channel ? data.matches[interaction.channel.id] : null;
  const isMatchChannel = Boolean(match);

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'camp_select') {
      await interaction.reply({
        content: 'Choix d’équipe désactivé ici. Utilise `!team <nom>`.',
        ephemeral: true
      });
      return;
    }

    if (interaction.customId === 'team_select') {
      if (interaction.guild.id !== MAIN_GUILD_ID) {
        await interaction.reply({ content: 'Les équipes sont uniquement actives sur le serveur principal.', ephemeral: true });
        return;
      }
      const sin = interaction.values[0];
      const res = await setUserCampAndRole(interaction.member, sin);
      if (!res.ok) {
        await interaction.reply({ content: res.error, ephemeral: true });
        return;
      }
      const user = getUser(interaction.user.id);
      user.username = interaction.user.username;
      saveData();
      await interaction.reply({
        content: `Équipe **${formatSinLabel(sin)}** définie. Clique pour trouver un match :`,
        components: [buildFindRow()],
        ephemeral: true
      });
      return;
    }

    if (interaction.customId === 'report_select') {
      if (!isMatchChannel) return;
      if (match.status !== 'open') {
        await interaction.reply({ content: 'Ce match est déjà terminé.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent reporter.', ephemeral: true });
        return;
      }
      const [winnerId, bo] = interaction.values[0].split('|');
      if (!match.players.includes(winnerId)) {
        await interaction.reply({ content: 'Le gagnant doit être un des deux joueurs.', ephemeral: true });
        return;
      }
      match.reports[interaction.user.id] = { winnerId, bo };
      saveData();

      const reports = Object.values(match.reports);
      if (reports.length < 2) {
        await interaction.reply({ content: 'Report reçu. En attente de l’autre joueur.', ephemeral: true });
        return;
      }

      const [r1, r2] = reports;
      if (r1.winnerId !== r2.winnerId || r1.bo !== r2.bo) {
        await interaction.reply({ content: 'Les reports ne correspondent pas. Merci de re‑reporter.', ephemeral: true });
        return;
      }

      await finalizeMatch(interaction.channel, match, r1.winnerId, r1.bo);
      await interaction.reply({ content: 'Résultat enregistré.', ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith('char_page_')) {
      if (!isMatchChannel) return;
      if (!match.charSelect) {
        await interaction.reply({ content: 'Aucune sélection de personnage en cours.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent choisir.', ephemeral: true });
        return;
      }
      const pick = interaction.values[0];
      match.charSelect.selections[interaction.user.id] = pick;
      saveData();
      await interaction.reply({ content: `Perso choisi : **${pick}**`, ephemeral: true });
      const [a, b] = match.players;
      if (match.charSelect.selections[a] && match.charSelect.selections[b]) {
        await interaction.channel.send(
          `Personnages confirmés : <@${a}> **${match.charSelect.selections[a]}** / <@${b}> **${match.charSelect.selections[b]}**`
        );
        const pending = match.charSelect.pending;
        const payload = match.charSelect.payload || {};
        match.charSelect = null;
        saveData();
        if (pending === 'rps') {
          await postStageFlowStart(interaction.channel, match);
        } else if (pending === 'gentle') {
          await promptGentlemanPick(interaction.channel, match);
          await promptGameReport(interaction.channel, match);
        } else if (pending === 'postgame') {
          match.stageState = {
            phase: 'postgame_ban4',
            rpsWinner: payload.winnerId,
            rpsLoser: payload.loserId,
            remaining: [...STAGES],
            banNeed: 0,
            banSelected: [],
            stageIdMap: {},
            pickWinner: payload.winnerId,
            banPlayer: payload.loserId
          };
          saveData();
          await interaction.channel.send(
            `Nouvelle game : <@${payload.loserId}> ban 4 stages, puis <@${payload.winnerId}> choisit le stage.`
          );
          await promptBan(interaction.channel, match, payload.loserId, 4);
        }
      }
      return;
    }

    if (interaction.customId === 'game_report') {
      if (!isMatchChannel) return;
      if (match.status !== 'open') {
        await interaction.reply({ content: 'Ce match est déjà terminé.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent reporter.', ephemeral: true });
        return;
      }
      initSet(match);
      const winnerId = interaction.values[0];
      if (!match.players.includes(winnerId)) {
        await interaction.reply({ content: 'Le gagnant doit être un des deux joueurs.', ephemeral: true });
        return;
      }
      match.set.reports[interaction.user.id] = winnerId;
      saveData();

      const reports = Object.values(match.set.reports);
      if (reports.length < 2) {
        await interaction.reply({ content: 'Report reçu. En attente de l’autre joueur.', ephemeral: true });
        return;
      }
      const [r1, r2] = reports;
      if (r1 !== r2) {
        match.set.reports = {};
        saveData();
        await interaction.reply({ content: 'Les reports ne correspondent pas. Merci de re‑reporter.', ephemeral: true });
        return;
      }

      const loserId = match.players.find((id) => id !== r1);
      match.set.wins[r1] = (match.set.wins[r1] || 0) + 1;
      match.set.game += 1;
      match.set.reports = {};
      saveData();

      await interaction.channel.send(
        `Game gagnée par <@${r1}>. Score: <@${match.players[0]}> ${match.set.wins[match.players[0]]} - ${match.set.wins[match.players[1]]} <@${match.players[1]}>.`
      );

      if (match.set.wins[r1] >= match.set.requiredWins) {
        await finalizeMatch(interaction.channel, match, r1, match.set.bo);
        await interaction.reply({ content: 'Set terminé.', ephemeral: true });
        return;
      }

      await promptCharacterSelect(interaction.channel, match, 'postgame', {
        winnerId: r1,
        loserId
      });
      await interaction.reply({ content: 'Prochaine game lancée.', ephemeral: true });
      return;
    }

  }

  if (interaction.isButton()) {
    if (interaction.customId === 'find_match') {
      await interaction.deferReply({ ephemeral: true });
      if (!isLadderChannel) {
        await interaction.editReply({ content: 'Utilise ça dans le salon ladder.' });
        return;
      }
      const user = getUser(interaction.user.id);
      user.username = interaction.user.username;
      getGuildUser(interaction.guild.id, interaction.user.id);
      saveData();
      if (interaction.guild.id === MAIN_GUILD_ID && !user.camp) {
        await interaction.editReply({ content: 'Choisis d’abord une équipe avec `!team` ou le menu.' });
        return;
      }
      if (isInMatch(interaction.user.id)) {
        await interaction.editReply({ content: 'Tu es déjà dans un match.' });
        return;
      }
      const queue = getQueue(interaction.guild.id);
      if (queue.includes(interaction.user.id)) {
        await interaction.editReply({ content: 'Tu es déjà dans la file.' });
        return;
      }

      const opponentId = queue.find((id) => id !== interaction.user.id);
      if (!opponentId) {
        queue.push(interaction.user.id);
        saveData();
        await interaction.editReply({ content: 'Recherche d’un adversaire...' });
        return;
      }

      data.queues[interaction.guild.id] = queue.filter((id) => id !== opponentId);
      saveData();

      const opponent = await interaction.guild.members.fetch(opponentId);
      const channel = await createMatchChannel(interaction.guild, interaction.member, opponent);

      data.matches[channel.id] = {
        players: [interaction.user.id, opponentId],
        reports: {},
        cancel: {},
        status: 'open'
      };
      saveData();

      await channel.send(
        `Match trouvé : <@${interaction.user.id}> vs <@${opponentId}>`
      );
      await channel.send(LADDER_RULES);
      await postBoChoiceStart(channel, data.matches[channel.id]);

      await interaction.editReply({ content: `Match créé : ${channel}` });
      return;
    }

    if (interaction.customId === 'leave_queue') {
      if (!isLadderChannel) {
        await interaction.reply({ content: 'Utilise ça dans le salon ladder.', ephemeral: true });
        return;
      }
      const queue = getQueue(interaction.guild.id);
      if (!queue.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Tu n’es pas dans la file.', ephemeral: true });
        return;
      }
      data.queues[interaction.guild.id] = queue.filter((id) => id !== interaction.user.id);
      saveData();
      await interaction.reply({ content: 'Tu as quitté la file.', ephemeral: true });
    }

    if (interaction.customId === 'cancel_match') {
      if (!isMatchChannel) {
        await interaction.reply({ content: 'Utilise ça dans le salon de match.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent annuler.', ephemeral: true });
        return;
      }
      match.cancel[interaction.user.id] = true;
      saveData();
      const count = Object.keys(match.cancel).length;
      if (count < 2) {
        await interaction.reply({ content: 'Demande d’annulation reçue. En attente de l’autre joueur.', ephemeral: true });
        return;
      }
      await finalizeCancel(interaction.channel, match);
      await interaction.reply({ content: 'Match annulé.', ephemeral: true });
    }

    if (interaction.customId === 'gentleman') {
      if (!isMatchChannel) {
        await interaction.reply({ content: 'Utilise ça dans le salon de match.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent choisir.', ephemeral: true });
        return;
      }
      if (match.stageState && match.stageState.phase && match.stageState.phase !== 'rps' && match.stageState.phase !== 'gentleman_pick') {
        await interaction.reply({ content: 'Le gentleman n’est plus possible à ce stade.', ephemeral: true });
        return;
      }
      match.gentlemanVotes = match.gentlemanVotes || {};
      match.gentlemanVotes[interaction.user.id] = true;
      saveData();

      const [a, b] = match.players;
      if (match.gentlemanVotes[a] && match.gentlemanVotes[b]) {
        await interaction.channel.send('Gentleman accepté : pas de bans, choix direct du stage.');
        initSet(match);
        await postReportControls(interaction.channel, match);
        await promptCharacterSelect(interaction.channel, match, 'gentle');
        await interaction.reply({ content: 'Gentleman confirmé.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Gentleman proposé. En attente de l’autre joueur.', ephemeral: true });
      return;
    }

    if (interaction.customId === 'bo3' || interaction.customId === 'bo5') {
      if (!isMatchChannel) {
        await interaction.reply({ content: 'Utilise ça dans le salon de match.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent choisir.', ephemeral: true });
        return;
      }
      match.boCooldown = match.boCooldown || {};
      const now = Date.now();
      const last = match.boCooldown[interaction.user.id] || 0;
      if (now - last < 5000) {
        await interaction.reply({ content: 'Attends 5 secondes avant de revoter.', ephemeral: true });
        return;
      }
      match.boCooldown[interaction.user.id] = now;
      match.boVotes = match.boVotes || {};
      match.boVotes[interaction.user.id] = interaction.customId;
      saveData();

      const [a, b] = match.players;
      if (match.boVotes[a] && match.boVotes[b]) {
        if (match.boVotes[a] !== match.boVotes[b]) {
          match.boVotes = {};
          saveData();
          await interaction.channel.send('Pas d’accord sur le format. Revotez : BO3 ou BO5.');
          await interaction.reply({ content: 'Vote enregistré, mais pas d’accord.', ephemeral: true });
          return;
        }
        match.bo = match.boVotes[a];
        saveData();
        initSet(match);
        await interaction.channel.send(`Format choisi : **${match.bo.toUpperCase()}**.`);
        await postReportControls(interaction.channel, match);
        if (!match.stageState || match.stageState.phase === 'rps') {
          match.stageState = null;
          saveData();
          await promptCharacterSelect(interaction.channel, match, 'rps');
        }
        await interaction.reply({ content: 'Format confirmé.', ephemeral: true });
        return;
      }

      await interaction.reply({ content: 'Vote enregistré. En attente de l’autre joueur.', ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith('rps_')) {
      if (!isMatchChannel) return;
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent jouer.', ephemeral: true });
        return;
      }
      if (!match.stageState || match.stageState.phase !== 'rps') {
        await interaction.reply({ content: 'Le RPS n’est pas actif.', ephemeral: true });
        return;
      }
      const choice = interaction.customId.replace('rps_', '');
      match.stageState.rps = match.stageState.rps || {};
      match.stageState.rps[interaction.user.id] = choice;
      saveData();

      const [a, b] = match.players;
      if (!match.stageState.rps[a] || !match.stageState.rps[b]) {
        await interaction.reply({ content: 'Choix enregistré. En attente de l’autre joueur.', ephemeral: true });
        return;
      }

      const ca = match.stageState.rps[a];
      const cb = match.stageState.rps[b];
      if (ca === cb) {
        match.stageState.rps = {};
        saveData();
        await interaction.channel.send('Égalité au RPS. Rejouez.');
        await interaction.reply({ content: 'Égalité. Revote.', ephemeral: true });
        return;
      }

      const wins = (x, y) =>
        (x === 'rock' && y === 'scissors') ||
        (x === 'scissors' && y === 'paper') ||
        (x === 'paper' && y === 'rock');

      const winner = wins(ca, cb) ? a : b;
      const loser = winner === a ? b : a;
      match.stageState.rpsWinner = winner;
      match.stageState.rpsLoser = loser;
      match.stageState.phase = 'ban3';
      saveData();

      await interaction.channel.send(`RPS gagné par <@${winner}>. Il ban 3 stages.`);
      await promptBan(interaction.channel, match, winner, 3);
      await interaction.reply({ content: 'RPS terminé.', ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith('ban_stage:')) {
      if (!isMatchChannel) return;
      if (!match.stageState || match.stageState.phase === 'done') {
        await interaction.reply({ content: 'Les bans de stages ne sont pas actifs.', ephemeral: true });
        return;
      }
      const phase = match.stageState.phase;
      if (phase !== 'ban3' && phase !== 'loser_ban4' && phase !== 'postgame_ban4') {
        await interaction.reply({ content: 'Phase de ban invalide.', ephemeral: true });
        return;
      }
      const expected = phase === 'ban3'
        ? match.stageState.rpsWinner
        : phase === 'loser_ban4'
          ? match.stageState.rpsLoser
          : match.stageState.banPlayer;
      if (interaction.user.id !== expected) {
        await interaction.reply({ content: 'Ce n’est pas ton tour de ban.', ephemeral: true });
        return;
      }
      const stageKey = interaction.customId.split(':')[1];
      const stage = match.stageState.stageIdMap[stageKey];
      if (!stage || !match.stageState.remaining.includes(stage)) {
        await interaction.reply({ content: 'Stage invalide.', ephemeral: true });
        return;
      }

      match.stageState.remaining = match.stageState.remaining.filter((s) => s !== stage);
      match.stageState.banSelected.push(stage);
      saveData();

      const left = match.stageState.banNeed - match.stageState.banSelected.length;
      if (left > 0) {
        const rows = buildStageButtons(match.stageState.remaining, 'ban_stage');
        await interaction.update({
          content: `<@${expected}> bannis ${left} stage(s) encore.`,
          components: rows
        });
        return;
      }

      await interaction.update({ content: 'Ban terminé.', components: [] });
      if (phase === 'ban3') {
        match.stageState.phase = 'loser_ban4';
        saveData();
        await promptBan(interaction.channel, match, match.stageState.rpsLoser, 4);
        return;
      }
      if (phase === 'loser_ban4') {
        match.stageState.phase = 'winner_choose';
        saveData();
        await promptWinnerChoose(interaction.channel, match, match.stageState.rpsWinner);
        return;
      }
      match.stageState.phase = 'postgame_pick';
      saveData();
      await promptWinnerPickPostgame(interaction.channel, match, match.stageState.pickWinner);
      return;
    }

    if (interaction.customId.startsWith('pick_stage:')) {
      if (!isMatchChannel) return;
      await interaction.reply({ content: 'Ce format n’utilise pas ce bouton.', ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith('gentle_pick:')) {
      if (!isMatchChannel) return;
      if (!match.stageState || match.stageState.phase !== 'gentleman_pick') {
        await interaction.reply({ content: 'Le gentleman n’est pas actif.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent choisir.', ephemeral: true });
        return;
      }
      const stageKey = interaction.customId.split(':')[1];
      const stage = match.stageState.stageIdMap[stageKey];
      if (!stage || !match.stageState.remaining.includes(stage)) {
        await interaction.reply({ content: 'Stage invalide.', ephemeral: true });
        return;
      }
      match.stageState.phase = 'done';
      match.stageState.picked = stage;
      saveData();
      await interaction.update({ content: 'Stage choisi.', components: [] });
      await interaction.channel.send(`Stage sélectionné (gentleman) : **${stage}**. Bonne chance !`);
      await promptGameReport(interaction.channel, match);
      return;
    }

    if (interaction.customId.startsWith('winner_pick:')) {
      if (!isMatchChannel) return;
      if (!match.stageState || (match.stageState.phase !== 'winner_choose' && match.stageState.phase !== 'postgame_pick')) {
        await interaction.reply({ content: 'Le choix final n’est pas actif.', ephemeral: true });
        return;
      }
      const picker = match.stageState.phase === 'winner_choose'
        ? match.stageState.rpsWinner
        : match.stageState.pickWinner;
      if (interaction.user.id !== picker) {
        await interaction.reply({ content: 'Ce n’est pas ton tour de choisir.', ephemeral: true });
        return;
      }
      const stageKey = interaction.customId.split(':')[1];
      const stage = match.stageState.stageIdMap[stageKey];
      if (!stage || !match.stageState.remaining.includes(stage)) {
        await interaction.reply({ content: 'Stage invalide.', ephemeral: true });
        return;
      }
      match.stageState.phase = 'done';
      match.stageState.picked = stage;
      saveData();
      await interaction.update({ content: 'Stage choisi.', components: [] });
      await interaction.channel.send(`Stage sélectionné : **${stage}**. Bonne chance !`);
      await promptGameReport(interaction.channel, match);
      return;
    }

    if (interaction.customId === 'random_pick') {
      if (!isMatchChannel) return;
      if (!match.stageState || (match.stageState.phase !== 'winner_choose' && match.stageState.phase !== 'postgame_pick')) {
        await interaction.reply({ content: 'Le pick de stage n’est pas actif.', ephemeral: true });
        return;
      }
      const picker = match.stageState.phase === 'winner_choose'
        ? match.stageState.rpsWinner
        : match.stageState.pickWinner;
      if (interaction.user.id !== picker) {
        await interaction.reply({ content: 'Ce n’est pas ton tour de pick.', ephemeral: true });
        return;
      }
      const remaining = match.stageState.remaining;
      const stage = remaining[Math.floor(Math.random() * remaining.length)];
      match.stageState.phase = 'done';
      match.stageState.picked = stage;
      saveData();
      await interaction.update({ content: 'Stage choisi (random).', components: [] });
      await interaction.channel.send(`Stage sélectionné : **${stage}**. Bonne chance !`);
      await promptGameReport(interaction.channel, match);
      return;
    }

    if (interaction.customId === 'random_gentle') {
      if (!isMatchChannel) return;
      if (!match.stageState || match.stageState.phase !== 'gentleman_pick') {
        await interaction.reply({ content: 'Le gentleman n’est pas actif.', ephemeral: true });
        return;
      }
      if (!match.players.includes(interaction.user.id)) {
        await interaction.reply({ content: 'Seuls les joueurs du match peuvent choisir.', ephemeral: true });
        return;
      }
      const remaining = match.stageState.remaining;
      const stage = remaining[Math.floor(Math.random() * remaining.length)];
      match.stageState.phase = 'done';
      match.stageState.picked = stage;
      saveData();
      await interaction.update({ content: 'Stage choisi (random).', components: [] });
      await interaction.channel.send(`Stage sélectionné (gentleman) : **${stage}**. Bonne chance !`);
      await promptGameReport(interaction.channel, match);
      return;
    }
  }
});

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

client.login(TOKEN);
