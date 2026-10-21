/**
 * Message « Sign In With Solana » (même grammaire qu'EIP-4361), dans l'ordre exact du standard :
 * domaine, adresse, phrase, puis URI, Version, Chain ID, Issued At. Phantom vérifie cet ordre et
 * refuse un message mal rangé (« invalid formatting »).
 */
export type SignInFields = {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  issuedAt: string;
  chainId?: string;
};

export function signInMessage(f: SignInFields): string {
  if (/[\r\n]/.test(f.statement)) throw new Error("la phrase doit tenir sur une ligne");
  return [
    `${f.domain} wants you to sign in with your Solana account:`,
    f.address,
    "",
    f.statement,
    "",
    `URI: ${f.uri}`,
    "Version: 1",
    ...(f.chainId ? [`Chain ID: ${f.chainId}`] : []),
    `Issued At: ${f.issuedAt}`,
  ].join("\n");
}
