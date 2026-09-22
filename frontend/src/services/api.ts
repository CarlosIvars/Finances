import axios from 'axios';

// Helper para extraer cookies del navegador (necesario para CSRF en SPA)
function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
}

const api = axios.create({
    baseURL: '/api',
    withCredentials: true, // RFC 10017 / BFF: Enviar cookies HttpOnly de sesión
    headers: {
        'Content-Type': 'application/json',
    },
});

// Inyectar automáticamente el token CSRF en peticiones mutantes
api.interceptors.request.use((config) => {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
    }
    // Soporte retroactivo temporal si aún existe token JWT en localStorage
    const legacyToken = localStorage.getItem('access_token');
    if (legacyToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${legacyToken}`;
    }
    return config;
});

// Interceptor de respuesta BFF
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Si la sesión caduca en una petición a la API
        if (error.response?.status === 401) {
            const url = error.config?.url || '';
            // Si no es la comprobación inicial de sesión
            if (!url.includes('/auth/me') && !url.includes('/auth/login')) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
            }
        }
        return Promise.reject(error);
    }
);

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    auth_provider?: string;
    google_sub?: string;
    email_verified?: boolean;
}

export interface AuthStatusResponse {
    authenticated: boolean;
    user: AuthUser | null;
}

export const authService = {
    async getCsrfToken(): Promise<string> {
        const res = await api.get<{ csrfToken: string }>('/auth/csrf/');
        return res.data.csrfToken;
    },
    async getAuthStatus(): Promise<AuthStatusResponse> {
        try {
            const res = await api.get<AuthStatusResponse>('/auth/me/');
            return res.data;
        } catch {
            return { authenticated: false, user: null };
        }
    },
    async getGoogleLoginUrl(): Promise<string> {
        const res = await api.get<{ url: string }>('/auth/google/url/');
        return res.data.url;
    },
    async login(username: string, password: string): Promise<{ status: string; user: AuthUser }> {
        // Asegurar que la cookie CSRF está configurada
        await this.getCsrfToken().catch(() => {});
        const res = await api.post<{ status: string; user: AuthUser }>('/auth/login/', { username, password });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return res.data;
    },
    async logout(): Promise<void> {
        try {
            await api.post('/auth/logout/');
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        }
    }
};

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
export const getTransactions = async (params?: Record<string, any>) => {
    const response = await api.get('/transactions/', { params });
    return response.data;
};

export const updateTransaction = async (
    id: number,
    data: {
        category?: number | null;
        is_tax_deductible?: boolean;
        tax_year?: number | null;
        tax_tags?: string[];
        description?: string;
        amount?: number;
    }
) => {
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
    tax_year?: number | null;
    is_tax_deductible?: boolean;
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

// ===================== TAX / IRPF API =====================

export interface TaxPreset {
    id: number;
    name: string;
    aeat_box: string;
    filters: Record<string, any>;
    is_system_preset: boolean;
    created_at: string;
    updated_at: string;
}

export interface TaxMetrics {
    total_income: number;
    total_expense: number;
    work_income: number;
    capital_income: number;
    donations_base: number;
    donations_deduction: number;
    mortgage_base: number;
    mortgage_deduction: number;
    rent_base: number;
    pension_base: number;
    pension_capped_base: number;
    total_transactions: number;
    total_with_document: number;
    document_coverage_percentage: number;
}

export interface TaxCategoryBreakdown {
    category_name: string;
    category_color: string;
    category_icon: string;
    aeat_code: string;
    is_income: boolean;
    is_deductible: boolean;
    total_amount: number;
    count: number;
    with_document_count: number;
}

export interface TaxSummaryResponse {
    tax_year: number;
    metrics: TaxMetrics;
    categories_breakdown: TaxCategoryBreakdown[];
}
export const TaxPreset = {};
export const TaxMetrics = {};
export const TaxCategoryBreakdown = {};
export const TaxSummaryResponse = {};

export const getTaxPresets = async (): Promise<TaxPreset[]> => {
    const response = await api.get('/tax/presets/');
    return response.data;
};

export const createTaxPreset = async (data: {
    name: string;
    aeat_box?: string;
    filters: Record<string, any>;
}): Promise<TaxPreset> => {
    const response = await api.post('/tax/presets/', data);
    return response.data;
};

export const deleteTaxPreset = async (id: number): Promise<void> => {
    await api.delete(`/tax/${id}/delete_preset/`);
};

export const getTaxSummary = async (year?: number): Promise<TaxSummaryResponse> => {
    const params = year ? { year } : {};
    const response = await api.get('/tax/summary/', { params });
    return response.data;
};

export const exportTaxReport = async (year: number, format: 'xlsx' | 'csv' = 'xlsx') => {
    const response = await api.get('/tax/export/', {
        params: { year, format },
        responseType: 'blob'
    });
    const blob = new Blob([response.data], {
        type: format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv;charset=utf-8;'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `IRPF_Declaracion_Renta_${year}.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

// ===================== DOCUMENTS & GMAIL API =====================

export interface DocumentItem {
    id: number;
    file_name: string;
    file_size: number;
    mime_type: string;
    file_hash: string;
    url: string;
    gmail_message_id: string;
    gmail_thread_id: string;
    gmail_web_link: string;
    email_subject: string;
    email_sender: string;
    email_date: string | null;
    amount_hint: string | number | null;
    status: 'unmatched' | 'suggested' | 'auto_matched' | 'confirmed';
    transaction: number | null;
    transaction_description?: string | null;
    transaction_amount?: string | number | null;
    transaction_date?: string | null;
    suggested_transaction: number | null;
    suggested_transaction_description?: string | null;
    suggested_transaction_amount?: string | number | null;
    suggested_transaction_date?: string | null;
    created_at: string;
    updated_at: string;
}

export interface GmailStatusResponse {
    is_connected: boolean;
    email: string;
    last_sync_at: string | null;
    sync_query: string;
    total_documents: number;
    unmatched_count: number;
    suggested_count: number;
    matched_count: number;
}
export const DocumentItem = {};
export const GmailStatusResponse = {};

export const getDocuments = async (params?: {
    status?: string;
    has_transaction?: boolean | string;
    transaction_id?: number;
    search?: string;
}): Promise<DocumentItem[]> => {
    const response = await api.get('/documents/', { params });
    return response.data;
};

export const confirmDocumentMatch = async (documentId: number) => {
    const response = await api.post(`/documents/${documentId}/confirm/`);
    return response.data;
};

export const rejectDocumentSuggestion = async (documentId: number) => {
    const response = await api.post(`/documents/${documentId}/reject_suggestion/`);
    return response.data;
};

export const linkDocument = async (documentId: number, transactionId: number) => {
    const response = await api.post(`/documents/${documentId}/link/`, {
        transaction_id: transactionId
    });
    return response.data;
};

export const unlinkDocument = async (documentId: number) => {
    const response = await api.post(`/documents/${documentId}/unlink/`);
    return response.data;
};

export const uploadDocument = async (file: File, transactionId?: number): Promise<DocumentItem> => {
    const formData = new FormData();
    formData.append('file', file);
    if (transactionId) {
        formData.append('transaction_id', String(transactionId));
    }
    const response = await api.post('/documents/upload/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

export const deleteDocument = async (documentId: number): Promise<void> => {
    await api.delete(`/documents/${documentId}/`);
};

export const getGmailAuthUrl = async (redirectUri?: string): Promise<string> => {
    const params = redirectUri ? { redirect_uri: redirectUri } : {};
    const response = await api.get('/documents/gmail/auth-url/', { params });
    return response.data.auth_url;
};

export const getGmailStatus = async (): Promise<GmailStatusResponse> => {
    const response = await api.get('/documents/gmail/status/');
    return response.data;
};

export const syncGmail = async (maxResults: number = 30) => {
    const response = await api.post('/documents/gmail/sync/', { max_results: maxResults });
    return response.data;
};

export const disconnectGmail = async () => {
    const response = await api.delete('/documents/gmail/status/');
    return response.data;
};

export default api;


