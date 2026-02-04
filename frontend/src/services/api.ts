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
            // Could implement token refresh here
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

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

export const getTransactions = async () => {
    const response = await api.get('/transactions/');
    return response.data;
};

export const getAccounts = async () => {
    const response = await api.get('/accounts/');
    return response.data;
};

export const getCategories = async () => {
    const response = await api.get('/categories/');
    return response.data;
};

export const updateTransaction = async (id: number, data: { category?: number }) => {
    const response = await api.patch(`/transactions/${id}/`, data);
    return response.data;
};

export default api;
