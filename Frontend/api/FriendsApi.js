import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import jwtDecode from "jwt-decode";
import { API_URL, API_ENDPOINTS } from "./apiConfig";

let cachedToken = null; 

const getToken = async () => {
    try {
        if (cachedToken) return cachedToken;

        let token = await AsyncStorage.getItem('token');
        console.log("Retrieved token:", token);
        
        if (!token) {
            console.log("No token found, redirecting to login...");
            return null;
        }

        const decodedToken = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decodedToken.exp < currentTime) {
            console.log("Token expired, refreshing...");
            token = await refreshToken();
            if (!token) return null;
        }

        cachedToken = token; 
        return token;
    } catch (error) {
        console.error("Error getting token:", error);
        return null;
    }
};

const refreshToken = async () => {
    try {
        const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
        console.log("Stored refresh token:", storedRefreshToken);

        if (!storedRefreshToken) {
            console.log("No refresh token found, cannot refresh token.");
            return null;
        }

        const response = await axios.post(`${API_URL}${API_ENDPOINTS.REFRESH_TOKEN}`, {
            refreshToken: storedRefreshToken,
        });

        if (response.data.token) {
            console.log("New access token received:", response.data.token);
            await AsyncStorage.setItem('token', response.data.token);
            cachedToken = response.data.token; // Update cached token
            return response.data.token;
        } else {
            console.log("No token received from refresh response");
            return null;
        }
    } catch (error) {
        console.error("Error refreshing token:", error);
        return null;
    }
};

