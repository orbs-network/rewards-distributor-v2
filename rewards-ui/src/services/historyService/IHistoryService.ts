import {EventHistory} from "rewards-v2/dist/src/history";

export interface IHistoryService {
    downloadHistoryForAddress: (address: string) => void;
    processNextBatch(latestEthereumBlock: number) : Promise<{lastProcessedBlock: number, eventHistory: EventHistory}>;
}