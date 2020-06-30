declare module 'truffle-hdwallet-provider' {
  export default class HDWalletProvider {
    constructor(mnemonic: string, endpoint: string, n1: number, n2: number, b1: boolean);
  }
}
