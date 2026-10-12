// German and English. The choice lives in Settings (General → Language): System follows the
// browser's languages, Deutsch or English pins one. Stichle speaks German first, whatever the browser
// says, like CDNMS: its players are the German-speaking afternoon meeting. So with nothing saved it's
// Deutsch, and System is saved as the word 'system' under `ewo:lang` (the family's key, whose other
// apps take a missing key as System). public/boot.js applies it before first paint. The cards follow
// the language too: Z and N in German (Zauberer, Narr), W and J in English (src/lib/deck.ts).

export type Lang = 'de' | 'en';
export type LangChoice = Lang | 'system';

const KEY = 'ewo:lang';
/** What a first visit shows. */
const DEFAULT: LangChoice = 'de';

function storedChoice(): LangChoice {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'en' || stored === 'de' || stored === 'system') return stored;
  } catch {
    // storage blocked: the default
  }
  return DEFAULT;
}

/** The first of the browser's languages the game speaks, English otherwise (as public/boot.js). */
export function systemLang(): Lang {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const base = tag?.toLowerCase().slice(0, 2);
    if (base === 'de' || base === 'en') return base;
  }
  return 'en';
}

const choice = storedChoice();
export const i18n = $state({ choice, lang: choice === 'system' ? systemLang() : choice });

/** Stores a choice and shows the page in that language. */
export function setLanguage(next: LangChoice) {
  i18n.choice = next;
  i18n.lang = next === 'system' ? systemLang() : next;
  document.documentElement.lang = i18n.lang;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // not kept
  }
}

