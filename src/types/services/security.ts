export interface SecurityObject {
  /** Encryption index */
  ei: number;
  /** Signature index */
  si: number;
  /** Initial vector index */
  ivi: number;
  msg: string;
}

export interface SecurityObjectMessage<T> {
  /** Message payload */
  pl: T;
  /** Message nonce */
  nc: string;
  /** Message timestamp */
  ts: number;
  /** Message signature */
  sig: string;
}

export interface SecurityService {
  init(): Promise<void>;
  letchNonce(nonce: string, ts: number): void;
  isNonceLatched(nonce: string, ts: number): boolean;
  enc<T>(instanceId: string, payload: T): SecurityObject;
  dec<T>(instanceId: string, obj: SecurityObject): T;
}
