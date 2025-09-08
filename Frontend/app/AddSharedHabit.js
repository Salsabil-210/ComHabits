import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from "react-native";
import {
  Icon,
  Button,
  Card,
  HelperText,
  IconButton,
  TextInput as PaperInput,
} from "react-native-paper";
import { useRouter } from "expo-router";
import { Calendar } from "react-native-calendars";
import { format, isSameDay, isBefore } from "date-fns";

import { getFriendsList } from "../api/FriendsApi";
import { createSharedHabitRequest } from "../api/SharedHabitsApi";

const AddSharedHabit = () => {
  const router = useRouter();

  // State variables
  const [habitName, setHabitName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsError, setFriendsError] = useState(null);
  const [creatingHabit, setCreatingHabit] = useState(false);

  const scrollViewRef = useRef(null);

  // Fetch friends function
  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    setFriendsError(null);
    try {
      const data = await getFriendsList();
      setFriends(data?.friends || data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
      setFriendsError(error.message || "Failed to load friends");
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Toggle friend selection - now enforces single selection
  const toggleFriendSelection = (friendId) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId) ? [] : [friendId] // Only allow one selected friend
    );
  };

  // Date handlers
  const handleStartDateSelect = (day) => {
    const selectedDate = new Date(day.dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isBefore(selectedDate, today) && !isSameDay(selectedDate, today)) {
      Alert.alert("Error", "Start date cannot be in the past!");
      return;
    }
    setDate(selectedDate);
    setShowStartCalendar(false);
  };

  // Scroll to top
  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Handle Save
  const handleSave = async () => {
    if (creatingHabit) return;
    setCreatingHabit(true);

    try {
      // Basic validations
      if (!habitName || habitName.length < 3) {
        Alert.alert("Error", "Habit name must be at least 3 characters!");
        setCreatingHabit(false);
        return;
      }

      if (!description) {
        Alert.alert("Error", "Description is required!");
        setCreatingHabit(false);
        return;
      }

      if (selectedFriends.length === 0) {
        Alert.alert(
          "Select a Friend", 
          "Please select 1 friend to share this habit with.",
          [{ text: "OK" }]
        );
        setCreatingHabit(false);
        return;
      }

      // Simplified data structure for shared habit
      const habitData = {
        name: habitName.trim(),
        description: description.trim(),
        recipient: selectedFriends[0],
        startDate: format(date, "yyyy-MM-dd")
      };

      console.log('Sending habit data:', habitData);

      // Make the API call
      const response = await createSharedHabitRequest(habitData);
      console.log('API Response:', response);

      if (response.success) {
        Alert.alert("Success", "Habit shared successfully!");
        router.push("/Home");
      } else {
        throw new Error(response.message || 'Failed to create shared habit');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert("Error", "Failed to share habit. Please try again.");
    } finally {
      setCreatingHabit(false);
    }
  };

  // Render
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
            style={styles.backButton}
            iconColor="#fff"
          />
          <Text style={styles.title}>Share Habit</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          onScroll={(e) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            setShowScrollButton(offsetY > 100);
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* Habit Details Card */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon source="text-box-outline" size={24} color="#900C3F" />
              <Text style={styles.cardTitle}>Habit Details</Text>
            </View>
            <Card.Content style={styles.cardContent}>
              <PaperInput
                label="What's your habit?"
                value={habitName}
                onChangeText={setHabitName}
                mode="outlined"
                style={styles.input}
                outlineColor="#E0E0E0"
                activeOutlineColor="#900C3F"
                theme={{ colors: { primary: "#900C3F" } }}
              />
              {habitName.length > 0 && habitName.length < 3 && (
                <HelperText type="error" style={styles.helperText}>
                  Habit name must be at least 3 characters
                </HelperText>
              )}
              
              <PaperInput
                label="Description..."
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textArea]}
                outlineColor="#E0E0E0"
                activeOutlineColor="#900C3F"
                theme={{ colors: { primary: "#900C3F" } }}
              />
              {!description && habitName.length > 0 && (
                <HelperText type="error" style={styles.helperText}>
                  Description is required
                </HelperText>
              )}
            </Card.Content>
          </Card>

          {/* Start Date Card */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon source="calendar-today" size={24} color="#900C3F" />
              <Text style={styles.cardTitle}>When to Start</Text>
            </View>
            <Card.Content style={styles.cardContent}>
              <TouchableOpacity
                style={styles.dateSelector}
                onPress={() => setShowStartCalendar(!showStartCalendar)}
              >
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>
                    {format(date, "EEEE, MMM d, yyyy")}
                  </Text>
                </View>
                <Icon 
                  source={showStartCalendar ? "chevron-up" : "chevron-down"} 
                  size={24} 
                  color="#900C3F" 
                />
              </TouchableOpacity>
              
              {showStartCalendar && (
                <View style={styles.calendarContainer}>
                  <Calendar
                    onDayPress={handleStartDateSelect}
                    minDate={format(new Date(), "yyyy-MM-dd")}
                    markedDates={{
                      [format(date, "yyyy-MM-dd")]: { 
                        selected: true, 
                        selectedColor: "#900C3F",
                        selectedTextColor: "#fff"
                      },
                    }}
                    theme={{
                      selectedDayBackgroundColor: "#900C3F",
                      selectedDayTextColor: "#fff",
                      todayTextColor: "#900C3F",
                      dayTextColor: "#2d4150",
                      textDisabledColor: "#d9e1e8",
                      arrowColor: "#900C3F",
                      monthTextColor: "#900C3F",
                      indicatorColor: "#900C3F",
                      textDayFontWeight: "500",
                      textMonthFontWeight: "bold",
                      textDayHeaderFontWeight: "600",
                    }}
                  />
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Share with Friends Card */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon source="account-multiple" size={24} color="#900C3F" />
              <Text style={styles.cardTitle}>Share With</Text>
            </View>
            <Card.Content style={styles.cardContent}>
              {loadingFriends ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#900C3F" />
                  <Text style={styles.loadingText}>Loading friends...</Text>
                </View>
              ) : friendsError ? (
                <View style={styles.errorContainer}>
                  <Icon source="alert-circle-outline" size={32} color="#FF5252" />
                  <Text style={styles.errorText}>{friendsError}</Text>
                  <Button
                    mode="contained"
                    onPress={() => router.replace("/auth")}
                    style={styles.loginButton}
                    buttonColor="#900C3F"
                  >
                    Login Again
                  </Button>
                </View>
              ) : friends.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon source="account-multiple-plus-outline" size={48} color="#BDBDBD" />
                  <Text style={styles.emptyTitle}>No Friends Yet</Text>
                  <Text style={styles.emptySubtext}>
                    Add some friends to start sharing habits together!
                  </Text>
                </View>
              ) : (
                <View style={styles.friendsGrid}>
                  {friends.map((friend) => (
                    <TouchableOpacity
                      key={friend._id}
                      style={[
                        styles.friendCard,
                        selectedFriends.includes(friend._id) && styles.selectedFriendCard,
                      ]}
                      onPress={() => toggleFriendSelection(friend._id)}
                    >
                      <View style={styles.friendAvatarContainer}>
                        {friend.profilePicture ? (
                          <Image
                            source={{ uri: friend.profilePicture }}
                            style={styles.friendAvatar}
                          />
                        ) : (
                          <View style={[
                            styles.friendInitials,
                            selectedFriends.includes(friend._id) && styles.selectedFriendInitials
                          ]}>
                            <Text style={[
                              styles.initialsText,
                              selectedFriends.includes(friend._id) && styles.selectedInitialsText
                            ]}>
                              {friend.name?.charAt(0)}{friend.surname?.charAt(0)}
                            </Text>
                          </View>
                        )}
                        {selectedFriends.includes(friend._id) && (
                          <View style={styles.selectedBadge}>
                            <Icon source="check" size={16} color="#fff" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.friendName,
                          selectedFriends.includes(friend._id) && styles.selectedFriendName,
                        ]}
                        numberOfLines={2}
                      >
                        {friend.name} {friend.surname}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              <Text style={styles.helperMessage}>
                Currently, you can only share with 1 friend. Group sharing is coming soon!
              </Text>
              
              {selectedFriends.length > 0 && (
                <View style={styles.selectionSummary}>
                  <Icon source="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.selectionText}>
                    Selected: {friends.find(f => f._id === selectedFriends[0])?.name || 'Friend'}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        </ScrollView>

        {/* Floating Action Button */}
        {showScrollButton && (
          <TouchableOpacity style={styles.fabButton} onPress={scrollToTop}>
            <Icon source="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            style={styles.cancelButton}
            labelStyle={styles.cancelButtonText}
            disabled={creatingHabit}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.createButton}
            labelStyle={styles.createButtonText}
            disabled={loadingFriends || creatingHabit || !habitName || !description || selectedFriends.length === 0}
            loading={creatingHabit}
            buttonColor="#900C3F"
          >
            {creatingHabit ? "Creating..." : "Share Habit"}
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: "#900C3F",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    marginBottom: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    backgroundColor: "#fff",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 12,
  },
  cardContent: {
    paddingTop: 8,
  },
  input: {
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 100,
  },
  helperText: {
    marginTop: -4,
    marginBottom: 8,
  },
  helperMessage: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
    paddingHorizontal: 16,
  },
  dateSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  calendarContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 1,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  loadingText: {
    marginLeft: 12,
    color: "#666",
    fontSize: 16,
  },
  errorContainer: {
    alignItems: "center",
    paddingVertical: 32,
  },
  errorText: {
    color: "#FF5252",
    marginVertical: 16,
    textAlign: "center",
    fontSize: 16,
  },
  loginButton: {
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  friendsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  friendCard: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedFriendCard: {
    backgroundColor: "#FFF3E0",
    borderColor: "#900C3F",
  },
  friendAvatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  friendAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  friendInitials: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedFriendInitials: {
    backgroundColor: "#900C3F",
  },
  initialsText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#666",
  },
  selectedInitialsText: {
    color: "#fff",
  },
  selectedBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  friendName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    textAlign: "center",
    lineHeight: 18,
  },
  selectedFriendName: {
    color: "#900C3F",
    fontWeight: "600",
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    backgroundColor: "#E8F5E8",
    borderRadius: 8,
  },
  selectionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#4CAF50",
  },
  fabButton: {
    position: "absolute",
    bottom: 110,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#900C3F",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    borderColor: "#E0E0E0",
    borderRadius: 12,
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  createButton: {
    flex: 2,
    marginLeft: 8,
    borderRadius: 12,
    paddingVertical: 4,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default AddSharedHabit;