import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socket from './socket';
import { useNavigation } from '@react-navigation/native';

// Background task setup
const BACKGROUND_FETCH_TASK = 'fetch-notifications';
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch('http://10.0.2.2:3000/api/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    
    if (data.notifications?.length > 0) {
      Notifications.setBadgeCountAsync(data.notifications.length);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const NotificationListener = ({ userId, onNewNotification }) => {
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);

  // Register push notifications and background fetch
  useEffect(() => {
    const setupNotifications = async () => {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // Register push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await fetch('http://10.0.2.2:3000/api/save-push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token })
      });

      // Configure notification handling
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Register background fetch
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true
      });
    };

    setupNotifications();
  }, [userId]);

  // Handle socket connections and notifications
  useEffect(() => {
    if (!userId) return;

    const handleNotification = (notification) => {
      console.log('Received real-time notification:', notification);
      onNewNotification?.(notification);
      updateBadgeCount();
    };

    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        socket.auth = { token };
        socket.connect();
        socket.on('new_notification', handleNotification);
      } catch (error) {
        console.error('Socket setup error:', error);
      }
    };

    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && 
          nextAppState === 'active') {
        setupSocket(); // Reconnect when app comes to foreground
      }
      appState.current = nextAppState;
    };

    setupSocket();
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      socket.off('new_notification', handleNotification);
      subscription.remove();
    };
  }, [userId, onNewNotification]);

  // Handle notification taps
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      navigation.navigate('Notifications');
    });

    return () => subscription.remove();
  }, [navigation]);

  // Update badge count
  const updateBadgeCount = async () => {
    if (Platform.OS === 'ios') {
      const response = await fetch('http://10.0.2.2:3000/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${await AsyncStorage.getItem('token')}` }
      });
      const { count } = await response.json();
      await Notifications.setBadgeCountAsync(count);
    }
  };

  return null;
};

export default NotificationListener;