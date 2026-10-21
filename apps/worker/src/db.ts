import postgres from "postgres";

/**
 * Connexion à la base avec le compte dédié `battle_worker` (droits limités, voir la migration
 * worker_et_lancement). Les montants (bigint) circulent en chaînes pour ne rien arrondir.
 */
export function createDb(url: string) {
  return postgres(url, {
    ssl: "require",
    max: 5,
    idle_timeout: 30,
    connect_timeout: 15,
    // Les erreurs de connexion ne doivent jamais afficher l'adresse (elle contient le mot de passe).
    onnotice: () => undefined,
  });
}

export type Db = ReturnType<typeof createDb>;
