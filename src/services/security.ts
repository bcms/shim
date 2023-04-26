import type { ShimSecurityObject } from "@cloud/shim/models";

export class SecurityService {
  private ncs: { [nonce: string]: number } = {};

  constructor() {
    setInterval(() => {
      const keys = Object.keys(this.ncs);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (this.ncs[key] && this.ncs[key] < Date.now()) {
          delete this.ncs[key];
        }
      }
    }, 5000);
  }

  letchNonce(nonce: string, ts: number): void {
    if (!this.ncs[nonce]) {
      this.ncs[nonce] = ts + 60000;
    }
  }

  isNonceLatched(nonce: string): boolean {
    return !!this.ncs[nonce];
  }

  enc<Payload>(instanceId: string, payload: Payload): ShimSecurityObject {
    
  };

  dec<Payload>(instanceId: string, obj: SecurityObject): Payload;
}
