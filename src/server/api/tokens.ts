/** API-Tokens: plc_<zufall>. Gespeichert wird nur der SHA-256-Hash. */
import "server-only";
import { randomToken, sha256 } from "../lib/crypto";

export const TOKEN_PREFIX = "plc_";

export function newApiToken() {
  const token = `${TOKEN_PREFIX}${randomToken(32)}`;
  return { token, hash: sha256(token), prefix: token.slice(0, 12) };
}
