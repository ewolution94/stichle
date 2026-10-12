# Stichle

Our own Wizard for the afternoon meeting: say how many tricks you'll take, then take exactly that
many, from a hand of letterpress cards you play by flicking them onto the table. On phones first,
everyone at their own screen beside the call. Live at
[stichle.ewolution.cloud](https://stichle.ewolution.cloud).

- **Set a table, share the link.** A table gets a four-letter code (no vowels, so no code spells a
  word) and a link like `stichle.ewolution.cloud/KXPT`, with a QR code. No accounts: a name and a seal
  are enough, and a reload or a locked phone puts you back in your chair with your hand.
- **Three to six at the table,** in the order play goes round; the host swaps seats, adds bots and
  deals. Anyone past six watches.
- **Wizard's original rules, nothing from the expansions.** 60 cards: 1 to 13 in four suits, the four
  elements in the original's four colours (Feuer red ▲, Wasser blue ●, Erde green ■, Luft yellow ◆;
  the shapes tell them apart without colour), four Wizards (Z) and four Jesters (N). Round *n* deals
  *n* cards; the next card makes trump (a Wizard: the dealer picks; a Jester or the last round: none);
  everyone bids in turn, left of the dealer first; follow suit if you can, Wizards and Jesters always
  go; the first Wizard takes the trick, else the highest trump, else the highest card of the suit led.
  A bid met scores 20 and 10 a trick, a miss costs 10 a trick. 60 ÷ players rounds.
- **Cards you handle.** Your hand is a fan: run a thumb along it and the cards lift; drag one up or
  flick it and it flies to the middle; or tap a card and tap it again. A card you may not play shakes
  and drops back. Hold a card to look at it big: it tilts with the phone (iOS asks once) or the
  finger, and the foil moves with the light. Tricks land askew in front of each seat, the winner's
  card catches the light, and the trick sweeps off to whoever took it.
- **The table at a glance:** the other seats across the top in the order play goes, each with their
  bid as pips that fill as they take tricks (gold when met, red once overshot), their score, the
  dealer's deck and whose move it is; trump in the corner; the score pad a tap away, like the paper
  one, with each round's bid and tricks under the running total.
- **Between rounds** everyone's result, then the next deal once everyone has tapped on (or after
  25 s). At the end: the winner, the scores as lines across the rounds, two awards, and the host deals
  again or goes back to the lobby.
- **A clock per move** if the host wants one (60 or 25 s): when it runs out, the bot moves for you.
  Without it, the bot only steps in for someone who's gone (closed the page for 12 s, or left).
