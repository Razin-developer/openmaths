/** PRD "Auth & Security Audit" F12 — bcrypt cost bumped from 10 to 12. Existing password hashes
 * (cost 10) still verify fine (bcrypt.compare reads the cost from the hash itself); only newly
 * created/changed passwords get the higher cost. No forced re-hash migration — that would need
 * the plaintext password, which isn't available after the fact. */
export const BCRYPT_COST = 12;
