import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Flag to prevent multiple refresh calls simultaneously
let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void, reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Handle 401 errors (token expired)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            
            // Si es un error 401 tratando de refrescar el token en sí, deslogar y salir
            if (originalRequest.url?.includes('/api/token/refresh/')) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.reload();
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        return axios(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                localStorage.removeItem('access_token');
                window.location.reload();
                return Promise.reject(error);
            }

            try {
                // Obtenemos un nuevo access token usando el refresh
                const response = await axios.post('/api/token/refresh/', {
                    refresh: refreshToken
                });

                const { access, refresh } = response.data;
                localStorage.setItem('access_token', access);
                
                // Algunos backends rotan el refresh_token
                if (refresh) {
                    localStorage.setItem('refresh_token', refresh);
                }

                api.defaults.headers.common['Authorization'] = 'Bearer ' + access;
                originalRequest.headers['Authorization'] = 'Bearer ' + access;
                
                processQueue(null, access);
                
                return api(originalRequest);
            } catch (err) {
                processQueue(err, null);
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.reload();
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }
        
        return Promise.reject(error);
    }
);

// File Upload
export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const createResponse = await api.post('/imports/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        }
    });
    const batchId = createResponse.data.id;
    const processResponse = await api.post(`/imports/${batchId}/process_file/`);
    return processResponse.data;
};

// Transactions
export const getTransactions = async () => {
    const response = await api.get('/transactions/');
    return response.data;
};

export const updateTransaction = async (id: number, data: { category?: number }) => {
    const response = await api.patch(`/transactions/${id}/`, data);
    return response.data;
};

export interface CreateTransactionData {
    description: string;
    amount: number;
    category: number | null;
    date: string;
    type: 'income' | 'expense';
    account: number;
}

export const createTransaction = async (data: CreateTransactionData) => {
    const response = await api.post('/transactions/', data);
    return response.data;
};

// Accounts
export const getAccounts = async () => {
    const response = await api.get('/accounts/');
    return response.data;
};

// Categories
export interface Category {
    id: number;
    name: string;
    color: string;
    icon: string;
    is_income: boolean;
    parent: number | null;
    parent_name?: string | null;
    subcategories?: Category[];
}
export const Category = {};

export const getCategories = async (): Promise<Category[]> => {
    const response = await api.get('/categories/');
    return response.data;
};

export const getCategoriesTree = async (): Promise<Category[]> => {
    const response = await api.get('/categories/tree/');
    return response.data;
};

export const createCategory = async (data: {
    name: string;
    color?: string;
    icon?: string;
    is_income?: boolean;
    parent?: number | null;
}): Promise<Category> => {
    const response = await api.post('/categories/', data);
    return response.data;
};

export const updateCategory = async (
    id: number,
    data: Partial<{ name: string; color: string; icon: string; is_income: boolean; parent: number | null }>
): Promise<Category> => {
    const response = await api.patch(`/categories/${id}/`, data);
    return response.data;
};

export const deleteCategory = async (id: number): Promise<void> => {
    await api.delete(`/categories/${id}/`);
};

// Alerts
export interface AlertRelatedData {
    type?: string;
    category_id?: number;
    category_ids?: number[];
    transaction_ids?: number[];
    anomaly_transaction_id?: number;
    descriptions?: string[];
    period_days?: number;
}

export interface Alert {
    id: number;
    type: string;
    title: string;
    message: string;
    icon: string;
    is_read: boolean;
    is_dismissed: boolean;
    created_at: string;
    related_data?: AlertRelatedData;
}

export const getAlerts = async (): Promise<Alert[]> => {
    const response = await api.get('/alerts/');
    return response.data;
};

export const getUnreadAlertCount = async (): Promise<number> => {
    const response = await api.get('/alerts/unread_count/');
    return response.data.count;
};

export const markAlertRead = async (id: number) => {
    const response = await api.post(`/alerts/${id}/mark_read/`);
    return response.data;
};

export const markAllAlertsRead = async () => {
    const response = await api.post('/alerts/mark_all_read/');
    return response.data;
};

export const dismissAlert = async (id: number) => {
    const response = await api.post(`/alerts/${id}/dismiss/`);
    return response.data;
};

export const generateInsights = async () => {
    const response = await api.post('/alerts/generate_insights/');
    return response.data;
};

// ===================== BUDGET API =====================

export interface Budget {
    id: number;
    category: number;
    category_name: string;
    category_color: string;
    amount: string;
    month: string;
    created_at: string;
    updated_at: string;
}

