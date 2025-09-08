import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { updateUser, getUserInfo } from '../api/settingsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const AccountInformationScreen = () => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const [emailError, setEmailError] = useState('');

  // Load user data on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setIsInitialLoading(true);
        
        // First try to get fresh data from server
        try {
          const result = await getUserInfo();
          if (result.success && result.user) {
            setName(result.user.name || '');
            setSurname(result.user.surname || '');
            setEmail(result.user.email || '');
          }
        } catch (serverError) {
          console.log('Falling back to local storage due to:', serverError);
          
          // Fall back to AsyncStorage if server fails
          const storedUserData = await AsyncStorage.getItem('userData');
          if (storedUserData) {
            const user = JSON.parse(storedUserData);
            setName(user.name || '');
            setSurname(user.surname || '');
            setEmail(user.email || '');
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load account information.');
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadUserData();
  }, []);

  const validateEmail = (email) => {
    if (!email.includes('@')) {
      setEmailError('Email must contain @ symbol');
      return false;
    }
    
    if (!email.toLowerCase().endsWith('.com')) {
      setEmailError('Email must end with .com');
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/;
    if (!emailRegex.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleSave = async () => {
  try {
    console.log('Attempting to save user data:', { name, surname, email });

    // Basic validation
    if (!name.trim()) {
      Alert.alert('Validation Error', 'First name is required.');
      return;
    }
    if (!surname.trim()) {
      Alert.alert('Validation Error', 'Last name is required.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Email is required.');
      return;
    }

    // Strict email validation
    if (!validateEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address ending with .com');
      return;
    }

    setIsLoading(true);
    console.log('Calling updateUser API');
    
    const result = await updateUser({
      name: name.trim(),
      surname: surname.trim(),
      email: email.trim().toLowerCase() // Ensure consistent case
    });
    
    console.log('Update API response:', result);
    
    if (result.success) {
      console.log('Update successful, updating local storage');
      // Update local storage with new data
      const storedUserData = await AsyncStorage.getItem('userData');
      if (storedUserData) {
        const user = JSON.parse(storedUserData);
        user.name = name.trim();
        user.surname = surname.trim();
        user.email = email.trim().toLowerCase();
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        console.log('Local storage updated');
      }

      Alert.alert('Success', 'Account information updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } else {
      console.log('Update failed:', result.message);
      throw new Error(result.message || 'Update failed. Please try again.');
    }
  } catch (error) {
    console.error('Update error:', {
      error: error.message,
      name,
      surname,
      email,
      fullError: error
    });
    Alert.alert('Update Error', error.message || 'Failed to update account information. Please check your details and try again.');
  } finally {
    setIsLoading(false);
  }
};

  const handleBack = () => {
    router.back();
  };

  if (isInitialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#900C3F" />
          <Text style={styles.loadingText}>Loading account information...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <View style={styles.backButtonContainer}>
            <MaterialIcons name="arrow-back" size={24} color="#900C3F" />
          </View>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Account Information</Text>
          <Text style={styles.subtitle}>Manage your personal details</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={40} color="#900C3F" />
            </View>
          </View>
          <Text style={styles.profileText}>Update your information</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              <MaterialIcons name="person-outline" size={16} color="#666" /> First Name
            </Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'name' && styles.inputFocused,
                !name.trim() && styles.inputError
              ]}
              placeholder="Enter your first name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              editable={!isLoading}
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              <MaterialIcons name="person-outline" size={16} color="#666" /> Last Name
            </Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'surname' && styles.inputFocused,
                !surname.trim() && styles.inputError
              ]}
              placeholder="Enter your last name"
              placeholderTextColor="#999"
              value={surname}
              onChangeText={setSurname}
              onFocus={() => setFocusedField('surname')}
              onBlur={() => setFocusedField(null)}
              editable={!isLoading}
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              <MaterialIcons name="email" size={16} color="#666" /> Email Address
            </Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'email' && styles.inputFocused,
                (!!emailError || !email.trim()) && styles.inputError
              ]}
              placeholder="Enter your email (must end with .com)"
              placeholderTextColor="#999"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) validateEmail(text); // Revalidate as user types
              }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => validateEmail(email)}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
            {!!emailError && (
              <Text style={styles.errorText}>
                <MaterialIcons name="error-outline" size={14} color="#FF3B30" /> {emailError}
              </Text>
            )}
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, (isLoading || !!emailError) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isLoading || !!emailError}
            activeOpacity={0.8}
          >
            <View style={styles.buttonContent}>
              {isLoading ? (
                <>
                  <ActivityIndicator size="small" color="white" style={styles.buttonLoader} />
                  <Text style={styles.saveButtonText}>Saving...</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="white" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingCard: {
    backgroundColor: '#F8F8F8',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: width * 0.8,
  },
  loadingText: {
    marginTop: 15,
    color: '#666',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 5,
  },
  backButtonContainer: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    padding: 5,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  profileSection: {
    alignItems: 'center',
    marginVertical: 25,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#666',
    fontSize: 14,
  },
  formContainer: {
    marginBottom: 25,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  inputFocused: {
    borderColor: '#900C3F',
    backgroundColor: '#FFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 5,
  },
  buttonContainer: {
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#900C3F',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonLoader: {
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AccountInformationScreen;