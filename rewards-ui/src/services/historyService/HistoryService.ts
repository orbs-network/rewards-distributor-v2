import Web3 from "web3";
import {IHistoryService} from "./IHistoryService";
import {HistoryDownloader} from "rewards-v2/dist/src";
import {EventHistory} from "rewards-v2/dist/src/history";

const ORBS_CONTRACT_DEPLOYMENT_BLOCK = 5710114;
const ORBS_FIRST_TRANSACTION_BLOCK = 7437000;
const genesisBlockNumber = ORBS_FIRST_TRANSACTION_BLOCK; // ethereum block number earlier than when Orbs PoS contracts deployed
const mainNetCommitteeAddress = '0x550f66F3248aa594376638277F0290D462C9Df9E';
const mainNetDelegationAddress = '0x6333c9549095651fCc8252345d6898208eBE8aaa';
const mainNetStakingRewardsAddress = '0x87ed2d308D30EE8c170627aCdc54d6d75CaB6bDc';

export class HistoryService implements IHistoryService {
    private historyDownloader: HistoryDownloader;

    constructor(private web3: Web3) {
        // Empty downloader (no address)
        this.historyDownloader = new HistoryDownloader('', genesisBlockNumber, true);
    }

    public setAddress(address: string) {
        this.historyDownloader = new HistoryDownloader(address, genesisBlockNumber, true);
    }

    public async processNextBatch(latestEthereumBlock: number) : Promise<{lastProcessedBlock: number, eventHistory: EventHistory}> {
        const numBlocksPerBatch = 1000;
        const lastProcessedBlock = await this.historyDownloader.processNextBatch(numBlocksPerBatch, latestEthereumBlock);
        return {
            lastProcessedBlock,
            eventHistory: this.historyDownloader.history,
        }
    }

    public async downloadHistoryForAddress(address: string): Promise<void> {
        const latestEthereumBlock = await this.web3.eth.getBlockNumber();
        const historyDownloader = new HistoryDownloader(address, genesisBlockNumber, true);

        historyDownloader.setEthereumContracts(this.web3, {
            Committee: mainNetCommitteeAddress,
            Delegations: mainNetDelegationAddress,
            StakingRewards: mainNetStakingRewardsAddress,
        });

        const numBlocksPerBatch = 1000;

        let maxProcessedBlock = 0;

        while (maxProcessedBlock < latestEthereumBlock) {
            maxProcessedBlock = await historyDownloader.processNextBatch(numBlocksPerBatch, latestEthereumBlock);
            console.log(`Done ${maxProcessedBlock} / ${latestEthereumBlock}`);
            console.log(historyDownloader.history);
        }

        // present the historic data
        console.log(historyDownloader.history);
    }
}