import type { Dictionary } from "./en";

/** Textes français du site : mêmes clés que l'anglais (vérifié par le type). */
export const fr: Dictionary = {
  meta: {
    title: "BATTLE LAUNCH",
    description:
      "Deux memecoins Pump.fun lancés à la même seconde, sur le même thème, qui s'affrontent en direct pendant 1, 3 ou 6 heures.",
  },
  nav: {
    battles: "Battles",
    docs: "Règles et FAQ",
    language: "Langue",
    devnet: "Devnet",
  },
  auth: {
    wallet: {
      "no-wallet": "Connecter un wallet",
      connecting: "Connexion…",
      "has-wallet": "Connecter un wallet",
      "copy-address": "Copier l'adresse",
      copied: "Copiée",
      "change-wallet": "Changer de wallet",
      disconnect: "Déconnecter",
    },
    signIn: "Se connecter",
    signOut: "Se déconnecter",
    checkWallet: "Regarde ton wallet…",
    failed: "Connexion refusée ou annulée.",
    statement: "Connexion à BATTLE LAUNCH. Simple signature : aucune transaction, aucun frais.",
  },
  hero: {
    kicker: "Arène de memecoins",
    title: "Deux coins. Un thème. Un gagnant.",
    subtitle:
      "Les deux tokens sont lancés sur Pump.fun à la même seconde, avec le même achat initial. Ensuite le marché tranche, en direct, pendant 1, 3 ou 6 heures.",
    ctaDocs: "Comment le score est calculé",
  },
  home: {
    live: "En direct",
    upcoming: "Bientôt",
    results: "Derniers résultats",
    emptyLive: "Aucune battle en direct pour le moment.",
    emptyUpcoming: "Aucune battle programmée pour le moment.",
    emptyResults: "Aucune battle terminée pour le moment.",
    loading: "Chargement des battles…",
    unavailable: "Impossible de charger les battles pour le moment.",
  },
  battle: {
    vs: "VS",
    status: {
      draft: "Brouillon",
      lobby: "Lobby",
      launching: "Lancement",
      live: "En direct",
      closing: "Clôture",
      finished: "Terminée",
      cancelled: "Annulée",
    },
    startsIn: "Départ dans",
    endsIn: "Fin dans",
    winner: "Gagnant",
    draw: "Match nul",
    duration: "Battle de {h} h",
    holders: "holders",
    volume: "volume",
  },
  footer: {
    risk: "Les memecoins sont extrêmement risqués : on peut tout perdre. Aucune promesse de gain. Pas un conseil financier.",
    nonCustodial:
      "Non-custodial : nous ne détenons jamais vos fonds ni vos clés. Tout est signé dans votre wallet.",
  },
  docs: {
    title: "Règles, score et FAQ",
    intro:
      "Tout ce qui désigne un gagnant est public et peut être recalculé par n'importe qui depuis le snapshot de la battle.",
    risk: {
      title: "À lire d'abord : les risques",
      items: [
        "Les memecoins sont extrêmement volatils. La plupart perdent presque toute leur valeur. Vous pouvez perdre tout ce que vous y mettez.",
        "Gagner une battle ne dit rien du prix futur d'un token. Un gagnant peut s'effondrer quelques minutes après.",
        "Rien sur ce site n'est un conseil financier et rien ici ne promet un gain.",
        "Il n'y a aucun pari entre utilisateurs. Vous achetez ou vendez seulement les tokens eux-mêmes, à vos risques.",
        "Le site est non-custodial : il ne détient jamais vos fonds ni vos clés. Chaque transaction est signée dans votre wallet.",
      ],
    },
    how: {
      title: "Déroulement d'une battle",
      steps: [
        "Une battle a deux camps, A et B, sur un thème (par exemple Chat contre Chien), une durée (1, 3 ou 6 heures) et une heure de départ.",
        "Lobby (5 à 15 minutes) : compte à rebours, et chaque créateur pré-signe la création de son token avec le même achat initial.",
        "Lancement : les deux créations partent ensemble. La battle démarre quand les deux sont confirmées sur la chaîne ; seuls les trades suivants comptent.",
        "Direct : market cap, volume, holders uniques et nombre d'achats de chaque camp sont lus sur la chaîne et mis à jour en direct.",
        "Clôture : à la fin, les stats sont figées, le gagnant est calculé et un snapshot est publié avec son hash SHA-256.",
      ],
    },
    score: {
      title: "La formule du score (version 1)",
      intro:
        "Chaque critère devient la part du camp A dans le total : A / (A + B). Le camp B a le reste. Les deux scores font toujours 100 %.",
      criteria: [
        "Volume : SOL échangés par les participants comptés, chacun plafonné à 5 SOL.",
        "Holders : participants qui gardent un solde net positif acheté pendant la battle.",
        "Market cap : moyenne pondérée par le temps sur les 5 dernières minutes, pour qu'un pump de dernière seconde ne décide pas.",
        "Achats : nombre d'achats, plafonné à 20 par participant.",
      ],
      composite:
        "Mode composite (par défaut) : 35 % volume + 35 % holders + 20 % market cap + 10 % achats. Une battle peut aussi se jouer sur un seul critère.",
      ties: "Égalité : le plus gros volume gagne, puis le plus de holders, puis la plus grosse market cap ; sinon match nul.",
      integers:
        "Tous les calculs se font en nombres entiers (lamports et millionièmes) : le résultat est identique sur toutes les machines.",
    },
    antiCheat: {
      title: "Anti-triche",
      items: [
        "Les créateurs, et les wallets dont les premiers SOL viennent d'un créateur, sont exclus des deux camps.",
        "Trois wallets ou plus financés par la même source comptent comme un seul participant (un holder, un plafond). Les plateformes d'échange ne comptent pas comme source.",
        "Un achat suivi d'une vente (ou l'inverse) du même participant en moins de 120 secondes est un aller-retour : aucun des deux ne compte dans le volume ni dans les achats.",
        "Le volume et les achats sont plafonnés par participant : une seule baleine ne peut pas porter un camp.",
        "Chaque wallet exclu ou regroupé est publié avec la raison.",
      ],
    },
    verify: {
      title: "Vérifier un résultat",
      body: "À la fin d'une battle, le snapshot (paramètres, chaque trade compté, liens de financement, résultat) est publié en JSON canonique avec son hash SHA-256. Refaire le calcul à partir de lui avec la formule publique doit donner le même gagnant et le même hash.",
    },
    faq: {
      title: "FAQ",
      items: [
        {
          q: "Est-ce que je parie contre d'autres utilisateurs ?",
          a: "Non. Il n'y a ni pari ni cagnotte. Vous pouvez seulement acheter ou vendre les deux tokens sur Pump.fun.",
        },
        {
          q: "Que gagne le gagnant ?",
          a: "De la visibilité : un badge, une place « À la une » et au Hall of Fame, et une annonce sur nos canaux. Pas d'argent.",
        },
        {
          q: "Pourquoi le devnet ?",
          a: "Le site est construit et testé sur le devnet de Solana, avec des SOL de test sans valeur. Rien ne tourne encore sur mainnet.",
        },
        {
          q: "Un créateur peut-il truquer son camp ?",
          a: "Les créateurs et les wallets qu'ils financent sont exclus du score, et les groupes de wallets, allers-retours et baleines sont neutralisés. Voir Anti-triche.",
        },
      ],
    },
  },
};