export interface SubcategoryComparison {
    category_id: number;
    category_name: string;
    category_color: string;
    category_icon?: string;
    parent_id: number;
    parent_name?: string;
    budgeted: number;
    spent: number;
    difference: number;
    percentage: number;
    percentage_of_parent: number;
}

export interface BudgetComparison {
    category_id: number;
    category_name: string;
    category_color: string;
    category_icon?: string;
    parent_id?: number | null;
    budgeted: number;
    direct_budgeted?: number;
    children_budgeted?: number;
    spent: number;
    spent_direct?: number;
    children_spent?: number;
    difference: number;
    percentage: number;
    has_subcategories?: boolean;
    subcategories?: SubcategoryComparison[];
}

export interface BudgetComparisonResponse {
    month: string;
    comparison: BudgetComparison[];
    tree?: BudgetComparison[];
    flat?: BudgetComparison[];
    total_budgeted: number;
    total_spent: number;
}

export const getBudgets = async (month?: string): Promise<Budget[]> => {
    const params = month ? { month } : {};
    const response = await api.get('/budgets/', { params });
    return response.data;
};

export const saveBudgets = async (budgets: { category_id: number; amount: number }[], month: string) => {
    const response = await api.post('/budgets/bulk_save/', { budgets, month });
    return response.data;
};

export const getBudgetComparison = async (month?: string): Promise<BudgetComparisonResponse> => {
    const params = month ? { month } : {};
    const response = await api.get('/budgets/comparison/', { params });
    return response.data;
};

export const getBudgetAdvice = async (month?: string): Promise<string> => {
    const response = await api.post('/budgets/get_advice/', { month });
    return response.data.advice;
};

// ===================== RGPD / Privacy API =====================

export interface ConsentType {
    key: string;
    label: string;
    description: string;
}

export interface ConsentResponse {
    consents: Record<string, boolean>;
    available_types: ConsentType[];
}

export const getUserConsents = async (): Promise<ConsentResponse> => {
    const response = await api.get('/user/consent/');
    return response.data;
};

export const updateUserConsents = async (consents: Record<string, boolean>) => {
    const response = await api.post('/user/consent/', { consents });
    return response.data;
};

export const exportUserData = async () => {
    const response = await api.get('/user/data/');
    return response.data;
};

export const deleteUserAccount = async () => {
    const response = await api.delete('/user/data/');
    return response.data;
};

export const getProfilingInfo = async () => {
    const response = await api.get('/user/profiling-info/');
    return response.data;
};

// ===================== Open Banking API =====================

export interface BankInstitution {
    id: string;
    name: string;
    logo_url: string;
    country: string;
}

export interface BankTransactionItem {
    id: number;
    external_transaction_id: string;
    booking_date: string;
    value_date: string | null;
    amount: string;
    currency: string;
    description: string;
    merchant_name: string;
    category_code: string;
    created_at: string;
}

export interface BankAccountItem {
    id: number;
    external_account_id: string;
    iban: string;
    name: string;
    currency: string;
    balance: string;
    balance_updated_at: string | null;
    account_type: string;
    recent_transactions: BankTransactionItem[];
}

export interface BankConnectionItem {
    id: number;
    provider: string;
    institution_id: string;
    institution_name: string;
    status: 'pending' | 'active' | 'expired' | 'error' | 'revoked';
    consent_expires_at: string | null;
    last_synced_at: string | null;
    is_consent_valid: boolean;
    accounts: BankAccountItem[];
    created_at: string;
    updated_at: string;
}

export const getBankInstitutions = async (): Promise<BankInstitution[]> => {
    const response = await api.get('/banking/institutions/');
    return response.data;
};

export const getBankConnections = async (): Promise<BankConnectionItem[]> => {
    const response = await api.get('/banking/connections/');
    return response.data;
};

export const connectBank = async (institutionId: string, redirectUrl?: string) => {
    const response = await api.post('/banking/connections/', {
        institution_id: institutionId,
        redirect_url: redirectUrl,
    });
    return response.data;
};

export const disconnectBank = async (connectionId: number) => {
    const response = await api.delete(`/banking/connections/${connectionId}/`);
    return response.data;
};

export const syncBankConnection = async (connectionId: number) => {
    const response = await api.post(`/banking/connections/${connectionId}/sync/`);
    return response.data;
};

export const getBankAccountTransactions = async (
    accountId: number,
    params?: { date_from?: string; date_to?: string; limit?: number; offset?: number }
) => {
    const response = await api.get(`/banking/accounts/${accountId}/transactions/`, { params });
    return response.data;
};

export default api;

