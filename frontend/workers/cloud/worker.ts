import { CloudService } from './service';
import { WorkerBase } from '~/workers/base';
import { WorkerContext } from '~/@types/app';
import {
    CloudServiceAction,
    GenericActions,
    GoogleCalendarIntegrationAction,
    JiraIntegrationAction,
    ServiceKey,
} from '~/constants';
import { GithubIntegrationAction } from '~/components/github/github';
import { LinearIntegrationActions } from '~/constants/linear';
import { LinearWorkerActions } from '~/workers/cloud/services/linear';

export class CloudWorker extends WorkerBase {
    protected invokeTimeout: number = 20_000;
    protected cloudService!: CloudService;
    protected serviceKey = ServiceKey.CLOUD;

    public constructor() {
        super();
    }

    initialize(ctx: WorkerContext['$config']) {
        const comms = this.getCommsFunctions();
        this.cloudService = new CloudService({
            $config: ctx,
            ...(comms as any),
        });
    }

    protected async handleMessage(
        operation: string,
        payload: any,
        messageId: string,
        service?: ServiceKey,
    ) {
        if (operation === GenericActions.RESPONSE) {
            this.invokeCallbacks[messageId]?.(payload);
            return;
        }

        const response = await this.execute(operation, payload);
        return this.emit(
            service || ServiceKey.CLOUD,
            GenericActions.RESPONSE,
            response ?? {},
            messageId,
        );
    }

    resolveService(entity: string) {
        switch (entity) {
            case 'documents':
                return this.cloudService.Documents;
            case 'events':
                return this.cloudService.Events;
            case 'projects':
                return this.cloudService.Projects;
            case 'taskLists':
                return this.cloudService.TaskLists;
            case 'tasks':
                return this.cloudService.Tasks;
            case 'vaults':
                return this.cloudService.Vaults;
            case 'integrations':
                return this.cloudService.Integrations;
            case 'views':
                return this.cloudService.Views;
            case 'user':
                return this.cloudService.User;
            case 'loader':
                return this.cloudService.Loader;
            case 'versions':
                return this.cloudService.Versions;
            case 'nlp':
                break;
            case 'images':
                return this.cloudService.Images;
            case 'auth':
                break;
            case 'recovery-keys':
                return this.cloudService.RecoveryKeys;
            case 'app-settings':
                return this.cloudService.AppSettings;
        }
        return null;
    }

