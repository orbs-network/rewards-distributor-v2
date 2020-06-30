declare module 'orbs-signer-client' {
  import { TransactionConfig, SignedTransaction } from 'web3-core';

  export default class Signer {
    public constructor(host: string);
    sign(transaction: TransactionConfig): Promise<SignedTransaction>;
  }
}
