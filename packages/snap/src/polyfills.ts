// Polyfills for SES compatibility in MetaMask Snaps
if (typeof (globalThis as any).FinalizationRegistry === 'undefined') {
  (globalThis as any).FinalizationRegistry = class {
    register() {}
    unregister() {}
  };
}

if (typeof (globalThis as any).WeakRef === 'undefined') {
  (globalThis as any).WeakRef = class WeakRef {
    private target: any;
    constructor(target: any) {
      this.target = target;
    }
    deref() {
      return this.target;
    }
  };
}

if (typeof (globalThis as any).CryptoKey === 'undefined') {
  (globalThis as any).CryptoKey = class CryptoKey {};
}
