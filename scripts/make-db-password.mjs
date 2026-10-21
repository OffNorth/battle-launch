/**
 * Génère le mot de passe du compte base de données du worker, SANS l'afficher :
 * - le mot de passe en clair est écrit dans le fichier local indiqué (ignoré par Git) ;
 * - seule son empreinte SCRAM-SHA-256 (format Postgres) est écrite dans le second fichier,
 *   pour être donnée à la base. L'empreinte ne permet pas de retrouver le mot de passe.
 *
 * Usage : node scripts/make-db-password.mjs <fichier-mot-de-passe> <fichier-empreinte>
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const [secretFile, verifierFile] = process.argv.slice(2);
if (!secretFile || !verifierFile)
  throw new Error("usage : make-db-password.mjs <secret> <empreinte>");

// 32 octets aléatoires, en base64url (aucun caractère à échapper dans une URL de connexion).
const password = randomBytes(32).toString("base64url");
const salt = randomBytes(16);
const iterations = 4096;
const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const clientKey = createHmac("sha256", salted).update("Client Key").digest();
const storedKey = createHash("sha256").update(clientKey).digest();
const serverKey = createHmac("sha256", salted).update("Server Key").digest();
const verifier = `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;

writeFileSync(secretFile, password, { mode: 0o600 });
writeFileSync(verifierFile, verifier);
console.log("mot de passe et empreinte écrits (le mot de passe n'est pas affiché)");
