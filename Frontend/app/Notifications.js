import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from "react-native";
import { useNavigation } from '@react-navigation/native';
import { getNotifications, markNotificationAsRead, getUnreadCount, markAllAsRead, deleteNotification } from "../api/NotificationsApi";
import { acceptFriendRequest, rejectFriendRequest } from "../api/FriendsApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { API_URL } from "../api/apiConfig";

const Notifications = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const [notificationsResponse, countResponse] = await Promise.all([
        getNotifications(token),
        getUnreadCount(token),
      ]);

      if (notificationsResponse?.success) {
        const sortedNotifications = notificationsResponse.data.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setNotifications(sortedNotifications);
      }

      if (countResponse?.success) {
        setUnreadCount(countResponse.count || 0);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleMarkAsRead = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await markNotificationAsRead(id, token);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, status: 'read' } : n)
      );
      setUnreadCount(prev => prev > 0 ? prev - 1 : 0);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      Alert.alert("Error", "Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      await markAllAsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert("Error", "Failed to mark all notifications as read");
    }
  };

  const handleDeleteNotification = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await deleteNotification(id, token);
      if (response?.success) {
        setNotifications(prev => {
          const newUnreadCount = prev.filter(n => n._id !== id && n.status === 'unread').length;
          setUnreadCount(newUnreadCount);
          return prev.filter(n => n._id !== id);
        });
      } else {
        throw new Error(response?.message || "Failed to delete notification");
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      Alert.alert("Error", error.message);
    }
  };

  const handleAcceptFriendRequest = async (notification) => {
    try {
      if (!notification.relatedFriendRequestId) {
        Alert.alert("Error", "Friend request already actioned.");
        fetchData();
        return;
      }
      const token = await AsyncStorage.getItem('token');
      const response = await acceptFriendRequest(notification.relatedFriendRequestId, token);

      if (response?.success) {
        fetchData();
        Alert.alert("Success", "Friend request accepted");
      } else if (response?.status === 401) {
        Alert.alert("Session Expired", "Please log in again.");
        await AsyncStorage.removeItem('token');
        navigation.navigate('Login');
      } else {
        throw new Error(response?.message || "Failed to accept friend request");
      }
    } catch (err) {
      console.error("Error accepting friend request:", err);
      Alert.alert("Error", err.message);
    }
  };

  const handleRejectFriendRequest = async (notification) => {
    try {
      if (!notification.relatedFriendRequestId) {
        Alert.alert("Error", "Friend request already actioned.");
        fetchData();
        return;
      }
      const token = await AsyncStorage.getItem('token');
      const response = await rejectFriendRequest(notification.relatedFriendRequestId, token);

      if (response?.success) {
        fetchData();
        Alert.alert("Success", "Friend request rejected");
      } else {
        throw new Error(response?.message || "Failed to reject friend request");
      }
    } catch (err) {
      console.error("Error rejecting friend request:", err);
      Alert.alert("Error", err.message);
    }
  };

  const handleAcceptSharedHabit = async (item) => {
    try {
      const habitId = item.relatedHabitId?._id || item.relatedHabitId;
      if (!habitId) {
        Alert.alert("Error", "Shared habit request already actioned.");
        fetchData();
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_URL}/habits/shared/${habitId}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        fetchData();
        Alert.alert('Success', 'Habit accepted successfully!');
      }
    } catch (error) {
      console.error('Error accepting shared habit:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleRejectSharedHabit = async (item) => {
    try {
      const habitId = item.relatedHabitId?._id || item.relatedHabitId;
      if (!habitId) {
        Alert.alert("Error", "Shared habit request already actioned.");
        fetchData();
        return;
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_URL}/habits/shared/${habitId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        fetchData();
        Alert.alert('Success', 'Shared habit request rejected');
      }
    } catch (error) {
      console.error('Error rejecting shared habit:', error);
      Alert.alert('Error', error.message);
    }
  };

  const renderRightActions = (progress, dragX, item) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDeleteNotification(item._id)}
    >
      <MaterialIcons name="delete" size={24} color="#fff" />
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const isActionableRequest = 
      (item.type === 'habit_shared' && item.relatedHabitId) ||
      (item.type === 'friend_request' && item.relatedFriendRequestId);

    const showActionButtons = isActionableRequest && !item.metadata?.actionTaken;
    const isUnread = item.status === 'unread';
    const actionTaken = item.metadata?.actionTaken;
    const actionType = item.metadata?.actionType;

    return (
      <Swipeable
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
      >
        <TouchableOpacity
          style={[
            styles.notificationItem,
            isUnread && styles.unreadItem,
            actionTaken && styles.actionTakenItem
          ]}
          onPress={() => {
            if (!isActionableRequest && isUnread) {
              handleMarkAsRead(item._id);
            }
          }}
          activeOpacity={isActionableRequest ? 1 : 0.7}
        >
          {item.senderId?.profilePicture ? (
            <Image
              source={{ uri: item.senderId.profilePicture }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )}

          <View style={styles.notificationContent}>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>
              {format(new Date(item.createdAt), 'MMM d, h:mm a')}
            </Text>

            {showActionButtons ? (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => {
                    if (item.type === 'friend_request') {
                      handleAcceptFriendRequest(item);
                    } else if (item.type === 'habit_shared') {
                      handleAcceptSharedHabit(item);
                    }
                  }}
                >
                  <Text style={styles.actionButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => {
                    if (item.type === 'friend_request') {
                      handleRejectFriendRequest(item);
                    } else if (item.type === 'habit_shared') {
                      handleRejectSharedHabit(item);
                    }
                  }}
                >
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : actionTaken && (
              <View style={styles.actionStatusContainer}>
                <Text style={[
                  styles.actionStatusText,
                  actionType === 'accepted' ? styles.acceptedStatus : styles.rejectedStatus
                ]}>
                  {actionType === 'accepted' ? '✓ Accepted' : '✗ Declined'}
                </Text>
                <Text style={styles.actionStatusTime}>
                  {format(new Date(item.metadata.timestamp), 'h:mm a')}
                </Text>
              </View>
            )}
          </View>

          {isUnread && <View style={styles.unreadBadge} />}
        </TouchableOpacity>
      </Swipeable>
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchData();
    });

    fetchData();
    return unsubscribe;
  }, [navigation]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllAsRead}>
                <Text style={styles.markAllText}>Mark all as read</Text>
              </TouchableOpacity>
            )}
            {unreadCount > 0 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B1E42" />
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#8B1E42"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="notifications-off" size={50} color="#ccc" />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            }
            contentContainerStyle={notifications.length === 0 && styles.emptyList}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllText: {
    color: '#8B1E42',
    fontSize: 14,
    marginRight: 10,
  },
  unreadCountBadge: {
    backgroundColor: '#8B1E42',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  unreadItem: {
    backgroundColor: '#f9f2f5',
  },
  actionTakenItem: {
    backgroundColor: '#f5f5f5',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#8B1E42',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B1E42',
    marginLeft: 10,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  acceptedStatus: {
    color: '#4CAF50',
  },
  rejectedStatus: {
    color: '#F44336',
  },
  actionStatusTime: {
    fontSize: 12,
    color: '#888',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 10,
    color: '#888',
    fontSize: 16,
  },
  emptyList: {
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: '100%',
  },
});

export default Notifications;