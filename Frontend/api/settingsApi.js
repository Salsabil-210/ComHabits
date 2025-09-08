import { API_URL, API_ENDPOINTS } from './apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper function to create FormData
const createFormData = (photo) => {
  const data = new FormData();
  
  // Extract file name from URI
  let filename = photo.uri.split('/').pop();
  
  // Infer the type of the image
  let match = /\.(\w+)$/.exec(filename);
  let type = match ? `image/${match[1]}` : 'image';

  // Append the file data
  data.append('profilePicture', {
    uri: photo.uri,
    name: filename,
    type
  });

  return data;
};

export const uploadProfilePicture = async (imageUri) => {
  try {
    // 1. Get authentication token
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication token not found');
    }

    // 2. Prepare FormData with proper file structure
    const formData = new FormData();
    
    // Extract file extension from URI
    let fileExt = 'jpg';
    if (imageUri.includes('.')) {
      fileExt = imageUri.split('.').pop().toLowerCase();
    }
    
    // Determine MIME type based on extension
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mimeType = mimeTypes[fileExt] || 'image/jpeg';

    // Append the file data
    formData.append('profilePicture', {
      uri: imageUri,
      type: mimeType,
      name: `profile-${Date.now()}.${fileExt}`
    });

    console.log('Attempting upload to:', `${API_URL}/settings/profile-picture`);
    console.log('FormData contents:', formData);

    // 3. Make the API request
    const response = await fetch(`${API_URL}/settings/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Note: Don't set Content-Type header manually for FormData
        // React Native will set it automatically with the correct boundary
      },
      body: formData,
    });

    console.log('Upload response status:', response.status);

    // 4. Handle response
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = 'Upload failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        console.warn('Failed to parse error response:', e);
      }
      throw new Error(errorMessage);
    }

    // 5. Process successful response
    const responseData = await response.json();
    console.log('Upload successful:', responseData);

    if (!responseData.success) {
      throw new Error(responseData.message || 'Upload failed');
    }

    // 6. Return the complete image URL
    return {
      ...responseData,
      profilePicture: responseData.profilePicture.startsWith('http')
        ? responseData.profilePicture
        : `${API_URL}${responseData.profilePicture}`
    };

  } catch (error) {
    console.error('Profile picture upload error:', {
      error: error.message,
      stack: error.stack,
      imageUri
    });
    
    throw new Error(error.message || 'Failed to upload profile picture');
  }
};

// Helper function to get MIME type
const getMimeType = (ext) => {
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return types[ext.toLowerCase()] || 'image/jpeg';
};

export const updateUser = async (name, surname, email) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name, surname, email }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid server response');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update user information');
    }

    // Update AsyncStorage with new user data
    if (data.success && data.user) {
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
    }

    return data;
  } catch (error) {
    console.error('Error updating user:', {
      error: error.message,
      name,
      surname,
      email
    });
    throw error;
  }
};

export const changePassword = async (oldPassword, newPassword) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid server response');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to change password');
    }

    return data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export const deleteAccount = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/delete-account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', responseText);
      throw new Error('Invalid server response');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete account');
    }

    return data;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};

export const deleteProfilePicture = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${API_URL}${API_ENDPOINTS.DELETE_PROFILE_PICTURE}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to delete profile picture');
    }

    return await response.json();
  } catch (error) {
    console.error('Delete profile picture error:', error);
    throw error;
  }
};

export const getProfilePicture = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${API_URL}${API_ENDPOINTS.GET_PROFILE_PICTURE}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch profile picture');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'No profile picture found');
    }

    // Construct proper URL
    let imageUrl = result.profilePicture;
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = `${API_URL.replace('/api', '')}${imageUrl}`;
    }

    return {
      ...result,
      profilePicture: imageUrl
    };
  } catch (error) {
    console.error('Get profile picture error:', error);
    throw error;
  }
};

// Add this new function
export const getUserInfo = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${API_URL}/settings/user-info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch user information');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting user info:', error);
    throw error;
  }
};

