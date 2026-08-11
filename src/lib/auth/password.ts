import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Hash/verify de senha com Argon2id (substitui o armazenamento de senha do
 * Supabase Auth). Parâmetros recomendados pela OWASP para Argon2id.
 */

const OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export function verifyPassword(
  digest: string,
  password: string,
): Promise<boolean> {
  return verify(digest, password, OPTS);
}