    async execute(operation: string, payload: any) {
        switch (operation) {
            case CloudServiceAction.INITIALIZE:
                this.initialize(payload.context);
                return {};
            case CloudServiceAction.SET_BASE_URL:
                this.cloudService?.setBaseUrl(
                    payload.baseUrl,
                    payload.selfHostedSync ?? true,
                );
                return {};
            case CloudServiceAction.REFRESH_CREDENTIALS:
                return this.cloudService.refreshCredentials(
                    payload.userId,
                    payload.credentials,
                );
            case CloudServiceAction.CLEAR_CACHE:
                this.cloudService.clearCachedCredentials();
                return {};
            case CloudServiceAction.SET_TIMEZONE:
                return this.cloudService.User.setTimezone(payload.timezone);
            case CloudServiceAction.REFRESH:
                return this.cloudService.Auth.refresh(
                    payload.credentials.accessToken,
                    payload.credentials.refreshToken,
                );
            case CloudServiceAction.IS_ONLINE:
                return true;
            case CloudServiceAction.QUICKADD:
                return this.cloudService.NLP.quickAdd(payload.data, payload.ts);
            case CloudServiceAction.WEBSOCKETS_INITIALIZE:
                return this.cloudService.Websockets.initialize();
            case CloudServiceAction.WEBSOCKETS_REGISTER_NAMESPACE:
                return this.cloudService.Websockets.registerProtocol(
                    payload.vaultId,
                );
            case CloudServiceAction.WEBSOCKETS_DISCONNECT_NAMESPACE:
                return this.cloudService.Websockets.disconnectProtocol(
                    payload.vaultId,
                );
            case JiraIntegrationAction.REFRESH_CREDENTIALS:
                return this.cloudService.JiraIntegration.refreshCredentials(
                    payload.integration,
                );
            case JiraIntegrationAction.INITIALIZE_INTEGRATION:
                return this.cloudService.JiraIntegration.initializeIntegration(
                    payload,
                );
            case JiraIntegrationAction.GET_PROJECTS:
                return this.cloudService.JiraIntegration.getProjects(
                    payload.integration,
                    payload.startAt,
                    payload.maxResults,
                );
            case JiraIntegrationAction.GET_PRIORITIES:
                return this.cloudService.JiraIntegration.getPriorities(
                    payload.integration,
                );
            case JiraIntegrationAction.GET_STATUSES:
                return this.cloudService.JiraIntegration.getStatuses(
                    payload.integration,
                    payload.project,
                );
            case JiraIntegrationAction.GET_MYSELF:
                return this.cloudService.JiraIntegration.getMyself(
                    payload.integration,
                );
            case JiraIntegrationAction.GET_ISSUE:
                return this.cloudService.JiraIntegration.getIssue(
                    payload.integration,
                    payload.key,
                );
            case JiraIntegrationAction.GET_ISSUES:
                return this.cloudService.JiraIntegration.getIssues(
                    payload.integration,
                    payload.jql,
                    payload.startAt,
                    payload.maxResults,
                );
            case JiraIntegrationAction.GET_USERS:
                return this.cloudService.JiraIntegration.getUsers(
                    payload.integration,
                    payload.project,
                    payload.startAt,
                );
            case JiraIntegrationAction.GET_COMMENTS:
                return this.cloudService.JiraIntegration.getComments(
                    payload.integration,
                    payload.issueId,
                    payload.startAt,
                    payload.maxResults,
                );
            case JiraIntegrationAction.SAVE_ISSUE:
                return this.cloudService.JiraIntegration.saveIssue(
                    payload.integration,
                    payload.key,
                    payload.transition,
                    payload.update,
                    payload.fields,
                );
            case JiraIntegrationAction.GET_ATTACHMENT:
                return this.cloudService.JiraIntegration.getAttachment(
                    payload.integration,
                    payload.attachmentId,
                    payload.thumbnail,
                );
            case GoogleCalendarIntegrationAction.GET_EVENTS:
                return this.cloudService.GoogleCalendarIntegration.getEvents(
                    payload.vaultId,
                    payload.integrationId,
                    payload.calendarId,
                    payload.range,
                    payload.syncToken,
                    payload.pageToken,
                );
            case GoogleCalendarIntegrationAction.SAVE_EVENT:
                return this.cloudService.GoogleCalendarIntegration.saveEvent(
                    payload.vaultId,
                    payload.integrationId,
                    payload.calendarId,
                    payload.event,
                );
            case GoogleCalendarIntegrationAction.MOVE_EVENT:
                return this.cloudService.GoogleCalendarIntegration.moveEvent(
                    payload.vaultId,
                    payload.integrationId,
                    payload.calendarId,
                    payload.destination,
                    payload.eventId,
                );
            case GoogleCalendarIntegrationAction.DELETE_EVENT:
                return this.cloudService.GoogleCalendarIntegration.deleteEvent(
                    payload.vaultId,
                    payload.integrationId,
                    payload.calendarId,
                    payload.eventId,
                );
            case GoogleCalendarIntegrationAction.CREATE_WATCH:
                return this.cloudService.GoogleCalendarIntegration.createWatch(
                    payload.vaultId,
                    payload.integrationId,
                    payload.calendarId,
                );
            case GithubIntegrationAction.REQUEST:
                return this.cloudService.GithubIntegration.request(
                    payload.url,
                    payload.accessToken,
                    payload.baseUrl,
                    payload.cache,
                    payload.body,
                );
        }

        const response = await LinearWorkerActions.execute(
            this.cloudService.LinearIntegration,
            operation as LinearIntegrationActions,
            payload,
        );
        if (response) {
            return response;
        }

        const { entity, payload: _payload } = payload;
        const service = this.resolveService(entity);
        if (!service) return null;

        switch (operation) {
            case CloudServiceAction.RETRIEVE:
                return service.retrieve(_payload.id, _payload.vaultId);
            case CloudServiceAction.LIST:
                return service.list(_payload.vaultId, _payload.timestamp);
            case CloudServiceAction.LIST_DELETE_CHANGES:
                return service.listDeleteChanges(
                    _payload.vaultId,
                    _payload.timestamp,
                );
            case CloudServiceAction.SAVE:
                return service.save(
                    _payload.entity,
                    _payload.options,
                    _payload.vaultId,
                );
            case CloudServiceAction.SAVE_BATCH:
                return service.saveBatch(
                    _payload.entities,
                    _payload.vaultId,
                    _payload.options,
                );
            case CloudServiceAction.DELETE:
                return service.delete(_payload.id, _payload.vaultId);
            case CloudServiceAction.INITIAL_LOAD_DELETE_CHANGES:
                return service.loadDeleteChanges(
                    _payload.vaultId,
                    _payload.requestedEntities,
                );
            case CloudServiceAction.INITIAL_LOAD:
                return service.load(
                    _payload.vaultId,
                    _payload.requestedEntities,
                );
            default:
                return Promise.resolve(null);
        }
    }
}