const STRINGS = {
  de: {
    code: 'Tischcode',
    settings: 'Einstellungen',
    general: 'Allgemein',
    language: 'Sprache',
    langSystem: 'System',
    allApps: 'Alle Apps',
    home: 'Zur Startseite',
    connecting: 'Verbinde …',
    reconnecting: 'Verbindung wird wiederhergestellt …',
    gone: 'Dieser Tisch ist aufgelöst.',
    close: 'Schließen',
    done: 'Fertig',
    back: 'Zurück',

    whoAreYou: 'Wer spielt?',
    yourName: 'Dein Name',
    namePlaceholder: 'Name',
    newGame: 'Neuer Tisch',
    joinWithCode: 'An einen Tisch mit Code',
    codePlaceholder: 'Code',
    join: 'Hinsetzen',
    play: 'Mitspielen',
    changeAvatar: 'Siegel ändern',

    rules: 'Spielregeln',
    rulesDeck:
      '60 Karten: die Zahlen 1 bis 13 in vier Farben (Feuer, Wasser, Erde, Luft), dazu vier Zauberer (Z) und vier Narren (N). Für 3 bis 6 am Tisch.',
    rulesRound:
      'In Runde 1 bekommt jede eine Karte, in Runde 2 zwei, und so weiter. Die nächste Karte vom Stapel wird aufgedeckt: Ihre Farbe ist Trumpf. Ein Zauberer: der Geber wählt Trumpf. Ein Narr oder die letzte Runde: kein Trumpf. Dann sagt jede reihum an, wie viele Stiche sie machen wird.',
    rulesPlay:
      'Wer ausspielt, gibt die Farbe vor, und die muss bedienen, wer kann. Zauberer und Narren gehen immer. Den Stich bekommt der erste Zauberer, sonst der höchste Trumpf, sonst die höchste Karte der ausgespielten Farbe. Narren gewinnen nie, außer es liegen nur Narren.',
    rulesScore: 'Genau getroffen: 20 Punkte und 10 pro Stich. Daneben: 10 Punkte weniger pro Stich zu viel oder zu wenig.',

    table: 'Tisch',
    copyLink: 'Link kopieren',
    copied: 'Kopiert',
    showQr: 'QR-Code',
    qrLabel: 'QR-Code für {url}',
    atTheTable: 'Am Tisch',
    freeChair: 'Freier Platz',
    orderHint: 'In dieser Reihenfolge geht es reihum. Wer wo sitzt, ändert der Host mit „Plätze tauschen“.',
    watching: 'Schaut zu',
    watch: 'Nur zuschauen',
    sitDown: 'An den Tisch',
    you: 'du',
    host: 'Host',
    bot: 'Bot',
    away: 'weg',
    addBot: 'Bot dazu',
    shuffle: 'Plätze tauschen',
    deal: 'Karten geben',
    leaveGame: 'Tisch verlassen',
    waitHost: 'Warten, bis {name} die Karten gibt …',
    needPlayers: 'Noch {n} mehr am Tisch, dann geht es los (3 bis 6).',
    playerActions: 'Spieler',
    makeWatch: 'Zuschauen lassen',
    makeSit: 'An den Tisch holen',
    kick: 'Vom Tisch schicken',
    removeBot: 'Bot entfernen',
    clock: 'Uhr pro Zug',
    clock_off: 'Aus',
    clockHint: 'Läuft die Uhr ab, zieht der Bot für dich.',
    clockHintOff: 'Ohne Uhr. Wer den Tisch verlässt, für den zieht nach einer Weile der Bot.',
    lengthHint: '{players} am Tisch: {rounds} Runden.',
    lengthNone: '{min} bis {max} Spieler am Tisch.',

    round: 'Runde',
    trump: 'Trumpf',
    trumpIs: 'Trumpf ist {suit}',
    noTrump: 'Kein Trumpf',
    noTrumpShort: 'keiner',
    trumpPending: 'wird gewählt',
    react: 'Reagieren',
    scorePad: 'Spielblock',
    dealer: 'Gibt',
    bidding: 'sagt an …',
    bidWon: '{bid} angesagt, {won} gemacht',
    cardsLeft: '{n} Karten auf der Hand',
    pickTrump: 'Trumpf wählen',
    pickTrumpYou: 'Ein Zauberer liegt oben: Du bestimmst Trumpf.',
    pickTrumpOther: 'Ein Zauberer liegt oben: {name} bestimmt Trumpf …',
    yourBid: 'Wie viele Stiche machst du?',
    bidLess: 'Einen weniger',
    bidMore: 'Einen mehr',
    trickOne: 'Stich',
    trickMany: 'Stiche',
    bidThis: '{n} ansagen',
    bidsSoFar: 'Angesagt: {sum} von {n}',
    bidYou: 'Du sagst an.',
    bidOther: '{name} sagt an …',
    playLead: 'Du spielst aus.',
    playAny: 'Du bist dran: Spiel, was du willst.',
    playFollow: 'Du bist dran: {suit} bedienen.',
    playOther: '{name} ist dran …',
    trickYou: 'Dein Stich!',
    trickOther: 'Der Stich geht an {name}.',
    mustFollow: 'Du musst {suit} bedienen.',
    notYourTurn: 'Du bist noch nicht dran.',
    watchingGame: 'Du schaust zu.',
    tiltHint: 'Neig das Handy oder zieh mit dem Finger',
    roundOf: 'Runde {n}',
    bidTook: '{bid} → {won}',
    nextRound: 'Weiter zu Runde {n}',
    readyWaiting: 'Bereit · {n} von {of}',
    dealsIn: 'Die nächste Runde kommt in {s} s.',
    padKey: 'Oben der Punktestand, darunter angesagt · gemacht.',

    suit_fire: 'Feuer',
    suit_water: 'Wasser',
    suit_earth: 'Erde',
    suit_air: 'Luft',

    youWin: 'Du gewinnst!',
    winnerIs: '{name} gewinnt!',
    winnersAre: '{names} gewinnen!',
    withPoints: '{n} Punkte',
    roundsPlayed: '{n} von {of} Runden',
    noRounds: 'Keine Runde zu Ende gespielt.',
    metOf: '{n}/{of} getroffen',
    chartLabel: 'Die Punkte aller am Tisch, Runde für Runde',
    awardSeer: 'Hellseher',
    awardSeerLine: '{n} von {of} Ansagen getroffen',
    awardTricks: 'Stichsammler',
    awardTricksLine: '{n} Stiche',
    again: 'Nochmal',
    toLobby: 'Zurück zum Tisch',
    waitAgain: 'Warten, ob {name} nochmal gibt …',

    thisGame: 'Diese Partie',
    stopGame: 'Partie beenden',
    endSure: 'Für alle beenden? Es zählt der Stand bis hier.',
    endYes: 'Ja, beenden',
    keepPlaying: 'Weiterspielen',
    leaveSure: 'Wirklich gehen? Für dich spielt dann der Bot weiter.',
    leaveSureHost: 'Wirklich gehen? Für dich spielt der Bot weiter, und jemand anderes wird Host.',
    leaveYes: 'Ja, gehen',
    endHint: '{name}, der Host, kann die Partie beenden.',
    endedBy: 'Von {name} vorzeitig beendet',
    sounds: 'Töne',
    soundsHint: 'Töne auf diesem Gerät',
    cardArt: 'Karten',
    art_figures: 'Figuren',
    art_classic: 'Klassisch',

    wait_create: 'Tisch wird gedeckt …',
    wait_join: 'Setze dich …',
    wait_start: 'Mische …',
    wait_seat: 'Platz …',
    wait_shuffle: 'Tausche Plätze …',
    wait_bot_add: 'Bot setzt sich …',
    wait_bot_remove: 'Bot geht …',
    wait_bid: 'Sage an …',
    wait_trump: 'Wähle Trumpf …',
    wait_next: 'Bereit …',
    wait_stop: 'Beende …',
    wait_rematch: 'Mische neu …',
    wait_leave: 'Gehe …',

    'error:name': 'Bitte gib einen Namen ein.',
    'error:no-room': 'Diesen Tisch gibt es nicht (mehr).',
    'error:room-full': 'Dieser Raum ist voll.',
    'error:table-full': 'Der Tisch ist voll: höchstens sechs.',
    'error:too-few': 'Es braucht mindestens drei am Tisch.',
    'error:too-many': 'Höchstens sechs am Tisch.',
    'error:busy': 'Gerade ist viel los. Versuch es gleich nochmal.',
    'error:offline': 'Der Server ist nicht erreichbar.',
    'error:no-player': 'Du sitzt nicht mehr an diesem Tisch.',
    'error:wrong-phase': 'Gerade nicht.',
    'error:phase': 'Gerade nicht.',
    'error:not-host': 'Das darf nur der Host.',
    'error:turn': 'Du bist nicht dran.',
    'error:not-dealer': 'Trumpf wählt der Geber.',
    'error:follow': 'Du musst die ausgespielte Farbe bedienen.',
    'error:card': 'Diese Karte geht nicht.',
    'error:bid': 'Diese Ansage geht nicht.',
    'error:suit': 'Wähle eine Farbe.',
    'error:wait': 'Einen Moment: der Stich wird noch eingesammelt.',
    'error:other': 'Etwas ist schiefgegangen.',
    'error:timeout': 'Keine Antwort vom Server.',
  },
  en: {
    code: 'Table code',
    settings: 'Settings',
    general: 'General',
    language: 'Language',
    langSystem: 'System',
    allApps: 'All apps',
    home: 'To the start',
    connecting: 'Connecting …',
    reconnecting: 'Reconnecting …',
    gone: 'This table has broken up.',
    close: 'Close',
    done: 'Done',
    back: 'Back',

    whoAreYou: 'Who’s playing?',
    yourName: 'Your name',
    namePlaceholder: 'Name',
    newGame: 'New table',
    joinWithCode: 'Join a table by its code',
    codePlaceholder: 'Code',
    join: 'Sit down',
    play: 'Play',
    changeAvatar: 'Change seal',

    rules: 'How to play',
    rulesDeck:
      '60 cards: 1 to 13 in four suits (Fire, Water, Earth, Air), plus four Wizards (W) and four Jesters (J). For 3 to 6 players.',
    rulesRound:
      'Round 1 deals one card each, round 2 two, and so on. The next card from the deck is turned up: its suit is trump. A Wizard: the dealer picks trump. A Jester or the last round: no trump. Then everyone in turn bids how many tricks they’ll take.',
    rulesPlay:
      'Whoever leads sets the suit, and you must follow it if you can. Wizards and Jesters can always be played. The trick goes to the first Wizard, else the highest trump, else the highest card of the suit led. Jesters never win, unless only Jesters were played.',
    rulesScore: 'Bid met exactly: 20 points plus 10 a trick. Missed: minus 10 for every trick too many or too few.',

    table: 'Table',
    copyLink: 'Copy link',
    copied: 'Copied',
    showQr: 'QR code',
    qrLabel: 'QR code for {url}',
    atTheTable: 'At the table',
    freeChair: 'Free chair',
    orderHint: 'Play goes round in this order. The host changes who sits where with “Swap seats”.',
    watching: 'Watching',
    watch: 'Just watch',
    sitDown: 'Sit down',
    you: 'you',
    host: 'host',
    bot: 'bot',
    away: 'away',
    addBot: 'Add a bot',
    shuffle: 'Swap seats',
    deal: 'Deal',
    leaveGame: 'Leave the table',
    waitHost: 'Waiting for {name} to deal …',
    needPlayers: '{n} more at the table and it starts (3 to 6).',
    playerActions: 'Player',
    makeWatch: 'Let them watch',
    makeSit: 'Bring to the table',
    kick: 'Send away',
    removeBot: 'Remove bot',
    clock: 'Clock per move',
    clock_off: 'Off',
    clockHint: 'When the clock runs out, the bot moves for you.',
    clockHintOff: 'No clock. For anyone who leaves the table, the bot moves after a while.',
    lengthHint: '{players} at the table: {rounds} rounds.',
    lengthNone: '{min} to {max} players at the table.',

    round: 'Round',
    trump: 'Trump',
    trumpIs: '{suit} is trump',
    noTrump: 'No trump',
    noTrumpShort: 'none',
    trumpPending: 'being picked',
    react: 'React',
    scorePad: 'Score pad',
    dealer: 'Deals',
    bidding: 'bidding …',
    bidWon: 'bid {bid}, took {won}',
    cardsLeft: '{n} cards in hand',
    pickTrump: 'Pick trump',
    pickTrumpYou: 'A Wizard is turned up: you pick trump.',
    pickTrumpOther: 'A Wizard is turned up: {name} picks trump …',
    yourBid: 'How many tricks will you take?',
    bidLess: 'One fewer',
    bidMore: 'One more',
    trickOne: 'trick',
    trickMany: 'tricks',
    bidThis: 'Bid {n}',
    bidsSoFar: 'Bid so far: {sum} of {n}',
    bidYou: 'Your bid.',
    bidOther: '{name} is bidding …',
    playLead: 'Your lead.',
    playAny: 'Your move: play anything.',
    playFollow: 'Your move: follow {suit}.',
    playOther: '{name}’s move …',
    trickYou: 'Your trick!',
    trickOther: 'The trick goes to {name}.',
    mustFollow: 'You must follow {suit}.',
    notYourTurn: 'It’s not your move yet.',
    watchingGame: 'You’re watching.',
    tiltHint: 'Tilt the phone or drag a finger',
    roundOf: 'Round {n}',
    bidTook: '{bid} → {won}',
    nextRound: 'On to round {n}',
    readyWaiting: 'Ready · {n} of {of}',
    dealsIn: 'The next round deals in {s} s.',
    padKey: 'The score on top, below it bid · taken.',

    suit_fire: 'Fire',
    suit_water: 'Water',
    suit_earth: 'Earth',
    suit_air: 'Air',

    youWin: 'You win!',
    winnerIs: '{name} wins!',
    winnersAre: '{names} win!',
    withPoints: '{n} points',
    roundsPlayed: '{n} of {of} rounds',
    noRounds: 'No round played to the end.',
    metOf: '{n}/{of} met',
    chartLabel: 'Everyone’s score, round by round',
    awardSeer: 'Seer',
    awardSeerLine: '{n} of {of} bids met',
    awardTricks: 'Trick taker',
    awardTricksLine: '{n} tricks',
    again: 'Again',
    toLobby: 'Back to the table',
    waitAgain: 'Waiting to see if {name} deals again …',

    thisGame: 'This game',
    stopGame: 'End the game',
    endSure: 'End it for everyone? The score so far counts.',
    endYes: 'Yes, end it',
    keepPlaying: 'Keep playing',
    leaveSure: 'Leave for real? The bot plays on for you.',
    leaveSureHost: 'Leave for real? The bot plays on for you, and someone else hosts.',
    leaveYes: 'Yes, leave',
    endHint: '{name}, the host, can end the game.',
    endedBy: 'Ended early by {name}',
    sounds: 'Sounds',
    soundsHint: 'Sounds on this device',
    cardArt: 'Cards',
    art_figures: 'Figures',
    art_classic: 'Classic',

    wait_create: 'Setting the table …',
    wait_join: 'Sitting down …',
    wait_start: 'Shuffling …',
    wait_seat: 'Moving …',
    wait_shuffle: 'Swapping seats …',
    wait_bot_add: 'Bot sits down …',
    wait_bot_remove: 'Bot leaves …',
    wait_bid: 'Bidding …',
    wait_trump: 'Picking trump …',
    wait_next: 'Ready …',
    wait_stop: 'Ending …',
    wait_rematch: 'Shuffling again …',
    wait_leave: 'Leaving …',

    'error:name': 'Please enter a name.',
    'error:no-room': 'This table doesn’t exist (anymore).',
    'error:room-full': 'This room is full.',
    'error:table-full': 'The table is full: six at most.',
    'error:too-few': 'It takes at least three at the table.',
    'error:too-many': 'Six at the table at most.',
    'error:busy': 'Too much going on right now. Try again in a moment.',
    'error:offline': 'Can’t reach the server.',
    'error:no-player': 'You’re no longer at this table.',
    'error:wrong-phase': 'Not right now.',
    'error:phase': 'Not right now.',
    'error:not-host': 'Only the host can do that.',
    'error:turn': 'It’s not your move.',
    'error:not-dealer': 'The dealer picks trump.',
    'error:follow': 'You must follow the suit led.',
    'error:card': 'That card can’t be played.',
    'error:bid': 'That bid isn’t possible.',
    'error:suit': 'Pick a suit.',
    'error:wait': 'One moment: the trick is still being gathered.',
    'error:other': 'Something went wrong.',
    'error:timeout': 'No answer from the server.',
  },
} satisfies Record<Lang, Record<string, string>>;

export type Key = keyof typeof STRINGS.de;

/** A string in the current language, with {name} placeholders filled in. */
export function t(key: Key, vars: Record<string, string | number> = {}): string {
  return STRINGS[i18n.lang][key].replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

/** An error code from the server, in words. */
export function errorText(code: string): string {
  const key = `error:${code}` as Key;
  return key in STRINGS.de ? t(key) : t('error:other');
}

/** A suit's name: "Feuer", "Fire". */
export const suitName = (suit: 'fire' | 'water' | 'earth' | 'air') => t(`suit_${suit}`);

/** A score: a real minus sign below zero, as on a score pad. `signed` adds the plus for a gain. */
export function score(n: number, signed = false) {
  return n < 0 ? `−${Math.abs(n)}` : signed && n > 0 ? `+${n}` : String(n);
}

/** Numbers as people write them here: 1.250 in German, 1,250 in English. */
export function num(n: number) {
  return n.toLocaleString(i18n.lang === 'de' ? 'de-DE' : 'en-GB');
}

/** "Ben und Mia", "Ben and Mia". */
export function names(list: string[]) {
  if (list.length < 2) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${i18n.lang === 'de' ? 'und' : 'and'} ${list.at(-1)}`;
}
