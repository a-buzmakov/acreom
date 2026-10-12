import { AxiosError, AxiosInstance } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { isElectron } from '~/helpers/is-electron';
import { WorkerContext, CloudResponse } from '~/@types/app';
import { getJsrpClient, getSaltAndVerifier } from '~/helpers';
import { networkErrorHandler } from '~/workers/cloud/util';

export class AuthService {
    private axiosInstance: AxiosInstance;
    private context: WorkerContext;

    constructor(axios: AxiosInstance, ctx: WorkerContext) {
        this.axiosInstance = axios;
        this.context = ctx;
    }

    get googleUrl() {
        if (
            this.context.$config.env === 'development' &&
            this.axiosInstance.defaults.baseURL !== 'http://localhost:8080'
        ) {
            return `${this.axiosInstance.defaults.baseURL}/api/auth/google${
                isElectron() ? '-device' : '-local'
            }`;
        }

        return `${this.axiosInstance.defaults.baseURL}/api/auth/google${
            isElectron() ? '-device' : ''
        }`;
    }

    get githubUrl() {
        return `${this.axiosInstance.defaults.baseURL}/api/auth/github${
            isElectron() ? '-device' : ''
        }`;
    }

    async selfHostedLogin(
        email: string,
        plainPassword: string,
    ): Promise<CloudResponse<any>> {
        return this.axiosInstance
            .post(`${this.axiosInstance.defaults.baseURL}/api/auth/login`, {
                email,
                password: plainPassword,
            })
            .then(data => {
                return {
                    status: data.status,
                    statusText: data.statusText,
                    data: data.data,
                };
            })
            .catch((err: AxiosError) => {
                if (!err.response) return networkErrorHandler(err.code!);
                return {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data,
                } as CloudResponse<any>;
            });
    }

    async login(
        email: string,
        plainPassword: string,
    ): Promise<CloudResponse<any>> {
        if (this.context.$config.selfHostedSync) {
            return this.selfHostedLogin(email, plainPassword);
        }

        const response = await this.axiosInstance
            .get(
                `${this.axiosInstance.defaults.baseURL}/api/auth/password/salt`,
                {
                    params: { email },
                },
            )
            .then(data => {
                return {
                    status: data.status,
                    statusText: data.statusText,
                    data: data.data,
                };
            })
            .catch((err: AxiosError) => {
                if (!err.response) return networkErrorHandler(err.code!);
                return {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data,
                } as CloudResponse<any>;
            });
        if (response.status !== StatusCodes.OK) {
            return {
                status: StatusCodes.BAD_REQUEST,
                statusText: 'bad request',
                data: null,
            };
        }
        const { salt, publicKey } = response.data;
        const jsrpClient = await getJsrpClient(email, plainPassword);
        const clientPublicKey = jsrpClient.getPublicKey();
        jsrpClient.setSalt(salt);
        jsrpClient.setServerPublicKey(publicKey);

        return this.axiosInstance
            .post(
                `${this.axiosInstance.defaults.baseURL}/api/auth/password`,
                {
                    publicKey: clientPublicKey,
                    sharedKey: jsrpClient.getSharedKey(),
                },
                {
                    params: {
                        email,
                    },
                },
            )
            .then(data => {
                return {
                    status: data.status,
                    statusText: data.statusText,
                    data: data.data,
                };
            })
            .catch((err: AxiosError) => {
                if (!err.response) return networkErrorHandler(err.code!);
                return {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data,
                } as CloudResponse<any>;
            });
    }

    async register(
        email: string,
        password: string,
    ): Promise<CloudResponse<any>> {
        const url =
            `${this.axiosInstance.defaults.baseURL}/api/auth/password/register` +
            (isElectron() ? '-device' : '-local');
        const { salt, verifier } = await getSaltAndVerifier(email, password);

        return this.axiosInstance
            .post(url, {
                email,
                salt,
                verifier,
            })
            .then(data => {
                return {
                    status: data.status,
                    statusText: data.statusText,
                    data: data.data,
                };
            })
            .catch((err: AxiosError) => {
                if (!err.response) return networkErrorHandler(err.code!);
                return {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data,
                } as CloudResponse<any>;
            });
    }

    resetPassword(email: string) {
        const url = `${this.axiosInstance.defaults.baseURL}/api/auth/password/reset`;
        return this.axiosInstance
            .get(url, {
                params: {
                    email,
                },
            })
            .then(data => {
                return {
                    status: data.status,
                    statusText: data.statusText,
                    data: data.data,
                };
            })
            .catch((err: AxiosError) => {
                if (!err.response) return networkErrorHandler(err.code!);
                return {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data,
                } as CloudResponse<any>;
            });
    }

    async refresh(
        accessToken: string,
        refreshToken: string,
    ): Promise<CloudResponse<{ accessToken: string; refreshToken: string }>> {
        const data = await this.axiosInstance({
            method: 'get',
            url: '/api/auth/refresh',
            responseType: 'json',
            headers: {
                'X-Refresh-Token': refreshToken,
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then(data => {
                return {
                    status: data.status,
                    statusText: data.statusText,
                    data: data.data,
                };
            })
            .catch((err: AxiosError) => {
                console.log(err, err.config.headers);
                if (!err.response) return networkErrorHandler(err.code!);

                return {
                    status: err.response?.status,
                    statusText: err.response?.statusText,
                    data: err.response?.data,
                } as CloudResponse<any>;
            });
        return data;
    }

    async validateAccessToken(
        accessToken: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const { data } = await this.axiosInstance.post(
            `${this.axiosInstance.defaults.baseURL}/api/auth/google/mobile-auth`,
            {
                accessToken,
            },
        );
        return data;
    }
}
