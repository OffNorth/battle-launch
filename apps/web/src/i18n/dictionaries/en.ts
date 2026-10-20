/**
 * Textes anglais du site. C'est la référence : le français doit avoir exactement les mêmes clés
 * (vérifié par TypeScript grâce au type `Dictionary`).
 * Aucune promesse de gain dans ces textes (règle du projet).
 */
export const en = {
  meta: {
    title: "BATTLE LAUNCH",
    description:
      "Two Pump.fun memecoins launched at the same time, on the same theme, battling live for 1, 3 or 6 hours.",
  },
  nav: {
    battles: "Battles",
    docs: "Rules & FAQ",
    language: "Language",
    devnet: "Devnet",
  },
  auth: {
    wallet: {
      "no-wallet": "Connect wallet",
      connecting: "Connecting…",
      "has-wallet": "Connect wallet",
      "copy-address": "Copy address",
      copied: "Copied",
      "change-wallet": "Change wallet",
      disconnect: "Disconnect",
    },
    signIn: "Sign in",
    signOut: "Sign out",
    checkWallet: "Check your wallet…",
    failed: "Sign-in failed or was cancelled.",
    statement: "Sign in to BATTLE LAUNCH. This is a signature only: no transaction, no fee.",
  },
  hero: {
    kicker: "Memecoin arena",
    title: "Two coins. One theme. One winner.",
    subtitle:
      "Both tokens are launched on Pump.fun at the same second with the same initial buy. Then the market decides, live, for 1, 3 or 6 hours.",
    ctaDocs: "How the score works",
  },
  home: {
    live: "Live now",
    upcoming: "Starting soon",
    results: "Latest results",
    emptyLive: "No battle is live right now.",
    emptyUpcoming: "No battle is scheduled yet.",
    emptyResults: "No battle has finished yet.",
    loading: "Loading battles…",
    unavailable: "Battles cannot be loaded right now.",
  },
  battle: {
    vs: "VS",
    status: {
      draft: "Draft",
      lobby: "Lobby",
      launching: "Launching",
      live: "Live",
      closing: "Closing",
      finished: "Finished",
      cancelled: "Cancelled",
    },
    startsIn: "Starts in",
    endsIn: "Ends in",
    winner: "Winner",
    draw: "Draw",
    duration: "{h} h battle",
    holders: "holders",
    volume: "volume",
  },
  footer: {
    risk: "Memecoins are extremely risky: you can lose everything. No promise of gains. Not financial advice.",
    nonCustodial:
      "Non-custodial: we never hold your funds or keys. Everything is signed in your wallet.",
  },
  docs: {
    title: "Rules, score & FAQ",
    intro:
      "Everything that decides a winner is public and can be recomputed by anyone from the battle snapshot.",
    risk: {
      title: "Read this first: risks",
      items: [
        "Memecoins are extremely volatile. Most lose almost all of their value. You can lose everything you put in.",
        "Winning a battle says nothing about a token's future price. A winner can crash minutes later.",
        "Nothing on this site is financial advice and nothing here promises any gain.",
        "There are no bets between users. You only buy or sell the tokens themselves, at your own risk.",
        "The site is non-custodial: it never holds your funds or your keys. Every transaction is signed in your wallet.",
      ],
    },
    how: {
      title: "How a battle works",
      steps: [
        "A battle has two sides, A and B, on one theme (for example Cat vs Dog), a duration (1, 3 or 6 hours) and a start time.",
        "Lobby (5 to 15 minutes): a countdown, and each creator pre-signs the creation of their token with the same initial buy.",
        "Launch: both creations are sent together. The battle starts when both are confirmed on chain; only trades after that count.",
        "Live: market cap, volume, unique holders and number of buys of each side are read from the chain and updated live.",
        "Close: at the end, the stats are frozen, the winner is computed, and a snapshot with its SHA-256 hash is published.",
      ],
    },
    score: {
      title: "The score formula (version 1)",
      intro:
        "Each criterion is turned into side A's share of the total: A / (A + B). Side B gets the rest. The two scores always add up to 100 %.",
      criteria: [
        "Volume: SOL traded by counted participants, each capped at 5 SOL.",
        "Holders: participants holding a net positive balance bought during the battle.",
        "Market cap: time-weighted average over the last 5 minutes, so a last-second pump does not decide the battle.",
        "Buys: number of buys, each participant capped at 20.",
      ],
      composite:
        "Composite mode (default): 35 % volume + 35 % holders + 20 % market cap + 10 % buys. A battle can also use a single criterion.",
      ties: "Tie: higher volume wins, then more holders, then higher market cap; otherwise it is a draw.",
      integers:
        "All computations use whole numbers (lamports and millionths), so the result is identical on every machine.",
    },
    antiCheat: {
      title: "Anti-cheat",
      items: [
        "Creators, and wallets whose first SOL came from a creator, are excluded from both sides.",
        "Three or more wallets funded by the same source are counted as a single participant (one holder, one cap). Exchanges are ignored as sources.",
        "A buy followed by a sell (or the reverse) by the same participant within 120 seconds is a round trip: neither trade counts toward volume or buys.",
        "Volume and buys are capped per participant, so one whale cannot carry a side.",
        "Every excluded or grouped wallet is published with the reason.",
      ],
    },
    verify: {
      title: "Verify a result",
      body: "At the end of a battle, the snapshot (parameters, every counted trade, funding links, result) is published as canonical JSON with its SHA-256 hash. Recomputing the score from it with the open formula must give the same winner and the same hash.",
    },
    faq: {
      title: "FAQ",
      items: [
        {
          q: "Do I bet against other users?",
          a: "No. There is no betting and no prize pool. You can only buy or sell the two tokens on Pump.fun.",
        },
        {
          q: "What does the winner get?",
          a: "Visibility: a badge, a spot in the Featured section and the Hall of Fame, and an announcement on our channels. No money.",
        },
        {
          q: "Why devnet?",
          a: "The site is being built and tested on Solana devnet, with test SOL that has no value. Nothing runs on mainnet yet.",
        },
        {
          q: "Can a creator rig their own side?",
          a: "Creators and the wallets they fund are excluded from the score, and wallet groups, round trips and whales are neutralised. See Anti-cheat.",
        },
      ],
    },
  },
};

export type Dictionary = typeof en;
