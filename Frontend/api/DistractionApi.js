import { API_URL, API_ENDPOINTS } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiRequest = async (endpoint, method, data = null) => {
  try {
    const token = await AsyncStorage.getItem('token');
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    const config = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.message || 'Request failed');
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${method} ${endpoint}):`, error);
    throw error;
  }
};

export const logDistraction = async (distractionData) => {
  return apiRequest(
    API_ENDPOINTS.DISTRACTIONS.LOG,
    'POST',
    distractionData
  );
};

export const getDistractionLogs = async (params = {}) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('No authentication token found');

    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `${API_URL}${API_ENDPOINTS.DISTRACTIONS.LOGS}?${queryString}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        endpoint: `${API_ENDPOINTS.DISTRACTIONS.LOGS}`,
        errorData
      });
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Full error context:', {
      errorMessage: error.message,
      params,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Failed to fetch distractions: ${error.message}`);
  }
};

export const getDistractionAnalytics = async (timeframe = 'week') => {
  try {
    // Validate timeframe first
    const validTimeframes = ['day', 'week', 'month', 'year'];
    if (!validTimeframes.includes(timeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    const token = await AsyncStorage.getItem('token');
    const response = await fetch(
      `${API_URL}/distractions/analytics?timeframe=${timeframe}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch analytics');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const updateDistraction = async (distractionId, updatedData) => {
  if (!distractionId) throw new Error("Distraction ID is required");
  return apiRequest(
    API_ENDPOINTS.DISTRACTIONS.EDIT(distractionId),
    'PUT',
    updatedData
  );
};

export const deleteDistraction = async (distractionId) => {
  if (!distractionId) throw new Error("Distraction ID is required");
  return apiRequest(
    API_ENDPOINTS.DISTRACTIONS.DELETE(distractionId),
    'DELETE'
  );
};

export const getDistractionCategories = async () => {
  try {
    // This could be hardcoded since it matches your model, or fetched from an endpoint
    return {
      success: true,
      data: [
        'Social Media', 
        'Environment', 
        'Health', 
        'Mood', 
        'Lack of Time', 
        'Other'
      ]
    };
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
};

// Helper function for time-based queries
export const getTimeRangeParams = (timeframe) => {
  const now = new Date();
  const startDate = new Date(now);
  
  switch (timeframe) {
    case 'day':
      startDate.setDate(now.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 7); // Default to week
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString()
  };
};

// Enhanced function to get logs with timeframe
export const getDistractionLogsByTimeframe = async (timeframe = 'week', limit = null) => {
  const { startDate, endDate } = getTimeRangeParams(timeframe);
  const params = {
    startDate,
    endDate,
    ...(limit && { limit })
  };
  return getDistractionLogs(params);
};

// Get stats with more options
export const getEnhancedDistractionStats = async (timeframe = 'week') => {
  const { startDate, endDate } = getTimeRangeParams(timeframe);
  return apiRequest(
    `${API_ENDPOINTS.DISTRACTIONS.ANALYTICS}?startDate=${startDate}&endDate=${endDate}`,
    'GET'
  );
};

export const getDistractionCounts = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Explicit endpoint path (matches your backend route exactly)
    const endpoint = `${API_URL}/distractions/counts`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    // Handle non-OK responses
    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: `HTTP error! Status: ${response.status}` };
      }
      
      console.error('API Error Details:', {
        status: response.status,
        endpoint: '/distractions/counts',
        errorData
      });
      
      throw new Error(errorData.message || `Failed to fetch distraction counts`);
    }

    return await response.json();

  } catch (error) {
    console.error('Distraction Counts Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    throw new Error(`Failed to get distraction counts: ${error.message}`);
  }
};