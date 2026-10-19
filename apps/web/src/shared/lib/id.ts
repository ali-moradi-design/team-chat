/** Client-generated id used to dedupe sends (server stores it per author + conversation). */
export function clientId(): string {
  return crypto.randomUUID();
}
