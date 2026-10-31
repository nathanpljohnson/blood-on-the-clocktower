# Review: bugs, storyteller-proofing, UI cleanup

Found by reading the full source, a click fuzzer, a game-playing bot (44 full games, all 11 scripts)
and 16 targeted rule scenarios. Harness lives outside the repo (session scratchpad).

## Bugs
- [x] Phone QR button shows during setup (CSS beats `hidden`); clicking it throws and half-breaks rendering
- [x] Dreamer on the Drunk shows the Townsfolk they think they are; on the Lunatic shows a Demon as the "good" option
- [x] Minstrel makes themself drunk; also fires when the executed Minion doesn't die
- [x] Assassin vs Fool: ruling defaults to "They survive" (Assassin kills even if they could not die)
- [x] Philosopher who picks Fortune Teller never gets a red herring
- [x] Klutz + Moonchild both die at night: second pick slips to the following day
- [x] Empath / neighbours count a "seems dead" Zombuul as alive
- [x] "Your call" rulings live only in memory: a reload or sleeping phone silently drops them
- [x] Mid-game character fix can leave no Demon, with no warning
- [x] Duplicate player names accepted silently (breaks phone picker and death history)
- [x] Executing an already-dead player happens with one misclick, no confirmation

## Storyteller-proofing
- [x] End-of-day recap warns when "no execution" ends the game (Vortox, Mayor, Leviathan day 5)
- [x] Vote counts on each nomination; app tracks who is on the block (ties included); one-click "Execute <block>"
- [x] Nominations always recordable, not only when a Virgin/Witch/Golem/Town Crier is in play
- [x] Public town view shows nominations, votes and the block (fields existed but were always empty)

## UI
- [x] Header: 8 equal buttons (3 rows on phones) -> Hide, Undo, QR, plus one "Game" menu
- [x] Cut explanatory filler copy
- [x] Remove dead vote code / duplicate lines

## Review
- Rule scenarios: 15 of 16 pass after fixes (were 3 of 16). Left open on purpose:
  - Flowergirl: the app still can't know if the Demon voted (it records vote totals, not who raised a hand).
  - Barber: the app forbids the Demon swapping themself. Rules wording ("not another Demon") suggests it's allowed; not changed without confirming.
- Game bot: 100 full games across all 11 scripts with misclicks, undos, reloads and mid-game character swaps: 0 errors after fixes.
- Click fuzzer: 0 errors after fixes (was a render crash from the setup QR button).
- Not fixed, design-level: the phone QR link carries every player's character, lightly scrambled. Anyone who decodes the URL sees the whole grimoire. Per-player links would fix it.
