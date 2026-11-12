jest.mock('expo-crypto', () => ({ randomUUID: () => 'from-expo-crypto', getRandomValues: (a: Uint8Array) => a.fill(7) }));

test('the entry shim gives crypto.randomUUID to code that calls it as a global', () => {
  // Hermes has no crypto global; jest's node does, so remove it to see the shim fill it
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  jest.isolateModules(() => require('../lib/crypto'));
  expect(crypto.randomUUID()).toBe('from-expo-crypto');
  expect([...crypto.getRandomValues(new Uint8Array(2))]).toEqual([7, 7]);
});
