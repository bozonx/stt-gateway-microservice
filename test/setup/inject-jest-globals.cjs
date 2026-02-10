// Inject jest globals for ESM mode
// In ESM mode with --experimental-vm-modules, jest globals may already be present.
// Only inject if not already declared.
if (typeof globalThis.jest === 'undefined') {
  try {
    const globals = require('@jest/globals')
    globalThis.jest = globals.jest
  } catch {
    // Already available as ESM global
  }
}
