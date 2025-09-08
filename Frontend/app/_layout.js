import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="auth" options={{ title: "Login" }} />
      <Stack.Screen name="auth/signup" options={{ title: "Sign Up" }} />
      <Stack.Screen name="auth/forgot-password" options={{ title: "Forgot Password" }} />
      <Stack.Screen name="Home" options={{ title: "Home" }} />
      <Stack.Screen name="AddHabitScreen" options={{ title: "Add Habit" }} />
      <Stack.Screen name="TodayScreen" options={{ title: "Today" }} /> 
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}