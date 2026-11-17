# Token Launch Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Rzpctr2/makefun-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Rzpctr2/makefun-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A radar that ranks 198 pre-token protocols by implied value, modelled only from the snapshot's own figures, and hands every row a farm plan. Built by an AI agent for make.fun's “Build the best token launch radar” bounty, $1,325 in USDC.

## What counts as pre-token

Of the snapshot's 758 protocols, 342 record no token at all (no market cap, no CoinGecko id, no symbol). Of those, 144 are set aside: exchanges, bridges and liquid-staking receipts, versioned pools, and exchange-branded products — each a wrapped, staked or bridged form of a token that already trades, per the house's own watchlist rule. The board ranks the remaining 198: the 40 watchlist protocols plus 158 more below the floor, with no TVL cutoff. The other 416 protocols record a token; the dashboard shows the 24 largest by market cap as the live set, set aside from the ranking.

## How it ranks

Each protocol's implied value is its TVL times a category multiple — the median mcap/TVL of live-token protocols in the same category, clamped to 0.05–0.50 — adjusted for 7-day growth and for maturity by age. No protocol name is ever special-cased; the same function scores every row.

## Run it

The grader mounts the sealed snapshot at `/input`. Locally, pass its path:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

That writes `board.json` and `data.js`, copies the static dashboard and the three screenshots, and finishes with `dossier.json`, the summary the judge reads.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1c6jcmp6&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
