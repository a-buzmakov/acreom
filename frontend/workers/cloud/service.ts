import { StatusCodes } from 'http-status-codes';
import axios, { AxiosError, AxiosInstance } from 'axios';
import axiosRetry, {
    exponentialDelay,
    isNetworkOrIdempotentRequestError,
} from 'axios-retry';
import {
    AuthService,
    DocumentsService,
    EventsService,
    GoogleCalendarIntegrationService,
    ImagesService,
    IntegrationsService,
    JiraIntegrationService,
    GithubIntegrationService,
    LoaderService,
    NLPService,
    ProjectsService,
    RecoveryKeysService,
    AppSettingsService,
    TaskListsService,
    TasksService,
    UserService,
    VaultsService,
    WebsocketsService,
    ViewsService,
} from './services';
import { WorkerContext } from '~/@types/app';
import {
    clearCachedCredentials,
    createAxiosInstance,
} from '~/workers/cloud/axios';
import { DatabaseServiceAction, ServiceKey } from '~/constants';
import { LinearIntegrationService } from '~/workers/cloud/services/linear/linear-integration';
import { VersionsService } from '~/workers/cloud/services/versions';

export class CloudService {
    public sharedAxiosInstance: any;

    private context: WorkerContext;
    private readonly axiosInstances: AxiosInstance[] = [];
    private readonly userService: UserService;
    private readonly documentsService: DocumentsService;
    private readonly projectsService: ProjectsService;
    private readonly tasksService: TasksService;
    private readonly eventsService: EventsService;
    private readonly taskListsService: TaskListsService;
    private readonly authService: AuthService;
    private readonly imagesService: ImagesService;
    private readonly nlpService: NLPService;
    private readonly integrationsService: IntegrationsService;
    private readonly vaultsService: VaultsService;
    private readonly websocketsService: WebsocketsService;
    private readonly googleCalendarIntegration: GoogleCalendarIntegrationService;
    private readonly loaderService: LoaderService;
    private readonly versionsService: VersionsService;
    private readonly jiraIntegration: JiraIntegrationService;
    private readonly linearIntegration: LinearIntegrationService;
    private readonly githubIntegration: GithubIntegrationService;
    private readonly viewsService: ViewsService;
    private readonly recoveryKeysService: RecoveryKeysService;
    private readonly appSettingsService: AppSettingsService;
    private refreshPromise: Promise<any> | null = null;

    constructor(ctx: WorkerContext) {
        const scopedContext = {
            ...ctx,
            $cloudService: this,
        };
        const createTrackedAxios = (
            context: WorkerContext = scopedContext,
            handleRefreshLogic = true,
        ) => {
            const instance = createAxiosInstance(context, handleRefreshLogic);
            this.axiosInstances.push(instance);
            return instance;
        };

        this.sharedAxiosInstance = createTrackedAxios();
        this.userService = new UserService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.documentsService = new DocumentsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.projectsService = new ProjectsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.tasksService = new TasksService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.eventsService = new EventsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.taskListsService = new TaskListsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.viewsService = new ViewsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.versionsService = new VersionsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.authService = new AuthService(
            createTrackedAxios(),
            scopedContext,
        );
        this.imagesService = new ImagesService(
            createTrackedAxios({
                ...scopedContext,
                $config: { ...scopedContext.$config, axiosTimeout: 60_000 },
            }),
            scopedContext,
        );
        this.nlpService = new NLPService(
            createTrackedAxios(),
            scopedContext,
        );
        this.integrationsService = new IntegrationsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.vaultsService = new VaultsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.recoveryKeysService = new RecoveryKeysService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.appSettingsService = new AppSettingsService(
            this.sharedAxiosInstance,
            scopedContext,
        );
        this.googleCalendarIntegration = new GoogleCalendarIntegrationService(
            createTrackedAxios({
                ...scopedContext,
                $config: { ...scopedContext.$config, axiosTimeout: 15_000 },
            }),
            scopedContext,
        );
        this.jiraIntegration = new JiraIntegrationService(
            this.registerRetry(
                createTrackedAxios(
                    {
                        ...scopedContext,
                        $config: {
                            ...scopedContext.$config,
                            axiosTimeout: 15_000,
                        },
                    },
                    false,
                ),
            ),
            scopedContext,
        );
        this.linearIntegration = new LinearIntegrationService(
            createTrackedAxios({
                ...scopedContext,
                $config: { ...scopedContext.$config, axiosTimeout: 15_000 },
            }),
            scopedContext,
        );
        this.githubIntegration = new GithubIntegrationService(
            axios,
            scopedContext,
        );
        this.loaderService = new LoaderService(
            createTrackedAxios({
                ...scopedContext,
                $config: { ...scopedContext.$config, axiosTimeout: 15_000 },
            }),
            scopedContext,
        );

        this.websocketsService = new WebsocketsService(scopedContext);
        this.context = scopedContext;
    }

