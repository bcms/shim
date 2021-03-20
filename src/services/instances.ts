import * as crypto from 'crypto';

export interface ShimInstanceServicePrototype {
  createSecret(instanceId: string): string;
  getSecret(instanceId: string): string;
}

function shimInstanceService() {
  const secrets: {
    [instanceId: string]: {
      secret: string;
    };
  } = {};

  const self: ShimInstanceServicePrototype = {
    createSecret(instanceId) {
      secrets[instanceId] = {
        secret: crypto.randomBytes(32).toString('base64'),
      };
      return secrets[instanceId].secret;
    },
    getSecret(instanceId) {
      if (secrets[instanceId]) {
        return secrets[instanceId].secret;
      }
    },
  };
  return self;
}

export const ShimInstanceService = shimInstanceService();
