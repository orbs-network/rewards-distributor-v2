// taken from (and tested in) orbs-network/management-service/src/ethereum/event-fetcher.ts

import { EventData } from 'web3-eth-contract';
import { EventName, EventFilter } from './types';
import { EthereumAdapter } from './ethereum-adapter';
import { Contract } from 'web3-eth-contract';

// abstract class all fetchers should extend
export abstract class EventFetcher {
  protected contract?: Contract;
  protected filter?: EventFilter;
  constructor(protected eventName: EventName, protected reader: EthereumAdapter) {}

  // returns true if the address changed, override to add handling logic on change
  setContractAddress(address: string): boolean {
    if (address == this.contract?.options.address) return false;
    this.contract = this.reader.getContractForEvent(this.eventName, address);
    return true;
  }

  setFilter(filter: EventFilter) {
    this.filter = filter;
  }

  // every fetcher instance should override this function
  abstract async fetchBlock(blockNumber: number, latestAllowedBlock: number): Promise<EventData[]>;
}

// the simplest fetcher, yet inefficient, good for testing
export class SingleEventFetcher extends EventFetcher {
  async fetchBlock(blockNumber: number): Promise<EventData[]> {
    const fromBlock = blockNumber;
    const toBlock = blockNumber;
    return this.reader.getPastEvents(this.eventName, { fromBlock, toBlock }, this.contract, this.filter);
  }
}
