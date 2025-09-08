
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { logoutUser } from '../../api/authApi';
import { uploadProfilePicture, deleteProfilePicture } from '../../api/settingsApi';
import { changePassword, deleteAccount } from '../../api/settingsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_URL } from '../../api/apiConfig';

const MenuItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.item} onPress={onPress}>
    <MaterialIcons name={icon} size={24} color="black" style={styles.icon} />
    <Text style={styles.text}>{label}</Text>
  </TouchableOpacity>
);

const SettingsScreen = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [userData, setUserData] = useState({});
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Load user data and profile picture on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const storedUserData = await AsyncStorage.getItem('userData');
        if (storedUserData) {
          const user = JSON.parse(storedUserData);
          setUserData(user);

          if (user.profilePicture) {
            // Construct proper image URL
   const getProfileImageUrl = (profilePicture) => {
  if (!profilePicture) return 'https://via.placeholder.com/120';
  if (profilePicture.startsWith('http')) return profilePicture;
           let baseUrl = API_URL;
         if (baseUrl.endsWith('/api')) baseUrl = baseUrl.slice(0, -4);
            return `${baseUrl}${profilePicture}`;
          };
            setProfileImage(getProfileImageUrl(user.profilePicture));
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  const validateImageUrl = (url) => {
    if (!url) return 'https://via.placeholder.com/120';
    if (url.startsWith('http')) return url;
    let baseUrl = API_URL;
    if (baseUrl.endsWith('/api')) baseUrl = baseUrl.slice(0, -4);
    return `${baseUrl}${url}`;
  };

  const fixImageUrl = (url) => {
    if (!url) return 'https://via.placeholder.com/120';
    // Add any URL fixing logic here
    return url;
  };

  const pickImage = async () => {
    try {
      setIsLoading(true);

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable photo library access in settings');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const selectedAsset = result.assets[0];
      if (!selectedAsset?.uri) {
        throw new Error('No image selected');
      }

      // Upload the image
      const uploadResult = await uploadProfilePicture(selectedAsset.uri);
      
      if (uploadResult.success) {
        // Use the absolute URL from the server response
        const imageUrl = uploadResult.absoluteUrl || 
                       `${API_URL.replace('/api', '')}${uploadResult.profilePicture}`;
        
        setProfileImage(imageUrl);

        // Update userData in AsyncStorage
        const storedUserData = await AsyncStorage.getItem('userData');
        if (storedUserData) {
          const user = JSON.parse(storedUserData);
          user.profilePicture = uploadResult.profilePicture; // Store relative path
          await AsyncStorage.setItem('userData', JSON.stringify(user));
          setUserData(user);
        }

        Alert.alert('Success', 'Profile picture updated successfully');
      } else {
        throw new Error(uploadResult.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Image upload error:', error);
      Alert.alert('Error', error.message || 'Failed to update profile picture');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePicture = async () => {
    try {
      Alert.alert(
        'Delete Profile Picture',
        'Are you sure you want to delete your profile picture?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsLoading(true);
                const response = await deleteProfilePicture();
                if (!response?.success) {
                  throw new Error(response?.message || 'Failed to delete profile picture');
                }

                setProfileImage(null);

                const storedUserData = await AsyncStorage.getItem('userData');
                if (storedUserData) {
                  const user = JSON.parse(storedUserData);
                  user.profilePicture = null;
                  await AsyncStorage.setItem('userData', JSON.stringify(user));
                  setUserData(user);
                }

                Alert.alert('Success', 'Profile picture deleted successfully');
              } catch (error) {
                console.error('Delete profile picture error:', error);
                Alert.alert('Error', error.message || 'Failed to delete profile picture');
              } finally {
                setIsLoading(false);
              }
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'An error occurred while deleting the picture.');
    }
  };

  const handleLogout = async () => {
    try {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out',
            onPress: async () => {
              await logoutUser();
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('userData');
              router.push('/auth');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Logout Error:', error);
      Alert.alert('Error', error.message || 'Failed to logout.');
    }
  };

 const handleChangePassword = async () => {
  try {
    setIsPasswordLoading(true);
    const result = await changePassword(oldPassword, newPassword);
    
    if (result.success) {
      Alert.alert('Success', 'Password changed successfully.');
      setIsPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
    } else {
      throw new Error(result.message || 'Password change failed');
    }
  } catch (error) {
    console.error('Change password error:', error);
    Alert.alert('Error', error.message || 'Failed to change password.');
  } finally {
    setIsPasswordLoading(false);
  }
};

const handleDeleteAccount = async () => {
  try {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAccount();
              if (result.success) {
                await AsyncStorage.removeItem('token');
                await AsyncStorage.removeItem('userData');
                Alert.alert('Success', 'Account deleted successfully.');
                router.push('/auth');
              } else {
                throw new Error(result.message || 'Account deletion failed');
              }
            } catch (error) {
              console.error('Delete account error:', error);
              Alert.alert('Error', error.message || 'Failed to delete account.');
            }
          },
        },
      ],
      { cancelable: false }
    );
  } catch (error) {
    console.error('Error showing delete alert:', error);
  }
};

  const navigateToAccountInfo = () => {
    // Navigate to Account Information screen
    // You'll need to implement navigation to the AccountInformationScreen
    router.push('/AccountInformationScreen');
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileContainer}>
        <TouchableOpacity
          onPress={pickImage}
          onLongPress={handleDeletePicture}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={[styles.profilePic, styles.profilePlaceholder]}>
              <ActivityIndicator size="large" color="#900C3F" />
            </View>
          ) : profileImage ? (
            <Image
              source={{ 
                uri: validateImageUrl(profileImage),
                cache: 'force-cache',
                headers: {
                  'Accept': 'image/*',
                }
              }}
              style={styles.profilePic}
              onError={(e) => {
                console.error('Image loading error:', {
                  error: e.nativeEvent.error,
                  attemptedUrl: profileImage,
                  timestamp: new Date().toISOString()
                });
                
                const fixedUrl = fixImageUrl(profileImage);
                if (fixedUrl !== profileImage) {
                  console.log('Attempting fixed URL:', fixedUrl);
                  setProfileImage(fixedUrl);
                } else {
                  setProfileImage(null);
                }
              }}
              onLoad={() => console.log('Image loaded successfully')}
              onLoadStart={() => console.log('Starting image load')}
            />
          ) : (
            <View style={[styles.profilePic, styles.profilePlaceholder]}>
              <MaterialIcons name="person" size={40} color="#900C3F" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <MenuItem 
        icon="account-circle" 
        label="Account Information" 
        onPress={navigateToAccountInfo} 
      />
      <MenuItem icon="lock" label="Change Password" onPress={() => setIsPasswordModalVisible(true)} />
      <MenuItem icon="delete" label="Delete Account" onPress={handleDeleteAccount} />
      <MenuItem icon="logout" label="Log Out" onPress={handleLogout} />

      {/* Password Modal */}
      <Modal visible={isPasswordModalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter old password"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, isPasswordLoading && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={isPasswordLoading}
              >
                <Text style={styles.buttonText}>{isPasswordLoading ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsPasswordModalVisible(false)}
                disabled={isPasswordLoading}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  profilePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 15,
    borderRadius: 12,
    marginVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  icon: {
    marginRight: 12,
    color: '#4A4A4A',
  },
  text: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    backgroundColor: '#900C3F',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SettingsScreen;