import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { 
  registerUser, 
  loginUser, 
  forgotPassword, 
  verifyResetCode, 
  setNewPassword 
} from "../api/authApi";

const PRIMARY_COLOR = "#900C3F";
const SECONDARY_COLOR = "#F48FB1";
const TEXT_COLOR_PRIMARY = "#212121";
const TEXT_COLOR_SECONDARY = "#757575";
const BACKGROUND_COLOR = "white";

export default function AuthScreen() {
  const router = useRouter();
  const [screen, setScreen] = useState("login"); // 'login', 'signup', 'forgot', 'verify', 'reset'
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setSurname("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setResetCode("");
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const data = await loginUser(email, password);
      Alert.alert("Success", "Logged in successfully!");
      resetForm();
      router.push("/Home");
    } catch (error) {
      Alert.alert("Error", error.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      setIsLoading(true);
      await registerUser(name, surname, email, password);
      Alert.alert("Success", "Account created successfully!");
      resetForm();
      setScreen("login");
    } catch (error) {
      Alert.alert("Error", error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    try {
      setIsLoading(true);
      await forgotPassword(email);
      Alert.alert("Success", "Reset code sent to your email.");
      setScreen("verify");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to send reset code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setIsLoading(true);
      await verifyResetCode(email, resetCode);
      setScreen("reset");
    } catch (error) {
      Alert.alert("Error", error.message || "Invalid or expired code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }

    try {
      setIsLoading(true);
      await setNewPassword(email, resetCode, password);
      Alert.alert("Success", "Password reset successfully!");
      resetForm();
      setScreen("login");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const renderLoginScreen = () => (
    <>
      <Text style={styles.title}>ComHabit</Text>
      <Text style={styles.description}>"Build habits together, achieve more."</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="Password"
          secureTextEntry={!isPasswordVisible}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
          <Ionicons
            name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            size={20}
            color={TEXT_COLOR_SECONDARY}
          />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{isLoading ? "LOGGING IN..." : "LOG IN"}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => setScreen("forgot")} style={styles.linkContainer}>
        <Text style={styles.link}>Forgot Password?</Text>
      </TouchableOpacity>
      
      <View style={styles.bottomText}>
        <Text style={styles.text}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => setScreen("signup")}>
          <Text style={[styles.link, { fontWeight: "bold" }]}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignupScreen = () => (
    <>
      <Text style={styles.title}>Create Account</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput 
          placeholder="Name" 
          value={name} 
          onChangeText={setName} 
          style={styles.input} 
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput 
          placeholder="Surname" 
          value={surname} 
          onChangeText={setSurname} 
          style={styles.input} 
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="Password"
          secureTextEntry={!isPasswordVisible}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
          <Ionicons
            name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            size={20}
            color={TEXT_COLOR_SECONDARY}
          />
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleRegister}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{isLoading ? "CREATING ACCOUNT..." : "SIGN UP"}</Text>
      </TouchableOpacity>
      
      <View style={styles.bottomText}>
        <Text style={styles.text}>Already have an account? </Text>
        <TouchableOpacity onPress={() => setScreen("login")}>
          <Text style={[styles.link, { fontWeight: "bold" }]}>Log In</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderForgotPasswordScreen = () => (
    <>
      <TouchableOpacity onPress={() => setScreen("login")} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.description}>Enter your email to receive a verification code</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleSendResetCode}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{isLoading ? "SENDING..." : "SEND CODE"}</Text>
      </TouchableOpacity>
    </>
  );

  const renderVerifyCodeScreen = () => (
    <>
      <TouchableOpacity onPress={() => setScreen("forgot")} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      <Text style={styles.title}>Verify Code</Text>
      <Text style={styles.description}>Enter the 6-digit code sent to {email}</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="6-digit code"
          value={resetCode}
          onChangeText={setResetCode}
          style={styles.input}
          keyboardType="number-pad"
          maxLength={6}
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleVerifyCode}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{isLoading ? "VERIFYING..." : "VERIFY CODE"}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.linkContainer}>
        <Text style={styles.link}>Resend Code</Text>
      </TouchableOpacity>
    </>
  );

  const renderResetPasswordScreen = () => (
    <>
      <TouchableOpacity onPress={() => setScreen("verify")} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={PRIMARY_COLOR} />
      </TouchableOpacity>
      
      <Text style={styles.title}>New Password</Text>
      <Text style={styles.description}>Enter your new password (6-20 characters, must contain letters)</Text>
      
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="New Password"
          secureTextEntry={!isPasswordVisible}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <TouchableOpacity onPress={togglePasswordVisibility} style={styles.eyeIcon}>
          <Ionicons
            name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            size={20}
            color={TEXT_COLOR_SECONDARY}
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={TEXT_COLOR_SECONDARY} style={styles.icon} />
        <TextInput
          placeholder="Confirm Password"
          secureTextEntry={!isPasswordVisible}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
        />
      </View>
      
      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>{isLoading ? "RESETTING..." : "RESET PASSWORD"}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor={PRIMARY_COLOR} barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {screen === "login" && renderLoginScreen()}
          {screen === "signup" && renderSignupScreen()}
          {screen === "forgot" && renderForgotPasswordScreen()}
          {screen === "verify" && renderVerifyCodeScreen()}
          {screen === "reset" && renderResetPasswordScreen()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: PRIMARY_COLOR,
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    textAlign: "center",
    marginBottom: 30,
    fontSize: 16,
    color: TEXT_COLOR_SECONDARY,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: SECONDARY_COLOR,
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: "white",
    shadowColor: "white",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_COLOR_PRIMARY,
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "white",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  linkContainer: {
    marginVertical: 10,
    alignItems: "center",
  },
  link: {
    color: PRIMARY_COLOR,
    fontSize: 16,
  },
  bottomText: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: TEXT_COLOR_SECONDARY,
    fontSize: 16,
  },
});