export const searchUsers = async (query, token) => {
    try {
      
        const response = await axios.get(`${API_URL}${API_ENDPOINTS.SEARCH_USERS}?query=${query}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data || { users: [] };
    } catch (error) {
        console.error("Error searching users:", error);
        throw error;
    }
};

export const sendFriendRequest = async (recipientId, token) => {
    try {
        const response = await axios.post(
            `${API_URL}${API_ENDPOINTS.SEND_FRIEND_REQUEST}`,
            { recipientId },
            { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                } 
            }
        );

        if (!response.data.success) {
            if (response.status === 429) {
                const cooldownMessage = response.data.cooldownUntil 
                    ? `Try again ${moment(response.data.cooldownUntil).fromNow()}`
                    : "Please wait before sending another request";
                throw new Error(`${response.data.message} ${cooldownMessage}`);
            }
            throw new Error(response.data.message || "Failed to send friend request");
        }

        return {
            ...response.data,
            remainingAttempts: response.data.remainingAttempts || 0
        };

    } catch (error) {
        console.error("Send friend request error:", error.response?.data || error.message);
        throw new Error(
            error.response?.data?.message || 
            error.message || 
            "Failed to send friend request"
        );
    }
};

export const acceptFriendRequest = async (requestId, token) => {
    try {
       const token = await AsyncStorage.getItem('token');
        const response = await axios.post(
            `${API_URL}/friends/accept-request`,
            { requestId }, 
            { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        const errorMsg = error.response?.data?.message || 
                       "Failed to accept friend request";
        throw new Error(errorMsg);
    }
};
  
  export const rejectFriendRequest = async (requestId, token) => {
    try {
    const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/friends/reject-request`, 
        { requestId }, 
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data?.message || 
                     "Failed to reject friend request";
      throw new Error(errorMsg);
    }
};
  
export const getFriendsList = async (token) => {
    try {
      const token = await AsyncStorage.getItem('token');
        const response = await axios.get(`${API_URL}${API_ENDPOINTS.GET_FRIENDS}`, {
            headers:
             { Authorization: `Bearer ${token}` }
        });
        
        if (!response.data.success) {
            throw new Error(response.data.message || "Failed to fetch friends");
        }
        
        return response.data;
    } catch (error) {
        console.error("Error getting friends list:", error);
        throw new Error(error.response?.data?.message || "Failed to load friends list");
    }
};

export const getIncomingRequests = async (token) => {
    try {
        const response = await axios.get(`${API_URL}${API_ENDPOINTS.GET_INCOMING_REQUESTS}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Error getting incoming requests:", error);
        throw error;
    }
};

export const removeFriend = async (friendId, token) => {
  try {
     const token = await AsyncStorage.getItem('token');
      const response = await axios.delete(
          `${API_URL}${API_ENDPOINTS.REMOVE_FRIEND}`,
          {
              headers: { 
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              data: { friendId }
          }
      );
      
      if (!response.data.success) {
          throw new Error(response.data.message || "Failed to remove friend");
      }
      
      return response.data;
  } catch (error) {
      console.error("Error removing friend:", {
          error: error.response?.data?.message || error.message,
          status: error.response?.status
      });
      throw new Error(error.response?.data?.message || "Failed to remove friend");
  }
};

export const cancelFriendRequest = async (requestId, recipientId, token) => {
    try {
      
      console.log('[1] Attempting to cancel request:', requestId);
      
      // First attempt with current token
      const response = await axios.post(
        `${API_URL}${API_ENDPOINTS.CANCEL_REQUEST}`,
        { requestId, recipientId }, 
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 
        }
      );
  
      console.log('[2] Cancel request response:', response.data);
  
      if (!response.data.success) {
        // Handle rate limiting
        if (response.status === 429) {
          const cooldownMessage = response.data.cooldownUntil 
            ? `Try again in ${moment(response.data.cooldownUntil).diff(moment(), 'days')} days`
            : "Please wait before cancelling again";
          console.log('[3] Rate limited:', cooldownMessage);
          throw new Error(`${response.data.message} ${cooldownMessage}`);
        }
        
        // Handle other API errors
        console.log('[4] API returned unsuccessful response');
        throw new Error(response.data.message || "Failed to cancel friend request");
      }
  
      console.log('[5] Request cancelled successfully');
      return {
        ...response.data,
        recipientId, 
        remainingCancellations: response.data.remainingCancellations || 0
      };
  
    } catch (error) {
      console.error('[6] Cancel request failed:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        config: error.config
      });
  
      // Handle token expiration (401)
      if (error.response?.status === 401) {
        console.log('[7] Token expired, attempting refresh...');
        try {
          const newToken = await refreshToken();
          console.log('[8] Got new token, retrying...');
          
          // Retry with new token
          const retryResponse = await axios.post(
            `${API_URL}${API_ENDPOINTS.CANCEL_REQUEST}`,
            { requestId, recipientId },
            {
              headers: {
                Authorization: `Bearer ${newToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
  
          if (!retryResponse.data.success) {
            throw new Error(retryResponse.data.message || "Failed after token refresh");
          }
  
          console.log('[9] Retry succeeded after token refresh');
          return {
            ...retryResponse.data,
            recipientId,
            remainingCancellations: retryResponse.data.remainingCancellations || 0
          };
        } catch (refreshError) {
          console.error('[10] Token refresh failed:', refreshError);
          throw new Error("Session expired. Please login again.");
        }
      }
  
      // Handle network errors
      if (error.code === 'ECONNABORTED') {
        throw new Error("Request timeout. Please check your connection.");
      }
  
      // Handle other errors
      throw new Error(
        error.response?.data?.message || 
        error.message || 
        "Failed to cancel friend request"
      );
    }
};

export const getSentRequests = async (token) => {
    try {
        const response = await axios.get(`${API_URL}/friends/sent-requests`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error("Error getting sent requests:", error);
        throw error;
    }
};

export const fetchSentRequests = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }
  
      const response = await getSentRequests(token);
      
      // Verify response structure
      if (!response) {
        throw new Error("No response received");
      }
  
      // Handle different response structures
      const requests = response.requests || response.data?.requests || [];
      setSentRequests(requests);
      setSentCount(requests.length);
    } catch (error) {
      console.error("Sent requests error:", error);
      // Only show alert if it's not a 404 error
      if (error.response?.status !== 404) {
        showAlert("Error", error.message || "Failed to load sent requests");
      }
      // Set empty array if error occurs
      setSentRequests([]);
      setSentCount(0);
    }};