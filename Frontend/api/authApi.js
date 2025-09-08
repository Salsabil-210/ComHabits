import axios from "axios";
import { API_URL, API_ENDPOINTS } from "./apiConfig"; 
import AsyncStorage from '@react-native-async-storage/async-storage';

export const registerUser = async (name, surname, email, password) => {
  try {
    const response = await axios.post(
      `${API_URL}${API_ENDPOINTS.REGISTER}`, 
      { name, surname, email, password }
    );
    return response.data;
  } catch (error) {
    console.error("❌ Registration Error:", error.response?.data || error.message);
    throw error.response?.data || { message: "Registration failed" };
  }
};

export const loginUser = async (email, password) => {
  try {
    const response = await axios.post(
      `${API_URL}${API_ENDPOINTS.LOGIN}`, 
      { email, password }
    );

    // Save the token to AsyncStorage
    if (response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
      console.log("🔑 Token saved to AsyncStorage:", response.data.token);
    } else {
      console.error("❌ No token received from the server");
    }

    return response.data;
  } catch (error) {
    console.error("❌ Login Error:", error.response?.data || error.message);
    throw error.response?.data || { message: "Login failed" };
  }
};

export const forgotPassword = async (email) => {
  const response = await axios.post(`${API_URL}${API_ENDPOINTS.FORGOT_PASSWORD}`, { email });
  return response.data;
};

export const verifyResetCode = async (email, code) => {
  try {
    const response = await axios.post(
      `${API_URL}${API_ENDPOINTS.VERIFY_RESET_CODE}`,
      { email, code }
    );
    return response.data;
  } catch (error) {
    console.error("Verification error:", error.response?.data);
    const errorMessage = error.response?.data?.message || 
                       "Invalid or expired verification code";
    throw new Error(errorMessage);
  }
};

export const setNewPassword = async (email, code, newPassword) => {
  try {
    const response = await axios.post(
      `${API_URL}${API_ENDPOINTS.RESET_PASSWORD}`,
      { email, code, newPassword }
    );
    return response.data;
  } catch (error) {
    console.error("Password reset error:", error.response?.data);
    // Extract the detailed error message if available
    const errorMessage = error.response?.data?.message || 
                       "Failed to reset password. Please try again.";
    throw new Error(errorMessage);
  }
};

export const getUserProfile = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error("No token found");

    const response = await axios.get(`${API_URL}/me/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    return response.data.user; 
  } catch (error) {
    console.error("❌ Fetch Profile Error:", error.response?.data || error.message);
    throw error.response?.data || { message: "Failed to fetch profile" };
  }
};

export const logoutUser = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error("No token found");
    }

    const url = `${API_URL}${API_ENDPOINTS.LOGOUT}`;
    console.log("🔗 Logout URL:", url);

    const response = await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    await AsyncStorage.removeItem('token');
    return response.data;
  } catch (error) {
    console.error("❌ Logout Error:", error.response?.data || error.message);
    throw error.response?.data || { message: "Failed to logout" };
  }
};


