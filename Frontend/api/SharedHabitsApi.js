import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from "./apiConfig";

const getToken = async () => {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw new Error("Not authenticated");
  return token;

};

export const createSharedHabitRequest = async (habitData) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(habitData)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create shared habit');
    }

    return await response.json();
  } catch (error) {
    console.error('Error in createSharedHabitRequest:', error);
    throw error;
  }
};

export const acceptSharedHabit = async (habitId) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/${habitId}/accept`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to accept shared habit");
    }

    return await response.json();
  } catch (error) {
    console.error("Accept error:", error);
    throw error;
  }
};

export const rejectSharedHabit = async (habitId) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/${habitId}/reject`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to reject shared habit");
    }

    return await response.json();
  } catch (error) {
    console.error("Reject error:", error);
    throw error;
  }
};

export const fetchSharedHabits = async () => {
  try {
    const token = await getToken();
    const response = await fetch(`${API_URL}/habits/shared`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch shared habits');
    }
    const data = await response.json();
    return data.habits;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export const trackSharedHabit = async (habitId, completed, date) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/${habitId}/track`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          completed, 
          date: date || new Date().toISOString(),
          syncAll: true // Ensure all copies are synced
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to track habit");
    }

    return await response.json();
  } catch (error) {
    console.error("Track error:", error);
    throw error;
  }
};

export const getSharedHabitProgress = async (habitId) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/${habitId}/progress`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to get progress");
    }

    return await response.json();
  } catch (error) {
    console.error("Progress error:", error);
    throw error;
  }
};

export const updateSharedHabit = async (habitId, updateData) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/${habitId}/update`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update habit");
    }

    return await response.json();
  } catch (error) {
    console.error("Update error:", error);
    throw error;
  }
};

export const deleteSharedHabit = async (habitId) => {
  try {
    const token = await getToken();
    const response = await fetch(
      `${API_URL}/habits/shared/${habitId}/delete`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to delete habit");
    }

    return await response.json();
  } catch (error) {
    console.error("Delete error:", error);
    throw error;
  }
};

