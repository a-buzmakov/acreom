import { ThemeOptions } from '~/helpers/date';

export enum SortingOptions {
    MANUAL = 'manual',
    TITLE = 'title',
    DATE = 'date',
    DOCUMENT = 'document',
    LABEL = 'label',
    UPDATED_AT = 'updatedAt',
    CREATED_AT = 'createdAt',
    TIME = 'time',
    ASSIGNEE = 'assignee',
    KEY = 'key',
    PRIORITY = 'priority',
}

export enum ViewType {
    ACTIVE = 'active',
    ALL_PAGES = 'all_pages',
    ARCHIVE = 'archive',
    CUSTOM = 'custom',
    TEMPLATES = 'templates',
}

export enum GroupingOptions {
    PAGE_STATUS = 'pageStatus',
    FOLDER = 'folder',
    NONE = 'none',
}

export enum SearchIndex {
    EVENT = 'event',
    MY_DAY = 'my-day',
    DOCUMENT = 'document',
    NEW_DOCUMENT = 'new-document',
    TEMPLATE = 'template',
    OPEN_SEARCH = 'open-search',
    JIRA_ISSUE = 'jira',
    INTERACTIONS = 'interactions',
    COMMANDS = 'commands',
    ASSISTANT_QUERY = 'assistant-query',
    ASSISTANT_ANSWER = 'assistant-answer',
    INTEGRATION_DATA = 'integration-data',
    SEARCH = 'search',
    TASK = 'task',
    SETTINGS = 'settings',
    VIEW = 'view',
    FOLDER = 'folder',
    PROJECT = 'project',
}

export enum LangChainIndex {
    DOCUMENT = 'document',
}

export const MAX_INT_16 = (1 << 16) - 1;

export enum ServiceKey {
    UTILS = 'utils',
    ASSISTANT = 'assistant',
    DATABASE = 'database',
    ENCRYPTION = 'encryption',
    INTEGRATIONS = 'integrations',
    STORE = 'store',
    SEARCH = 'searchService',
    DEVICE = 'deviceService',
    CLOUD = 'cloudService',
    WORKER = 'worker',
    CONVERTER = 'converter',
    TOAST = 'toast',
    SENTRY = 'sentry',
    ANALYTICS = 'analytics',
    NUXT = 'nuxt',
    VFM = 'vfm',
}

export enum GenericActions {
    TRANSFER_PORT = 'generic transfer port',
    RESPONSE = 'generic response',
    EMIT = 'generic emit',
}

export enum AnalyticsAction {
    TRACK_EVENT = 'track event',
    PING = 'ping',
}

export enum CloudServiceAction {
    INITIALIZE = 'cloud intialize',

    CLEAR_CACHE = 'cloud clear cache',
    SET_BASE_URL = 'cloud set base url',
    INITIAL_LOAD = 'cloud initial load',
    INITIAL_LOAD_DELETE_CHANGES = 'cloud initial load delete changes',
    RETRIEVE = 'cloud retrieve',
    LIST = 'cloud list',
    LIST_DELETE_CHANGES = 'cloud list delete changes',
    SAVE = 'cloud save',
    SAVE_BATCH = 'cloud save batch',
    DELETE = 'cloud delete',
    IS_ONLINE = 'cloud is online',
    REFRESH = 'cloud refresh token',
    REFRESH_CREDENTIALS = 'cloud refresh credentials',
    SET_TIMEZONE = 'cloud set timezone',

    REGISTER_WEBSOCKETS = 'cloud register websockets',

    QUICKADD = 'cloud quickadd',

    UPLOAD_IMAGE = 'cloud upload image',

    WEBSOCKETS_INITIALIZE = 'cloud websockets intialize',
    WEBSOCKETS_REGISTER_NAMESPACE = 'cloud websockets register namespace',
    WEBSOCKETS_DISCONNECT_NAMESPACE = 'cloud websockets disconnect namespace',
}

