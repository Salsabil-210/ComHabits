import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, API_ENDPOINTS } from './apiConfig';

const getAuthToken = async () => {
  return await AsyncStorage.getItem('token');
};

export const BadHabitApi = {

  getBadHabits: async () => {
  try {
    const token = await getAuthToken();
    if (!token) throw new Error('No authentication token found');
    
    const response = await axios.get(`${API_URL}${API_ENDPOINTS.BAD_HABITS.GET_ALL}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch habits');
    }
    
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(error.response?.data?.message || error.message || 'Failed to fetch habits');
  }
},
  addBadHabit: async (badHabit, goodHabit) => {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}${API_ENDPOINTS.BAD_HABITS.ADD_PAIR}`,
        { badHabit, goodHabit },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to add habit');
    }
  },

  updateBadHabit: async (id, updates) => {
    try {
      const token = await getAuthToken();
      const response = await axios.put(
        `${API_URL}${API_ENDPOINTS.BAD_HABITS.UPDATE_PAIR(id)}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to update habit');
    }
  },

  deleteBadHabit: async (id) => {
    try {
      const token = await getAuthToken();
      const response = await axios.delete(
        `${API_URL}${API_ENDPOINTS.BAD_HABITS.DELETE_PAIR(id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Failed to delete habit');
    }
  },

  trackHabit: async (id) => {
    try {
      const token = await getAuthToken();
      const response = await axios.post(
        `${API_URL}/badhabits/${id}/track`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data && typeof response.data.success !== 'undefined') {
        return response.data;
      }
      
      throw new Error('Invalid response from server');
  
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw new Error(error.message || 'Failed to track habit');
    }
  }
};