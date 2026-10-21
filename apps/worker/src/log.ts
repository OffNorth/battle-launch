/**
 * Journal du worker : une ligne par événement, préfixée par la tâche. Ne jamais y écrire une
 * adresse de connexion, une clé ou une transaction signée complète.
 */
export function log(task: string, message: string): void {
  console.log(`[${new Date().toISOString()}] [${task}] ${message}`);
}