export enum GoogleCalendarIntegrationAction {
    GET_EVENTS = 'google integration get events',
    CREATE_WATCH = 'google integration create watch',
    SAVE_EVENT = 'google integration save event',
    MOVE_EVENT = 'google integration move event',
    DELETE_EVENT = 'google integration delete event',
    WATCH_EMIT = 'google integration watch emit',
}

export enum SearchServiceAction {
    INDEX = 'search index',
    INITIAL_INDEX = 'search initial index',
    QUERY = 'search query',
    REMOVE = 'search remove',
    INDEX_INTERACTION = 'search index interaction',
    GET_INTERACTIONS = 'search get interactions',
}

export enum AppleCalendarIntegrationAction {
    GET_RANGE = 'apple integration get range',
}

export enum DatabaseServiceAction {
    GET_USER = 'database get user',
    INITIALIZE_USER = 'database initialize user',
    INITIALIZE_CONFIG_DATABASE = 'database initialize config database',
    INITIALIZE_AVAILABE_VAULTS = 'database initialize available vaults',
    GET_ACTIVE_VAULT = 'database get active vault',
    SET_ACTIVE_VAULT = 'database set active vault',
    DELETE_VAULT = 'database delete vault',
    LOAD_NEW_VAULT = 'database load new vault',
    LOAD_VAULT_CHANGES = 'database load vault changes',
    REGISTER_NEW_VAULT = 'database register new vault',
    REGISTER_CONFIG_SYNC_PROTOCOL = 'database register config sync protocol',
    REGISTER_SYNC_PROTOCOL = 'database register sync protocol',
    UNREGISTER_SYNC_PROTOCOL = 'database unregister sync protocol',
    SYNC_CONTENT_TO_DEVICE = 'database sync content to device',
    REMOVE_FILEPATH_FROM_ENTITIES = 'database remove filepath from entities',
    MIRROR_VAULT = 'database mirror vault',

    FILE_WATCHER_BATCH = 'file-watcher-batch',
    CONVERT_TO_MD = 'convert-to-md',
    GET_IMAGE_AVAILABLE_PATH = 'database get available filepath',

    LIST = 'database list',
    LIST_BY_IDS = 'database list by ids',
    LIST_BY_QUERY = 'database list by query',
    RETRIEVE = 'database retireve',
    SAVE = 'database save',
    DELETE = 'database delete',
    DELETE_BULK = 'database delete bulk',
    SAVE_BULK = 'database create bulk',
    DELETE_BATCH = 'database delete batch',

    INITIALIZE = 'database initialize',
    INITIALIZE_SYNC = 'database initialize sync',
    INITIALIZE_VAULTS_SYNC = 'database initialize vaults sync',
    SET_BASE_URL = 'database set base url',
    CONNECT_SYNC = 'database connect sync',
    DISCONNECT_SYNC = 'database disconnect sync',
    LOGOUT = 'database logout',
    RESPONSE = 'database response',
    EMIT = 'database emit',
    CONNECTED_VAULTS = 'database connected vaults',
    IS_VAULT_CONNECTED = 'database is vault connected',

    FORCE_SYNC = 'database force sync',
    ACCEPT_REMOTE_CHANGES = 'database accept remote changes',
    ACCEPT_LOCAL_CHANGES = 'database accept local changes',

    REINDEX_ASSISTANT_EMBEDDINGS = 'database reindex assistant embeddings',

    IMPORT_MARKDOWN = 'database import markdown',
    RESTORE_SESSION_KEY = 'database restore session key',
    DID_RESTORE_SESSION_KEY = 'database did restore session key',
    UNLOCK_PRIVATE_KEYS = 'database unlock encrypted vaults',
    ENABLE_ENCRYPTION_ON_VAULT = 'database enable encryption on vault',
    ENABLE_ENCRYPTION = 'database enable encryption',
    RETRIEVE_DECRYPTED_IMAGE = 'database retrieve decrypted image',
    CREATE_RECOVERY_KEY = 'database create recovery key',
    GET_PRIVATE_KEYS_FROM_RECOVERY = 'database get private keys from recovery',

    GET_RELEVANT_CONTENT = 'database get relevant content',
    GET_INTEGRATIONS_MYSELF = 'database get integration myself',

