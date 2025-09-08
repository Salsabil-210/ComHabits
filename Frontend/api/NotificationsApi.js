import { API_URL, API_ENDPOINTS } from "./apiConfig";
import axios from "axios";

export const getNotifications = async (token) => {
  try {
    const response = await fetch('http://10.0.2.2:3000/api/notifications', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(await response.json());
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export const handleNotificationAction = async (notificationId, action, token) => {
  try {
      const response = await axios.post(
          `${API_URL}${API_ENDPOINTS.HANDLE_NOTIFICATION_ACTION(notificationId)}`,
          { action },
          { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
  } catch (error) {
      console.error("Error handling notification action:", error);
      throw error;
  }
};

export const markNotificationAsRead = async (notificationId, token) => {
  try {
    const response = await axios.patch(
      `${API_URL}${API_ENDPOINTS.MARK_NOTIFICATION_AS_READ(notificationId)}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

export const markAllAsRead = async (token) => {
  try {
      const response = await axios.patch(
          `${API_URL}${API_ENDPOINTS.MARK_ALL_AS_READ}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
  } catch (error) {
      console.error("Error marking all as read:", error);
      throw error;
  }
};

export const getUnreadCount = async (token) => {
  try {
    const response = await axios.get(`${API_URL}${API_ENDPOINTS.GET_UNREAD_COUNT}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    console.error("Error getting unread count:", error);
    throw error;
  }
};

export const deleteNotification = async (notificationId, token) => {
  try {
    const response = await fetch( // <-- Use fetch instead of apiClient.delete
      `${API_URL}${API_ENDPOINTS.DELETE_NOTIFICATION(notificationId)}`, // Construct the full URL
      {
        method: 'DELETE', // Specify the HTTP method as DELETE
        headers: {
          'Authorization': `Bearer ${token}`, // Add the Authorization header
          // DELETE requests typically don't have a body, so Content-Type might not be needed
        },
      }
    );

    // Check if the response was successful (status 200-299)
    if (!response.ok) {
      // Attempt to parse error message from backend response if available
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    // Parse the JSON response body (assuming the backend sends back { success: true })
    const data = await response.json();
    return data; // Return the parsed data (e.g., { success: true })

  } catch (error) {
    console.error("Error deleting notification:", error); // Keep logging for debugging
    throw error; // Re-throw the error so the calling code can catch it and show an alert
  }
};