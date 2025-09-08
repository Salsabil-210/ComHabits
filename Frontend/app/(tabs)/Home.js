import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons, Feather, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSameDay, format, startOfDay, endOfDay, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { fetchHabits, updateHabit, deleteHabit, trackHabit, fetchHabitsByDateRange, deleteOccurrence } from '../../api/HabitApi';
import { getUserProfile } from '../../api/authApi';
import { API_URL } from '../../api/apiConfig';
import { getUnreadCount } from '../../api/NotificationsApi';
import { fetchSharedHabits, trackSharedHabit, deleteSharedHabit } from '../../api/SharedHabitsApi';
import { getProfilePicture } from '../../api/settingsApi';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRIMARY_COLOR = '#822445';
const ACCENT_COLOR = '#C75B7B';
const BACKGROUND_COLOR = '#F9F9F9';
const TEXT_COLOR_DARK = '#333333';
const TEXT_COLOR_LIGHT = '#666666';
const BORDER_COLOR = '#E0E0E0';
const SHADOW_COLOR = '#000000';

const Homescreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [selectedCategory, setSelectedCategory] = useState('My habits');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dates, setDates] = useState([]);
  const [habits, setHabits] = useState([]);
  const [pendingSharedHabits, setPendingSharedHabits] = useState([]);
  const [acceptedSharedHabits, setAcceptedSharedHabits] = useState([]);
  const [username, setUsername] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState('today');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profilePicUri, setProfilePicUri] = useState(null);

  const fetchProfilePicture = async () => {
    try {
      const result = await getProfilePicture();
      if (result?.profilePicture) {
        setProfilePicUri(result.profilePicture);
      }
    } catch (error) {
      console.log('Error fetching profile picture:', error);
      setProfilePicUri(null);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const userData = await getUserProfile();
      
      let profilePicture = null;
      if (userData?.profilePicture) {
        profilePicture = userData.profilePicture.startsWith('http') 
          ? userData.profilePicture 
          : `${API_URL}${userData.profilePicture}`;
      }
      
      setUser({
        ...userData,
        profilePicture
      });
      
      setUsername(`${userData?.name || ''} ${userData?.surname || ''}`.trim() || 'User');
      await fetchProfilePicture();
    } catch (error) {
      console.error('Error fetching user profile:', error);
      Alert.alert('Error', 'Failed to fetch user profile. Please try again.');
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await getUnreadCount(token);
      setUnreadCount(response?.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchHabitsData = async () => {
    try {
      setLoading(true);
      const habitsData = await fetchHabits();
      const transformedHabits = (habitsData || [])
        .filter(habit => habit && habit._id)
        .map(habit => ({
          ...habit,
          id: habit._id,
        }));
      setHabits(transformedHabits);
    } catch (error) {
      console.error("Error fetching habits:", error);
      Alert.alert("Error", "Failed to fetch habits. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSharedHabitsData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      let currentUser = user;
      if (!currentUser) {
        currentUser = await getUserProfile();
        setUser(currentUser);
      }
      const currentUserId = currentUser._id?.toString();

      const response = await fetch(`${API_URL}/habits/shared`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch shared habits');

      const data = await response.json();

      const pendingHabits = [];
      const acceptedHabits = [];

      data.sharedHabits.forEach(habit => {
        const isOwner = habit.userId._id.toString() === currentUserId;

        if (!isOwner && habit.sharedWith.some(
          entry => entry.userId._id.toString() === currentUserId && entry.status === "pending"
        )) {
          pendingHabits.push({
            ...habit,
            isPendingRequest: true,
            owner: habit.userId
          });
        }

        if (habit.status === "active") {
          if (isOwner) {
            habit.sharedWith.forEach(entry => {
              if (entry.status === "accepted") {
                acceptedHabits.push({
                  ...habit,
                  isOwner: true,
                  participant: entry.userId,
                  completionStatus: habit.completionStatus || []
                });
              }
            });
          } else {
            const sharedEntry = habit.sharedWith.find(
              entry => entry.userId._id.toString() === currentUserId && entry.status === "accepted"
            );
            if (sharedEntry) {
              acceptedHabits.push({
                ...habit,
                isOwner: false,
                owner: habit.userId,
                completionStatus: habit.completionStatus || []
              });
            }
          }
        }
      });

      setPendingSharedHabits(pendingHabits);
      setAcceptedSharedHabits(acceptedHabits);
    } catch (error) {
      console.error("Shared habits error:", error);
      setPendingSharedHabits([]);
      setAcceptedSharedHabits([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUserProfile(), 
      fetchHabitsData(),
      fetchSharedHabitsData(),
      fetchUnreadNotifications(),
      fetchProfilePicture()
    ]);
  };

  const handleTrackSharedHabit = async (habitId, completed, date) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_URL}/habits/shared/${habitId}/track`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ completed, date })
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.message || "Failed to track habit");
      }
      await fetchUserProfile();
      await fetchSharedHabitsData();
    } catch (error) {
      console.error("Track shared habit error:", error);
      Alert.alert('Error', error?.message || 'Failed to track habit');
    }
  };

  const applyDateFilter = async (range) => {
    setDateFilter(range);
    setShowDateFilter(false);
    const today = new Date();
    let startDate, endDate;
    switch (range) {
      case 'today':
        startDate = startOfDay(today);
        endDate = endOfDay(today);
        break;
      case 'week':
        startDate = subWeeks(startOfDay(today), 1);
        endDate = endOfDay(today);
        break;
      case 'month':
        startDate = subMonths(startOfDay(today), 1);
        endDate = endOfDay(today);
        break;
      case 'year':
        startDate = subYears(startOfDay(today), 1);
        endDate = endOfDay(today);
        break;
      default:
        startDate = startOfDay(today);
        endDate = endOfDay(today);
    }
    try {
      const habitsData = await fetchHabitsByDateRange(
        startDate.toISOString(),
        endDate.toISOString()
      );
      router.push({
        pathname: '/LastHabits',
        params: {
          habits: JSON.stringify(habitsData),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          filterType: range
        }
      });
    } catch (error) {
      console.error('Filter error:', error);
      Alert.alert('Error', error.message || 'Failed to load habits');
    }
  };

  const changeWeek = (direction) => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + direction * 7);
      return newDate;
    });
  };

  const handleClose = async (habit) => {
    if (!habit?.id) {
      Alert.alert('Error', 'Habit ID is undefined.');
      return;
    }
    const currentDate = new Date(selectedDate);
    currentDate.setHours(0, 0, 0, 0);
    const habitStartDate = new Date(habit.startDate);
    habitStartDate.setHours(0, 0, 0, 0);

    const isRepeatingHabit = habit.repeat && habit.repeatDates?.length > 0;
    const isStartDate = isSameDay(currentDate, habitStartDate);
    const deleteOnlyOccurrence = isRepeatingHabit && !isStartDate;

    if (deleteOnlyOccurrence) {
      Alert.alert(
        'Delete This Occurrence',
        `Are you sure you want to delete the habit occurrence for ${currentDate.toDateString()}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteOccurrence(habit.id, currentDate.toISOString());
                Alert.alert('Success', 'Occurrence deleted successfully!');
                await fetchHabitsData();
              } catch (error) {
                Alert.alert('Error', error.message || 'Failed to delete occurrence');
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Delete Entire Habit',
        'Are you sure you want to delete this entire habit and ALL its occurrences?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteHabit(habit.id);
                Alert.alert('Deleted', 'Habit deleted successfully!');
                await fetchHabitsData();
              } catch (error) {
                Alert.alert('Error', error.message || 'Failed to delete habit');
              }
            }
          }
        ]
      );
    }
  };

  const handleDone = async (id) => {
    if (!id) {
      Alert.alert('Error', 'Habit ID is undefined.');
      return;
    }
    try {
      const habitIndex = habits.findIndex(h => h?.id === id);
      if (habitIndex === -1) {
        Alert.alert('Error', 'Habit not found.');
        return;
      }
      const habit = habits[habitIndex];
      const targetDate = new Date(selectedDate);
      targetDate.setHours(0, 0, 0, 0);
      const isTracked = habit?.completionDates?.some(date => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === targetDate.getTime();
      }) || false;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const response = await trackHabit(id, !isTracked);
      if (response?.habit) {
        const updatedCompletionDates = !isTracked
          ? [...(habit.completionDates || []), targetDate.toISOString()]
          : (habit.completionDates || []).filter(date => {
              const d = new Date(date);
              d.setHours(0, 0, 0, 0);
              return d.getTime() !== targetDate.getTime();
            });
        const updatedHabits = habits.map(h =>
          h?.id === id ? { ...h, completionDates: updatedCompletionDates } : h
        );
        setHabits(updatedHabits);
      }
    } catch (error) {
      console.error('Tracking error:', error);
      Alert.alert('Error', error.message || 'Failed to track habit. Please try again.');
    }
  };

  const handleEdit = (id) => {
    try {
      const habitToEdit = habits.find(habit => habit?.id === id);
      if (habitToEdit) {
        router.push({
          pathname: '/EditHabitScreen',
          params: { habit: JSON.stringify(habitToEdit) },
        });
      }
    } catch (error) {
      console.error("Error navigating to edit screen:", error);
      Alert.alert('Error', 'Failed to navigate to edit screen. Please try again.');
    }
  };

  const handleDeleteSharedHabit = async (habitId) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this shared habit?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSharedHabit(habitId);
              setAcceptedSharedHabits(prev => prev.filter(h => h?._id !== habitId));
              Alert.alert('Deleted', 'Shared habit has been deleted.');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete shared habit.');
            }
          }
        }
      ]
    );
  };

  const renderHabits = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      );
    }

    const currentDate = new Date(selectedDate);
    currentDate.setHours(0, 0, 0, 0);

    if (selectedCategory === 'My habits') {
      const filteredHabits = habits.filter(habit => {
        if (!habit?.startDate) return false;
        if (habit?.repeatDates?.length > 0) {
          return habit.repeatDates.some(date =>
            isSameDay(new Date(date), currentDate)
          );
        }
        const habitStart = new Date(habit.startDate);
        habitStart.setHours(0, 0, 0, 0);
        if (currentDate < habitStart && !isSameDay(currentDate, habitStart)) {
          return false;
        }
        if (habit?.endDate) {
          const habitEnd = new Date(habit.endDate);
          habitEnd.setHours(23, 59, 59, 999);
          if (currentDate > habitEnd) {
            return false;
          }
        }
        return true;
      });

      if (!filteredHabits?.length) {
        return <Text style={styles.noHabitsText}>No habits found for this date.</Text>;
      }

      return filteredHabits.map((habit, index) => {
        const isCompleted = habit?.completionDates?.some(date => {
          const completionDate = new Date(date);
          completionDate.setHours(0, 0, 0, 0);
          return isSameDay(completionDate, currentDate);
        }) || false;

        return (
          <View key={`${habit?.id}-${index}`} style={[styles.card, isCompleted && styles.completedCard]}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleClose(habit)}
            >
              <AntDesign name="closecircle" size={24} color="#F564A9" />
            </TouchableOpacity>

            <Text style={[styles.habitName, isCompleted && styles.strikethrough]}>
              {habit?.name || 'Unnamed Habit'}
            </Text>
            <Text style={[styles.habitDescription, isCompleted && styles.strikethrough]}>
              {habit?.description || 'No description'}
            </Text>
            <Text style={[styles.statusText, { color: isCompleted ? PRIMARY_COLOR : TEXT_COLOR_LIGHT }]}>
              {isCompleted ? 'Completed!' : 'Uncompleted...'}
            </Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, isCompleted ? styles.untrackButton : styles.trackButton]}
                onPress={() => handleDone(habit?.id)}
              >
                <Text style={styles.actionButtonText}>{isCompleted ? 'UnComplete' : 'Done'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={() => handleEdit(habit?.id)}
              >
                <Text style={styles.actionButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      });
    } else if (selectedCategory === 'With friends') {
      // Filter shared habits based on date
      const filteredPendingHabits = pendingSharedHabits.filter(habit => {
      if (!habit?.startDate) return false;
  
      const habitStart = new Date(habit.startDate);
      habitStart.setHours(0, 0, 0, 0);
  
      if (habit?.repeatDates?.length > 0) {
      return habit.repeatDates.some(date => 
      isSameDay(new Date(date), currentDate)
    );
  }
  
  return isSameDay(currentDate, habitStart);
});

    const filteredAcceptedHabits = acceptedSharedHabits.filter(habit => {
    if (!habit?.startDate) return false;
  
  const habitStart = new Date(habit.startDate);
  habitStart.setHours(0, 0, 0, 0);
  
  // If habit has repeat dates, check if current date is in repeat dates
  if (habit?.repeatDates?.length > 0) {
    return habit.repeatDates.some(date => 
      isSameDay(new Date(date), currentDate)
    );
  }
  
  // If no repeat dates, only show on start date
    return isSameDay(currentDate, habitStart);
   });

      return (
        <>
          {filteredPendingHabits?.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Pending Requests</Text>
              {filteredPendingHabits.map((habit, index) => (
                <View key={`pending-${habit?._id}-${index}`} style={styles.sharedHabitCard}>
                  <View style={styles.sharedHabitHeader}>
                    <Image
                      source={{
                        uri: habit?.userId?.profilePicture
                          ? `${API_URL}${habit.userId.profilePicture}`
                          : 'https://via.placeholder.com/50'
                      }}
                      style={styles.sharedHabitProfileImage}
                    />
                    <Text style={styles.sharedHabitName}>{habit?.userId?.name || 'Unknown User'}</Text>
                  </View>
                  <Text style={styles.sharedHabitTitle}>{habit?.name || 'Unnamed Habit'}</Text>
                  <Text style={styles.sharedHabitDescription}>{habit?.description || 'No description'}</Text>
                  <View style={styles.sharedHabitStatus}>
                    <Text style={styles.statusText}>Pending approval</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {filteredAcceptedHabits?.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Shared with Friends</Text>
              {filteredAcceptedHabits.map((habit, index) => {
                const currentUserId = user?._id?.toString();
                const isOwner = habit?.userId?._id?.toString() === currentUserId;
                
                const friend = isOwner ? 
                  habit.sharedWith.find(entry => entry.status === "accepted")?.userId : 
                  habit.userId;

                const allCompletions = habit?.completionStatus || [];
                
                const userCompleted = allCompletions.some(status => {
                  const statusUserId = status.userId?._id?.toString() || status.userId?.toString();
                  return statusUserId === currentUserId && 
                         isSameDay(new Date(status.date), currentDate) && 
                         status.status === "complete";
                });

                const friendCompleted = allCompletions.some(status => {
                  const statusUserId = status.userId?._id?.toString() || status.userId?.toString();
                  const friendId = friend?._id?.toString() || friend?.toString();
                  return statusUserId === friendId && 
                         isSameDay(new Date(status.date), currentDate) && 
                         status.status === "complete";
                });

                return (
                  <View key={`accepted-${habit?._id}-${index}`} style={[styles.sharedHabitCard, userCompleted && styles.completedSharedHabitCard]}>
                    <View style={styles.sharedHabitHeader}>
                      <Image
                        source={{
                          uri: friend?.profilePicture
                            ? `${API_URL}${friend.profilePicture}`
                            : 'https://via.placeholder.com/50'
                        }}
                        style={styles.sharedHabitProfileImage}
                      />
                      <Text style={styles.sharedHabitName}>
                        {isOwner
                          ? `Shared with ${friend?.name || 'Friend'}`
                          : `Shared by ${habit?.userId?.name || 'Friend'}`}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteSharedHabit(habit?._id)}
                      >
                        <MaterialCommunityIcons name="delete" size={24} color="#ff0000" />
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.sharedHabitTitle}>{habit?.habit?.name || habit?.name || 'Unnamed Habit'}</Text>
                    <Text style={styles.sharedHabitDescription}>{habit?.habit?.description || habit?.description || 'No description'}</Text>
                    
                    <View style={styles.progressContainer}>
                      <View style={styles.progressItem}>
                        <Text style={styles.progressLabel}>Your progress:</Text>
                        <View style={styles.progressStatus}>
                          <Text style={[styles.statusText, { color: userCompleted ? PRIMARY_COLOR : TEXT_COLOR_LIGHT }]}>
                            {userCompleted ? 'Completed!' : 'Not completed'}
                          </Text>
                          {userCompleted ? (
                            <MaterialIcons name="check-circle" size={20} color={PRIMARY_COLOR} />
                          ) : (
                            <MaterialIcons name="radio-button-unchecked" size={20} color={TEXT_COLOR_LIGHT} />
                          )}
                        </View>
                      </View>

                      <View style={styles.progressItem}>
                        <Text style={styles.progressLabel}>
                          {isOwner ? "Friend's progress:" : "Owner's progress:"}
                        </Text>
                        <View style={styles.progressStatus}>
                          <Text style={[styles.statusText, { color: friendCompleted ? PRIMARY_COLOR : TEXT_COLOR_LIGHT }]}>
                            {friendCompleted ? 'Completed!' : 'Not completed'}
                          </Text>
                          {friendCompleted ? (
                            <MaterialIcons name="check-circle" size={20} color={PRIMARY_COLOR} />
                          ) : (
                            <MaterialIcons name="radio-button-unchecked" size={20} color={TEXT_COLOR_LIGHT} />
                          )}
                        </View>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.sharedHabitButton, userCompleted ? styles.untrackButton : styles.trackButton]}
                      onPress={() => handleTrackSharedHabit(habit?._id, !userCompleted, currentDate.toISOString())}
                    >
                      <Text style={styles.sharedHabitButtonText}>
                        {userCompleted ? 'Uncomplete' : 'Complete'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}

          {!filteredPendingHabits?.length && !filteredAcceptedHabits?.length && (
            <Text style={styles.noHabitsText}>No shared habits found for this date.</Text>
          )}
        </>
      );
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchUserProfile();
        await fetchHabitsData();
        await fetchUnreadNotifications();
        await fetchProfilePicture();
      } catch (error) {
        console.error('Initial load error:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSharedHabitsData();
    }
  }, [user]);

  useEffect(() => {
    if (params.newHabit) {
      fetchHabitsData();
      fetchSharedHabitsData();
    }
  }, [params.newHabit]);

  useEffect(() => {
    const generateDates = (baseDate) => {
      const newDates = [];
      for (let i = -3; i <= 3; i++) {
        const newDate = new Date(baseDate);
        newDate.setDate(baseDate.getDate() + i);
        newDates.push(newDate);
      }
      return newDates;
    };
    setDates(generateDates(selectedDate));
  }, [selectedDate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BACKGROUND_COLOR }}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            <Text style={{ color: TEXT_COLOR_DARK }}>Com</Text>
            <Text style={{ color: PRIMARY_COLOR }}>Habit</Text>
          </Text>
          <View style={styles.notificationContainer}>
            <TouchableOpacity onPress={() => router.push('/Notifications')}>
              <Feather name="bell" size={37} color={TEXT_COLOR_DARK} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Image
            source={{
              uri: profilePicUri || user?.profilePicture || 'https://via.placeholder.com/50',
              cache: 'force-cache'
            }}
            style={styles.profileImage}
            onError={(e) => {
              console.log('Failed to load profile image:', e.nativeEvent.error);
              setProfilePicUri(null);
            }}
          />
          <View>
            <Text style={styles.greeting}>Hi, {username || 'User'}</Text>
            <Text style={styles.date}>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</Text>
          </View>
        </View>

        {/* Calendar Navigation */}
        <View style={styles.calendarNavigation}>
          <TouchableOpacity onPress={() => changeWeek(-1)}>
            <MaterialIcons name="chevron-left" size={30} color={PRIMARY_COLOR} />
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendar}>
            {dates.map((date, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.day, isSameDay(date, selectedDate) && styles.selectedDay]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={styles.monthText}>{format(date, 'EEE')}</Text>
                <Text style={[styles.dateText, isSameDay(date, selectedDate) && styles.selectedDateText]}>
                  {date.getDate()}
                </Text>
                <Text style={styles.monthShort}>{format(date, 'MMM')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => changeWeek(1)}>
            <MaterialIcons name="chevron-right" size={30} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Date Filter */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowDateFilter(!showDateFilter)}
          >
            <Text style={styles.filterButtonText}>
              {dateFilter === 'today' ? 'Today' :
                dateFilter === 'week' ? 'Last Week' :
                  dateFilter === 'month' ? 'Last Month' :
                    'Last Year'}
            </Text>
            <Feather name={showDateFilter ? "chevron-up" : "chevron-down"} size={18} color={PRIMARY_COLOR} />
          </TouchableOpacity>

         {showDateFilter && (
  <View style={styles.filterDropdown}>
    <TouchableOpacity
      style={styles.filterOption}
      onPress={() => applyDateFilter('today')}
    >
      <Text style={styles.filterOptionText}>Today</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.filterOption}
      onPress={() => applyDateFilter('week')}
    >
      <Text style={styles.filterOptionText}>Last Week</Text>
    </TouchableOpacity>
    {/* Removed Last Month and Last Year options */}
  </View>
)}
        </View>

        {/* Category toggle */}
        <View style={styles.categoryToggle}>
          {['My habits', 'With friends'].map(category => (
            <TouchableOpacity
              key={category}
              style={[styles.categoryButton, selectedCategory === category && styles.activeCategory]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryText, selectedCategory === category && styles.activeCategoryText]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Habits list */}
        <ScrollView
          style={styles.habitsList}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[PRIMARY_COLOR]}
              tintColor={PRIMARY_COLOR}
            />
          }
        >
          {renderHabits()}
        </ScrollView>

        {/* Add habit button */}
        <View style={styles.bottomContainer}>
          {selectedCategory === 'With friends' ? (
            <TouchableOpacity
              style={styles.addButtonMain}
              onPress={() => router.push('/AddSharedHabit')}
            >
              <Text style={styles.addButtonText}>Share Habit</Text>
              <Feather name="plus" size={20} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addButtonMain}
              onPress={() => router.push('/AddHabitScreen')}
            >
              <Text style={styles.addButtonText}>Add habit</Text>
              <Feather name="plus" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 29,
    fontWeight: '800',
  },
  notificationContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 40,
    marginRight: 20,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#E0E0E0',
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: TEXT_COLOR_DARK,
  },
  date: {
    fontSize: 16,
    color: TEXT_COLOR_LIGHT,
  },
  calendarNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  calendar: {
    flexDirection: 'row',
    flex: 1,
  },
  day: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 35,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    width: 70,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedDay: {
    backgroundColor: PRIMARY_COLOR,
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR_DARK,
  },
  selectedDateText: {
    color: 'white',
  },
  monthText: {
    fontSize: 12,
    color: TEXT_COLOR_LIGHT,
    textAlign: 'center',
    marginBottom: 4,
  },
  monthShort: {
    fontSize: 12,
    color: TEXT_COLOR_LIGHT,
    textAlign: 'center',
    marginTop: 4,
  },
  filterContainer: {
    position: 'relative',
    marginBottom: 20,
    marginLeft: 5,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 15,
    marginRight: 8,
    fontWeight: '600',
  },
  filterDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    width: 160,
  },
  filterOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  filterOptionText: {
    fontSize: 15,
    color: TEXT_COLOR_DARK,
  },
  categoryToggle: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 20,
    marginLeft: 5,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#EAEAEA',
  },
  activeCategory: {
    backgroundColor: PRIMARY_COLOR,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR_DARK,
  },
  activeCategoryText: {
    color: 'white',
  },
  habitsList: {
    flex: 1,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    width: '100%',
    minHeight: 160,
    position: 'relative',
  },
  completedCard: {
    backgroundColor: '#F0F8F0',
    borderColor: PRIMARY_COLOR,
  },
  deleteButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 10,
  },
  habitName: {
    color: PRIMARY_COLOR,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  habitDescription: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_COLOR_DARK,
    marginBottom: 8,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
    textDecorationColor: ACCENT_COLOR,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 'auto',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'flex-end',
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  trackButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  untrackButton: {
    backgroundColor: ACCENT_COLOR,
  },
  editButton: {
    backgroundColor: TEXT_COLOR_LIGHT,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  bottomContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'flex-end',
  },
  addButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 18,
    marginRight: 10,
    fontWeight: 'bold',
  },
  noHabitsText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 18,
    color: TEXT_COLOR_LIGHT,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  sharedHabitCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  completedSharedHabitCard: {
    backgroundColor: '#F0F8F0',
    borderColor: PRIMARY_COLOR,
  },
  sharedHabitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sharedHabitProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  sharedHabitName: {
    fontSize: 19,
    fontWeight: '600',
    color: TEXT_COLOR_DARK,
    flex: 1,
  },
  sharedHabitTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginBottom: 8,
  },
  sharedHabitDescription: {
    fontSize: 14,
    color: TEXT_COLOR_LIGHT,
    marginBottom: 12,
  },
  sharedHabitStatus: {
    marginVertical: 8,
  },
  sharedHabitButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  sharedHabitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    marginTop: 25,
    marginBottom: 12,
    marginLeft: 5,
  },
  progressContainer: {
    marginVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR_DARK,
  },
  progressStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default Homescreen;