    DECRYPT_INTEGRATION = 'database decrypt',

    ARCHIVE = 'database archive',
}

export enum LocalConfigIds {
    IDB_ENTITIES_POST_UPGRADE_SYNC = 'idbEntitiesPostUpgradeSynced',
    IDB_VAULT_DEVICE_SYNC_STATUS = 'idbVaultDeviceSyncStatus',
    TASK_VIEW_SETTINGS = 'taskViewSettings',
    TAB_SETTINGS = 'tabSettings',
}

export enum UtilActions {
    INITIALIZE = 'utils initialize',
    CREATE_CARD_IMAGE = 'utils create card image',
    RETRIEVE_CARD_IMAGE = 'utils retrieve card image',
    INDEX_ENTITY = 'utils index entity',
    REMOVE_ENTITY = 'utils remove entity',

    PARSE_HTML_TO_MD = 'utils parse html to md',
    PARSE_MD_TO_HTML = 'utils parse md to html',
}

export enum AssistantActions {
    GENERATE_MERMAID = 'assistant generate mermaid',
    GENERATE_MERMAID_LOCAL = 'local assistant generate mermaid',
    GENERATE_SUMMARY = 'assistant generate summary',
    GENERATE_SUMMARY_LOCAL = 'local assistant generate summary',
    QUERY_KNOWLEDGE_BASE = 'assistant query knowledge base',
    QUERY_KNOWLEDGE_BASE_LOCAL = 'local assistant query knowledge base',
    ASK_ASSISTANT = 'assistant ask assistant',
    INITIALIZE = 'assistant initialize',
    SET_CONFIG = 'assistant set config',
    GET_TOOL_CONTEXT = 'assistant get tool context',
    LANGCHAIN_INITIAL = 'assistant langchain initial',
    LANGCHAIN_INDEX = 'assistant langchain index',
    LANGCHAIN_REMOVE = 'assistant langchain remove',
}

export enum IntegrationsActions {
    START = 'integrations start',
    INITIALIZE = 'integrations initialize',
    MANUAL_RUN = 'integrations manual run',
    EMIT = 'integrations emit',
}

export enum TaskActions {
    CREATE = 'create',
    DELETE = 'delete',
    DELETE_MULTIPLE = 'delete multiple',
    UPDATE = 'update',
    SCHEDULE = 'schedule',
    CONVERT = 'convert to task',
}

export enum JiraActions {
    UPDATE = 'update',
    CLIP = 'clip',
    UNCLIP = 'page remove',
    SCHEDULE = 'schedule',
}

export enum JiraIntegrationAction {
    GET_ISSUE = 'jira integration get issue',
    GET_ISSUES = 'jira integration get issues',
    GET_PRIORITIES = 'jira integration get priorities',
    GET_STATUSES = 'jira integration get statuses',
    GET_MYSELF = 'jira integration get myself',
    GET_PROJECTS = 'jira integration get projects',
    GET_METADATA = 'jira integration get metadata',
    GET_USERS = 'jira integration get users',
    GET_COMMENTS = 'jira integration get comments',
    GET_ATTACHMENT = 'jira integration get attachment',
    WATCH_EMIT = 'jira integration watch emit',
    INITIALIZE = 'jira integration initialize',
    INITIALIZE_INTEGRATION = 'jira integration initialize integration',
    SAVE_ISSUE = 'jira integration save issue',
    REFRESH_CREDENTIALS = 'jira integration refresh credentials',
}

export enum IntegrationType {
    GITHUB = 'github',
    ICS_CALENDAR = 'ics_calendar',
    GOOGLE_CALENDAR = 'google_calendar',
    JIRA = 'jira',
    LINEAR = 'linear',
    APPLE_CALENDAR = 'apple_calendar',
    AI_ASSISTANT = 'ai_assistant',
}

export enum JiraStatusColors {
    TODO = '#677589',
    IN_PROGRESS = '#4B7ED1',
    DONE = '#59B17C',
}

