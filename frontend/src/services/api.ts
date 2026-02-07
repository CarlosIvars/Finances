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

// Handle 401 errors (token expired)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.reload();
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
    is_income: boolean;
    parent: number | null;
    user: number;
}

export const getCategories = async (): Promise<Category[]> => {
    const response = await api.get('/categories/');
    return response.data;
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

export interface BudgetComparison {
    category_id: number;
    category_name: string;
    category_color: string;
    budgeted: number;
    spent: number;
    difference: number;
    percentage: number;
}

export interface BudgetComparisonResponse {
    month: string;
    comparison: BudgetComparison[];
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

export default api;

