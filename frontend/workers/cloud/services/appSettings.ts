import { AxiosInstance } from 'axios';
import { ServiceBase } from './base';
import { WorkerContext } from '~/@types/app';

export type AppSettingsEntity = { id: string };

export class AppSettingsService extends ServiceBase<AppSettingsEntity> {
    constructor(axios: AxiosInstance, ctx: WorkerContext) {
        super(axios, 'app-settings', ctx);
    }
}