export enum FileType {
    MARKDOWN = 'markdown',
    ATTACHMENT = 'attachment',
    CONFIG = 'config',
    UNSUPPORTED = 'unsupported',
}

export enum NotificationActions {
    REDIRECT = 'redirect',
}

export enum ConverterAction {
    TO_MARKDOWN = 'converter to markdown',
    TO_HTML = 'converter to html',
}

export type ColorSchema = { COLOR: string; TRIPLET: string };
export type ColorTuple = {
    [ThemeOptions.DARK]: ColorSchema;
    [ThemeOptions.LIGHT]: ColorSchema;
};

export enum Color {
    ROSE = 'color rose',
    PINK = 'color pink',
    FUCHSIA = 'color fuchsia',
    PURPLE = 'color purple',
    VIOLET = 'color violet',
    INDIGO = 'color indigo',
    BLUE = 'color blue',
    SKY = 'color sky',
    TURQUOISE = 'color turquoise',
    TEAL = 'color teal',
    EMERALD = 'color emerald',
    GREEN = 'color green',
    LIME = 'color lime',
    YELLOW = 'color yellow',
    AMBER = 'color amber',
}

export const APP_COLORS: Record<Color, ColorTuple> = {
    [Color.ROSE]: {
        DARK: {
            COLOR: '#FDA4AF',
            TRIPLET: '253, 164, 175',
        },
        LIGHT: {
            COLOR: '#E11D48',
            TRIPLET: '225, 29, 72',
        },
    },
    [Color.PINK]: {
        DARK: {
            COLOR: '#F9A8D4',
            TRIPLET: '249, 168, 212',
        },
        LIGHT: {
            COLOR: '#DB2777',
            TRIPLET: '219, 39, 119',
        },
    },
    [Color.FUCHSIA]: {
        DARK: {
            COLOR: '#F0ABFC',
            TRIPLET: '240, 171, 252',
        },
        LIGHT: {
            COLOR: '#C026D3',
            TRIPLET: '192, 38, 211',
        },
    },
    [Color.PURPLE]: {
        DARK: {
            COLOR: '#D8B4FE',
            TRIPLET: '216, 180, 254',
        },
        LIGHT: {
            COLOR: '#9333EA',
            TRIPLET: '147, 51, 234',
        },
    },
    [Color.VIOLET]: {
        DARK: {
            COLOR: '#C4B5FD',
            TRIPLET: '196, 181, 253',
        },
        LIGHT: {
            COLOR: '#7C3AED',
            TRIPLET: '124, 58, 237',
        },
    },
    [Color.INDIGO]: {
        DARK: {
            COLOR: '#A5B4FC',
            TRIPLET: '165, 180, 252',
        },
        LIGHT: {
            COLOR: '#4F46E5',
            TRIPLET: '79, 70, 229',
        },
    },
    [Color.BLUE]: {
        DARK: {
            COLOR: '#93C5FD',
            TRIPLET: '147, 197, 253',
        },
        LIGHT: {
            COLOR: '#2563EB',
            TRIPLET: '37, 99, 235',
        },
    },
    [Color.SKY]: {
        DARK: {
            COLOR: '#7DD3FC',
            TRIPLET: '125, 211, 252',
        },
        LIGHT: {
            COLOR: '#0284C7',
            TRIPLET: '2, 132, 199',
        },
    },
    [Color.TURQUOISE]: {
        DARK: {
            COLOR: '#64d7de',
            TRIPLET: '100, 215, 222',
        },
        LIGHT: {
            COLOR: '#38AFB7',
            TRIPLET: '56, 175, 183',
        },
    },
    [Color.TEAL]: {
        DARK: {
            COLOR: '#5EEAD4',
            TRIPLET: '94, 234, 212',
        },
        LIGHT: {
            COLOR: '#0D9488',
            TRIPLET: '13, 148, 136',
        },
    },
    [Color.EMERALD]: {
        DARK: {
            COLOR: '#6EE7B7',
            TRIPLET: '110, 231, 183',
        },
        LIGHT: {
            COLOR: '#059669',
            TRIPLET: '5, 150, 105',
        },
    },
    [Color.GREEN]: {
        DARK: {
            COLOR: '#86EFAC',
            TRIPLET: '134, 239, 172',
        },
        LIGHT: {
            COLOR: '#16A34A',
            TRIPLET: '22, 163, 74',
        },
    },
    [Color.LIME]: {
        DARK: {
            COLOR: '#BEF264',
            TRIPLET: '190, 242, 100',
        },
        LIGHT: {
            COLOR: '#65A30D',
            TRIPLET: '101, 163, 13',
        },
    },
    [Color.YELLOW]: {
        DARK: {
            COLOR: '#FDE047',
            TRIPLET: '253, 224, 71',
        },
        LIGHT: {
            COLOR: '#CA8A04',
            TRIPLET: '202, 138, 4',
        },
    },
    [Color.AMBER]: {
        DARK: {
            COLOR: '#FCD34D',
            TRIPLET: '252, 211, 77',
        },
        LIGHT: {
            COLOR: '#D97706',
            TRIPLET: '217, 119, 6',
        },
    },
};