    clearCachedCredentials() {
        clearCachedCredentials();
    }

    setBaseUrl(baseUrl: string, selfHostedSync = true) {
        this.context.$config.baseUrl = baseUrl;
        this.context.$config.selfHostedSync = selfHostedSync;
        for (const instance of this.axiosInstances) {
            instance.defaults.baseURL = baseUrl;
        }
        this.websocketsService.resetForBaseUrlChange();
    }

    async refreshCredentials(
        userId: string,
        credentials: {
            accessToken: string;
            refreshToken: string;
        },
    ) {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        const refreshCredentials = async () => {
            const response = await this.context.$cloudService.Auth.refresh(
                credentials.accessToken,
                credentials.refreshToken,
            );
            if (
                response.status !== StatusCodes.OK ||
                !response.data?.accessToken
            ) {
                return null;
            }

            await this.context.invoke(
                ServiceKey.DATABASE,
                DatabaseServiceAction.SAVE,
                {
                    table: 'users',
                    payload: {
                        entity: {
                            id: userId,
                            credentials: response.data,
                        },
                    },
                    callerContext: 'jira/service.ts/refreshCredentials',
                },
            );

            await this.context.invoke<void>(
                ServiceKey.STORE,
                'dispatch:auth/storeCredentials',
                response.data,
            );
            return response.data;
        };

        this.refreshPromise = new Promise(resolve => {
            refreshCredentials().then(data => {
                resolve(data);
                Promise.resolve().then(() => {
                    this.refreshPromise = null;
                });
            });
        });

        return this.refreshPromise;
    }

    get Websockets(): WebsocketsService {
        return this.websocketsService;
    }

    get User(): UserService {
        return this.userService;
    }

    get Documents(): DocumentsService {
        return this.documentsService;
    }

    get Tasks(): TasksService {
        return this.tasksService;
    }

    get TaskLists(): TaskListsService {
        return this.taskListsService;
    }

    get Views(): ViewsService {
        return this.viewsService;
    }

    get Events(): EventsService {
        return this.eventsService;
    }

    get Projects(): ProjectsService {
        return this.projectsService;
    }

    get Auth(): AuthService {
        return this.authService;
    }

    get NLP(): NLPService {
        return this.nlpService;
    }

    get Integrations(): IntegrationsService {
        return this.integrationsService;
    }

    get Images(): ImagesService {
        return this.imagesService;
    }

    get Vaults(): VaultsService {
        return this.vaultsService;
    }

    get Loader(): LoaderService {
        return this.loaderService;
    }

    get Versions(): VersionsService {
        return this.versionsService;
    }

    get GoogleCalendarIntegration(): GoogleCalendarIntegrationService {
        return this.googleCalendarIntegration;
    }

    get JiraIntegration(): JiraIntegrationService {
        return this.jiraIntegration;
    }

    get LinearIntegration(): LinearIntegrationService {
        return this.linearIntegration;
    }

    get GithubIntegration(): GithubIntegrationService {
        return this.githubIntegration;
    }

    get RecoveryKeys(): RecoveryKeysService {
        return this.recoveryKeysService;
    }

    get AppSettings(): AppSettingsService {
        return this.appSettingsService;
    }

    registerRetry(instance: AxiosInstance) {
        axiosRetry(instance, {
            retries: 4,
            retryDelay: exponentialDelay,
            retryCondition: async (error: AxiosError) => {
                const isForbidden = (error: AxiosError) => {
                    return error?.response && error.response?.status === 403;
                };
                if (isForbidden(error)) {
                    return false;
                }
                const isTooManyRequests = (error: AxiosError) => {
                    return error.response && error.response.status === 429;
                };
                return (
                    isTooManyRequests(error) ||
                    isNetworkOrIdempotentRequestError(error)
                );
            },
        });
        return instance;
    }
}
