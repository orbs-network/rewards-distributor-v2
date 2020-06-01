import {HistoryService} from "./HistoryService";
import Web3 from "web3";

export interface IServices {
    historyService: HistoryService;
}

export function buildServices(web3: Web3): IServices {
    return {
        historyService: new HistoryService(web3),
    }
}