export enum LoadProgressState {
    OKAY = 'okay',
    ERROR = 'error',
    CLOUD_VAULT_LOADING = 'cloud_vault_loading',
    CLOUD_VAULT_SENDING = 'cloud_vault_sending',
    IMPORTING_NEW_VAULT = 'importing_new_vault',
    IMPORTING_NEW_CHANGES = 'importing_new_changes',
    ENCRYPTING_VAULT = 'encrypting_vault',
}

export const ARCHIVE_EXPIRE_DAYS = 30;

export enum EditorTypes {
    FULL = 'full',
    BASIC = 'basic',
}

export const VAULT_COLORS = [
    '#FDA4AF',
    '#F9A8D4',
    '#F0ABFC',
    '#D8B4FE',
    '#C4B5FD',
    '#A5B4FC',
    '#93C5FD',
    '#7DD3FC',
    '#64d7de',
    '#5EEAD4',
    '#6EE7B7',
    '#86EFAC',
    '#BEF264',
    '#FDE047',
    '#FCD34D',
];

export const VAULT_COLORS_OLD = [
    '#4F92FF',
    '#C786DD',
    '#D99737',
    '#49A47C',
    '#926837',
];

export const BASE_MONTHLY_URL =
    'https://buy.stripe.com/test_cN2eXy6N22jf6R2cMR';
export const BASE_YEARLY_URL = 'https://buy.stripe.com/test_cN2eXyefu1fb6R27sw';

export enum TabType {
    DOCUMENT = 'document',
    MY_DAY = 'my_day',
    NEW = 'new',
    JIRA_APP = 'jira_app',
    GITHUB_APP = 'github_app',
    VIEW = 'view',
    PROJECT = 'project',
    LINEAR_APP = 'linear_app',
    ARCHIVE = 'archive',
    ASSISTANT = 'assistant',
}

export enum PageStatus {
    TODO = 'todo',
    IN_PROGRESS = 'in progress',
    DONE = 'done',
}

export enum SourceOptions {
    MY_DAY = 'my_day',
    VAULT = 'vault',
}

export enum SidebarTypes {
    STATUS = 'status',
    DATE = 'date',
    CLIP = 'clip',
}

export enum PanelTypes {
    MY_DAY = 'my_day',
}

export enum PropertyTypes {
    DATETIME = 'datetime',
    SINGLE_SELECT = 'select',
    MULTI_SELECT = 'select',
}
export const PANEL_DETACH_WIDTH = 768;

export enum FolderType {
    FOLDER = 'folder',
    PROJECT = 'project',
}

export enum PageListType {
    PROJECT = 'project',
    VIEW = 'view',
}

export enum PageListEntityType {
    PAGE = 'page',
    TASK = 'task',
    SECTION_HEADER = 'section_header',
    PAGE_ADDER = 'page_adder',
    HEADER = 'header',
}

export enum SidebarEntityType {
    PROJECT = 'project',
    VIEW = 'view',
}