- **The look: Prägung**, letterpress. The cards are cotton paper pressed in four inks with
  guilloche engraving (each number card's has as many lobes as its value); gold foil on the black
  Wizards and the back, silver on the Jesters. The app sits on the card table itself, an ultramarine
  cloth; panels are the cards' paper with their double rule. Bodoni Moda for numbers and headings,
  Geist for the rest. Light only.
- German and English; the cards follow (Z and N, or W and J).

## How it works

- **The rules are a pure state machine** (`server/rules.mjs`): the deal, trump, bids, which cards may
  be played, who takes a trick, the score. No clock, no I/O, JSON-shaped state; tested on its own,
  including whole seeded games for every table size. The bots (`server/bots.mjs`) read the same state:
  they bid from their high cards and trumps and the cards they can't see, and play to meet the bid
  (take cheaply when they need a trick, duck when they don't).
- **The server keeps the game.** Rooms live in memory (`server/game.mjs`): seats, rounds, the score
  pad, the pauses (a finished trick holds the table for 1.6 s), the clock, the bots and the absent. A
  deploy ends running games; a game with no one online for two minutes ends, and an empty room is
  forgotten after half an hour.
- **Hands never leak.** Each stream carries a view built for its page: your own hand, everyone's card
  counts, the trick on the table and the last one, never a finished trick from before (they lie face
  down, as at the table). Watchers see no hand at all. The tests and CI's smoke test check it.
- **SSE down, JSON moves up** (`server/api.mjs`). Each page holds one `EventSource` with two named
  events: `view` (the room as this page may see it) and `react`. Everything else is a small POST with
  the seat's token in `x-stichle-token`.
- **The deck is code** (`src/lib/deck.ts`): every card is drawn as SVG in the page, so its foil
  gradients can follow the tilt and its words follow the language. The engravings and the pressed-ink
  filter are injected once (`defs()`) and the cards `<use>` them. First drawn for the user's review in
  the workspace (`plans/stichle/deck.js` and its contact sheet).
- **The hand** (`src/components/Hand.svelte`) lays out the fan (two rows past about twelve cards),
  finds the card under a finger, and flies a played card to its place in the trick
  (`src/lib/table.ts` has the geometry; `src/lib/flight.svelte.ts` keeps the trick from drawing it
  twice). Moves wait at the control that sent them (Folio's `track()`, `src/lib/waits.ts`); a played
  card flies at once and comes back with a shake if the server refuses it.
- **Seals:** Folio's emblems in their token theme (`<ewo-emblem>`, `<ewo-emblem-maker>`: colours,
  division, charge).
- **Visit counts:** `/_e.js` and `/_e` are forwarded to Census over the shared Docker network
  (`server/census.mjs`), adding only `X-Site: stichle`. Without `STICHLE_CENSUS` (local runs) the
  forwarder answers with an empty beacon and counts nothing.

## Run it

```bash
npm install
npm run dev          # http://localhost:6310, the game server included
npm run check        # svelte-check / TypeScript
npm test             # unit tests: the rules, the bots, the game, avatars, Census (Node 24+)
npm run build && npm start   # production server on :8080 (or --port 6311)
```

## Deploy (NAS)

This mirrors Schätzle, Vollmond, Kritzle and CDNMS:

- `ci.yml` runs the typecheck, the tests and the build, then smoke-tests the production server (page,
  headers, a table with a guest and a bot, the deal, no hand on the big screen's stream, the guest's
  own hand on theirs).
- `docker-publish.yml` gates on `ci.yml`, then pushes `ghcr.io/ewolution94/stichle:latest` for amd64
  and arm64.
- The shared Watchtower picks the image up. A push to `release` is the whole deploy, and it ends any
  game in progress: don't push during the afternoon meeting.
- The NAS runs `deploy/portainer-stack.yml`, on the port the workspace's registry holds for it.
- The stack joins the external Docker network `ewolution`, where Census listens as `census:4901`.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `--port` | `8080` | Listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `STICHLE_CENSUS` | off | Census's ingest origin, `http://census:4901` on the NAS |

## Project layout

```
server/server.mjs         static files + security headers, wires the rest; no dependencies
server/rules.mjs          Wizard's rules as a pure state machine (deal, trump, bids, tricks, score)
server/bots.mjs           the bots' trump, bid and card
server/game.mjs           rooms, seats, rounds, pauses, the clock, bots and the absent, each page's
                          view (no I/O; tested with a fake clock)
server/api.mjs            the game over HTTP: JSON moves, the SSE stream
server/avatar.mjs         a seal's three numbers
server/census.mjs         forwards /_e.js and /_e to Census (visit counts)
src/lib/deck.ts           the deck, drawn as SVG (Prägung)
src/lib/table.ts          where seats and cards sit around the table
src/lib/tilt.ts           a held card tilting with the phone, a finger or the mouse
src/lib/room.svelte.ts    the live room: the stream, reconnects, moves
src/lib/sound.svelte.ts   the sounds, synthesised with Web Audio
src/components/           Home, Join, AvatarMaker, Game → Lobby, Table (SeatChip, Trick, Hand,
                          Inspect, RoundEnd, ScorePad), Final
public/                   the icon, the offline worker
```
