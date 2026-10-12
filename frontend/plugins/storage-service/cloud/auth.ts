import { NuxtAxiosInstance } from '@nuxtjs/axios';
import { NuxtConfig } from '@nuxt/types';
import { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { isElectron } from '~/helpers/is-electron';
import { CloudResponse } from '~/@types/app';
import { getJsrpClient, getSaltAndVerifier } from '~/helpers';

export class AuthService {
    private axiosInstance: NuxtAxiosInstance;
    private $config: NuxtConfig;

    constructor(axios: NuxtAxiosInstance, $config: NuxtConfig) {
        this.axiosInstance = axios;
        this.$config = $config;
    }

    get appleUrl() {
        return `${this.axiosInstance.defaults.baseURL}/api/auth/apple${
            isElectron() ? '-device' : ''
        }`;
    }

    get googleUrl() {
        if (
            (this.$config.env as unknown as string) === 'development' &&
            this.axiosInstance.defaults.baseURL !== 'http://localhost:8080'
        ) {
            return `${this.axiosInstance.defaults.baseURL}/api/auth/google${
                isElectron() ? '-device' : '-local'
            }`;
        }

        const redirectUrl = this.$config.feBaseUrl;

        return `${this.axiosInstance.defaults.baseURL}/api/auth/google${
            isElectron() ? '-device' : ''
        }?state=${encodeURIComponent(redirectUrl)}`;
    }

    get githubUrl() {
        if (
            (this.$config.env as unknown as string) === 'development' &&
            this.axiosInstance.defaults.baseURL !== 'http://localhost:8080'
        ) {
            return `${this.axiosInstance.defaults.baseURL}/api/auth/github${
                isElectron() ? '-device' : '-local'
            }`;
        }

        const redirectUrl = this.$config.feBaseUrl;

        return `${this.axiosInstance.defaults.baseURL}/api/auth/github${
            isElectron() ? '-device' : ''
        }?state=${encodeURIComponent(redirectUrl)}`;
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
        if ((this.$config as any).selfHostedSync) {
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
        const data = await this.axiosInstance
            .get('/api/auth/refresh', {
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
            '/api/auth/google/mobile-auth',
            {
                accessToken,
            },
        );
        return data;
    }

    async validateAppleIdentityToken(
        identityToken: string,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const { data } = await this.axiosInstance.post(
            '/api/auth/apple/mobile-auth',
            {
                identityToken,
            },
        );
        return data;
    }
}
