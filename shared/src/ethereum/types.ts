import { Contracts } from '@orbs-network/orbs-ethereum-contracts-v2/release/typings/contracts';

export type ContractName = 'contractRegistry' | 'delegations' | 'rewards';

// TODO: this type is needed just for getting the abi from orbs-ethereum-contracts-v2/compiledContracts[contractType]
// once we have a nicer mechanism for abi, it should be indexed by ContractName and this type should be retired
export type ContractTypeName = keyof Contracts;
export function getContractTypeName(key: ContractName): ContractTypeName {
  switch (key) {
    case 'contractRegistry':
      return 'ContractRegistry';
    case 'delegations':
      return 'Delegations';
    case 'rewards':
      return 'Rewards';
    default:
      throw new Error(`unknown contract name '${key}'`);
  }
}

export type EventName =
  | 'ContractAddressUpdated'
  | 'DelegatedStakeChanged'
  | 'StakingRewardsAssigned'
  | 'StakingRewardsDistributed';

export const eventNames: Readonly<Array<EventName>> = [
  'ContractAddressUpdated',
  'DelegatedStakeChanged',
  'StakingRewardsAssigned',
  'StakingRewardsDistributed',
];

export function contractByEventName(eventName: EventName): ContractName {
  switch (eventName) {
    case 'ContractAddressUpdated':
      return 'contractRegistry';
    case 'DelegatedStakeChanged':
      return 'delegations';
    case 'StakingRewardsAssigned':
      return 'rewards';
    case 'StakingRewardsDistributed':
      return 'rewards';
    default:
      throw new Error(`unknown event name '${eventName}'`);
  }
}

export type EventFilter = { [key: string]: number | string };
