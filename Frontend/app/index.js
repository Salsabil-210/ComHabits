import { useRouter } from "expo-router";
import { useEffect } from "react";
import { getCurrentUser } from "../api/authApi"; 

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        if (typeof getCurrentUser !== 'function') {
          throw new Error('getCurrentUser is not a function');
        }
        
        const user = await getCurrentUser();
        router.replace(user ? "/home" : "/auth");
      } catch (error) {
        console.error("Error checking auth status:", error);
        router.replace("/auth");
      }
    };

    const timeout = setTimeout(checkAuthStatus, 100);
    return () => clearTimeout(timeout);
  }, []);

  return null;
}