import {IServices} from "./Services";
import {useContext} from "react";
import {ServicesContext} from "../state/ServicesState";
import {HistoryService} from "./HistoryService";

export function useServices(): IServices {
    const services = useContext(ServicesContext);

    if (!services) {
        throw new Error('Tried to use services before initialising them');
    }

    return services;
}

export function useHistoryService(): HistoryService {
    return useServices().historyService;
}