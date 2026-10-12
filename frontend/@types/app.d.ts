import { Store } from 'vuex';
import { AnyExtension, Editor } from '@tiptap/vue-2';
import { StarterKitOptions } from '@tiptap/starter-kit';
import { HighlightOptions } from '@tiptap/extension-highlight';
import { TableOptions } from '@tiptap/extension-table';
import { CodeBlockLowlightOptions } from '@tiptap/extension-code-block-lowlight';
import { NuxtApp } from '@nuxt/types/app';
import { VueFinalModalProperty } from 'vue-final-modal';
import type VueRouter from 'vue-router';
import type { Transaction } from '@tiptap/pm/state';
import { TaskItemOptions } from '@tiptap/extension-task-item';
import { DOMOutputSpec, Mark, Node } from '@tiptap/pm/model';
import { OnDeviceService } from '~/workers/database/controller';
import { CloudService } from '~/workers/cloud/service';
import { CloudService as PluginCloudService } from '~/plugins/storage-service/cloud';
import { EditorTypes, PageStatus, ServiceKey, TabType } from '~/constants';
import { AutocompleteOptions } from '~/components/editor/extensions/autocomplete';
import { ImageOptions } from '~/components/editor/extensions/image';
import { ServiceRegistry } from '~/plugins/service-registry/hub';
import { ShortcutsManager } from '~/plugins/shortcuts-manager/manager';
import { EditorUtils } from '~/components/editor/utils';
import { ITask } from '~/components/task/model';

export interface WorkerContext {
    $deviceService: OnDeviceService;
    $cloudService: CloudService;
    $config: {
        sep: '\\' | '/';
        onLine: boolean;
        platform: 'desktop' | 'mobile' | 'web';
        baseUrl: string;
        acreomDefaultBaseUrl?: string;
        selfHostedSync?: boolean;
        githubProxyUrl: string;
        os: 'windows' | 'linux' | 'macos' | 'android' | 'ios' | 'web';
        clientId: string;
        env: string;
        axiosTimeout?: number;
        version: string;
        compatibility: {
            minimal: string;
        };
    };
    emit(
        serviceKey: any,
        key: string,
        payload?: any,
        transferable?: any[],
    ): void;
    invoke<T>(
        serviceKey: any,
        key: string,
        payload: any,
        transferable?: any[],
    ): Promise<T>;
    on: (event: string, cb: (payload: any) => void) => void;
    off: (event: string) => void;
}

export type UpdateDownloadProgress = {
    total: number;
    delta: number;
    transferred: number;
    percent: number;
    bytesPerSecond: number;
};

export type Release = {
    tag: string;
    version: string;
    files: {
        url: string;
        sha512: string;
        size: number;
    }[];
    path: string;
    sha512: string;
    releaseDate: string;
    releaseName: string;
    releaseNotes: string;
};

export type PostprocessingMap = {
    tasks: string[];
    fullTasks: Record<string, Partial<ITask>>;
    jiraIssues: string[];
    linearIssues: string[];
    events: string[];
    links: string[];
    labels: string[];
    images: string[];
    githubLinks: string[];
};

export type LabelsMap = {
    tasks: string[];
    pages: string[];
};

export type ReverseIndex<T> = {
    id: string;
    filepath: string;
    text?: string;
    index?: string;
    entity: T;
} & Record<string, any>;

export type ReverseIndexObject = Record<
    string,
    Record<string, ReverseIndex<any>[]> | ReverseIndex<any>[]
>;

export type CloudResponse<T> = {
    data: T;
    status: number;
    statusText: string;
};

export type EditorContextConfig = {
    editable: boolean;
    placeholder: string;
    starterKit: Partial<StarterKitOptions>;
    todo: Partial<{
        documentId: string;
    }>;
    event: Partial<{}>;
    highlight: Partial<HighlightOptions>;
    table: Partial<TableOptions>;
    codeblock: Partial<CodeBlockLowlightOptions>;
    uniqueId: Partial<{
        attributeName: string;
        types: string[];
        generateID: () => string;
        filterTransaction: any;
    }>;
    autocomplete: Partial<AutocompleteOptions>;
    image: Partial<ImageOptions>;
    keyboardUtils: Partial<{
        documentId: string;
    }>;

    taskItem: Partial<TaskItemOptions>;
};

export type EditorContext = {
    editorId: string;
    documentId: string;
    groupId?: string;
    config: Partial<EditorContextConfig>;
    bubbleMenuExceptions: Set<string>;
    store: Store<any>;
    cloudService: PluginCloudService;
    serviceRegistry: ServiceRegistry;
    emit: (key: string, val?: any) => any;
    editor: () => Editor | null;
    shortcutsManager: ShortcutsManager;
    nuxt: NuxtApp;
    nextTick: (cb: () => void) => any;
    utils?: EditorUtils;
    vfm: VueFinalModalProperty;
    router: VueRouter;
    tabs: any;
    tracking: any;
    entities: any;
    onTransaction?: Function;
    onSelectionUpdate: (args: {
        editor: Editor;
        transaction: Transaction;
    }) => void;
    onCreate: Function;
    onDestroy: Function[];
    autofocusPosition?: number;
    onPositionChange: (position: number) => void;
};

export type ExtensionInterface = {
    type: EditorTypes;
    createInstance: (ctx: EditorContext) => AnyExtension | AnyExtension[];
};

export type Serializer<T> = (nodeOrMark: T) => DOMOutputSpec;
export type NodeSerializer = (
    ctx: EditorContext,
) => Record<string, Serializer<Node>>;
export type MarkSerializer = (
    ctx: EditorContext,
) => Record<string, Serializer<Mark>>;

export type Tab = {
    id: string;
    entityId: string;
    type: TabType;
    order: number;
    data: Record<string, any>;
    defaultData: Record<string, any>;
    panelOpen: boolean;
    panelType: string;
    panelData?: Record<string, any> | null;
};

export type TabGroup = {
    id: string;
    order: number;
    width: number;
    tabs: Tab[];
    activeTab: string;
    groupData: Record<Tab['entityId'], any>;
};

export type IVersion = {
    id: string;
    entityId: string;
    entityType: string;
    clientId: string;
    vaultId: string;
    content: {
        content: string;
        title: string;
        pageStatus?: PageStatus | null;
        icon?: string;
    };
    createdAt: Date;
    updatedAt: Date;
};
