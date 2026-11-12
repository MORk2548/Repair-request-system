import { getRandomValues, randomUUID } from 'expo-crypto';

// Hermes has no Web Crypto; the ticket form and @repair/api attachPhoto call crypto.randomUUID() as a global
const g = globalThis as { crypto?: Partial<Crypto> };
g.crypto ??= {};
g.crypto.randomUUID ??= randomUUID as Crypto['randomUUID'];
g.crypto.getRandomValues ??= getRandomValues as Crypto['getRandomValues'];
if (typeof crypto.randomUUID !== 'function') throw new Error('crypto.randomUUID is missing');
