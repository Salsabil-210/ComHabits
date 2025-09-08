import AsyncStorage from '@react-native-async-storage/async-storage';
import jwtDecode from "jwt-decode";
import { API_URL, API_ENDPOINTS } from "./apiConfig";

// Helper function to get the token safely
const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Authentication token is missing.");
    return token;
  } catch (error) {
    console.error("Error fetching token:", error.message);
    throw new Error("Error fetching authentication token.");
  }
};

// Helper function to get the logged-in user ID
export const getUserIdFromToken = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('No authentication token found');
    
    // Simple token extraction (no jwt-decode needed)
    const payload = token.split('.')[1];
    if (!payload) throw new Error('Invalid token format');
    
    const decodedPayload = JSON.parse(atob(payload));
    if (!decodedPayload?.userId) throw new Error('User ID not found in token');
    
    return decodedPayload.userId;
  } catch (error) {
    console.error('Failed to get user ID:', error);
    throw error;
  }
};

const apiRequest = async (endpoint, method = "GET", body = null) => {
  try {
    const token = await getToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    // Handle non-OK responses first
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: await response.text() || "Unknown error occurred" };
      }
      console.error("API Error:", errorData);
      throw new Error(errorData.message || `HTTP ${response.status} - Unknown error`);
    }

    // Handle successful responses
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    
    // For non-JSON responses
    return { 
      status: response.status,
      message: "Request successful (non-JSON response)"
    };
  } catch (error) {
    console.error(`API request failed [${method} ${endpoint}]:`, error);
    
    // Enhance network errors
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error("Network error - please check your internet connection");
    }
    
    throw error;
  }
};

export const createHabit = async (habitData) => {
  if (!habitData.name || !habitData.description) {
    throw new Error("Habit name and description are required.");
  }
  return apiRequest("/habits", "POST", habitData);
};

export const fetchHabits = async (type = 'personal') => {
  const token = await getToken();
  const response = await fetch(`${API_URL}/habits?type=${type}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    // handle error
  }
  const data = await response.json();
  return data.habits;
};

export const updateHabit = async (habitId, updatedData) => {
  if (!habitId) throw new Error("Habit ID is required.");
  
  // Remove id from the data we're sending to the API
  const { id, ...dataToSend } = updatedData;

  // Frontend validation for reminders
  if (dataToSend.reminders && Array.isArray(dataToSend.reminders)) {
    const now = new Date();
    for (const reminder of dataToSend.reminders) {
      const reminderDate = new Date(reminder);
      if (isNaN(reminderDate.getTime())) {
        throw new Error("Invalid reminder date format");
      }
      if (reminderDate < now) {
        throw new Error("Reminders cannot be in the past");
      }
    }
  }

  try {
    return await apiRequest(`/habits/${habitId}`, "PUT", dataToSend);
  } catch (error) {
    console.error("Error updating habit:", error);
    // Enhance error message for validation errors
    if (error.response?.data?.errors) {
      const errorMessages = Object.values(error.response.data.errors)
        .map(err => err.message || err)
        .join("\n");
      throw new Error(errorMessages);
    }
    throw error;
  }
};


export const trackHabit = async (habitId, completed, trackDate) => {
  if (!habitId) throw new Error("Habit ID is required.");

  try {
    console.log("Tracking habit:", { habitId, completed, trackDate }); 
    return await apiRequest(`/habits/${habitId}/track`, "POST", { completed, trackDate });
  } catch (error) {
    console.error("Tracking error:", error);
    throw new Error(`Tracking failed: ${error.message}`);
  }
};

export const fetchHabitsByDateRange = async (startDate, endDate) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('Authentication required');

    const response = await fetch(
      `${API_URL}${API_ENDPOINTS.HABITS_BY_DATE_RANGE}?startDate=${startDate}&endDate=${endDate}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch habits');
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch habits error:', error);
    throw error;
  }
};

export const fetchHabitStats = async (startDate, endDate) => {
  try {
    const token = await getToken();
    let url = `${API_URL}/habits/stats`;
    
    if (startDate && endDate) {
      url += `?startDate=${startDate}&endDate=${endDate}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch habit stats');
    }

    return await response.json();
  } catch (error) {
    console.error('Fetch habit stats error:', error);
    throw error;
  }
};

export const deleteHabit = async (habitId) => {
  if (!habitId) throw new Error("Habit ID is required to delete.");
  
  try {
    const response = await apiRequest(`/habits/${habitId}`, "DELETE");
    return { 
      success: true, 
      message: response.message || "Habit deleted successfully",
      deletedHabitId: habitId
    };
  } catch (error) {
    console.error("Error deleting habit:", error.message);
    throw new Error(`Error deleting habit: ${error.message}`);
  }
};

export const deleteOccurrence = async (habitId, date) => {
  try {
    // Ensure date is properly formatted
    const formattedDate = new Date(date);
    formattedDate.setHours(0, 0, 0, 0);

    const response = await apiRequest(
      `/habits/${habitId}/occurrence`,
      "DELETE",
      { date: formattedDate.toISOString() } // Explicit ISO string
    );

    if (!response?.success) {
      throw new Error(response?.message || "Failed to delete occurrence");
    }
    
    return response;
  } catch (error) {
    console.error('Error deleting occurrence:', error);
    throw new Error(error.response?.data?.message || error.message || 'Deletion failed');
  }
};

