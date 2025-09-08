import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Switch,
  TextInput,
  Alert,
  Platform,
  TouchableOpacity
} from "react-native";
import { 
  IconButton,
  Button,
  Card,
  HelperText,
  SegmentedButtons,
  Icon
} from "react-native-paper";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { Calendar } from "react-native-calendars";
import { updateHabit } from "../api/HabitApi";
import { format, isBefore, isSameDay } from 'date-fns';

const daysOfWeekFull = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const daysOfWeekShort = ["M", "Tue", "W", "Th", "F", "Sat", "Sun"];
const weeklyOptions = ["every 1 week", "every 2 weeks", "every 3 weeks"];
const monthlyOptions = ["every 1 month", "every 2 months", "every 3 months"];

const REMINDER_OPTIONS = [
  { label: "1 day before", value: 1 },
  { label: "2 days before", value: 2 },
  { label: "3 days before", value: 3 },
  { label: "4 days before", value: 4 },
  { label: "5 days before", value: 5 }
];

const EditHabitScreen = () => {
  const router = useRouter();
  const { habit } = useLocalSearchParams();
  const habitData = JSON.parse(habit || '{}');
  const scrollViewRef = useRef(null);

  // Helper functions for date handling
  const getTodayString = () => format(new Date(), 'yyyy-MM-dd');
  const createLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // State management
  const [name, setName] = useState(habitData.name || "");
  const [description, setDescription] = useState(habitData.description || "");
  const [startDate, setStartDate] = useState(
    habitData.startDate ? format(new Date(habitData.startDate), 'yyyy-MM-dd') : getTodayString()
  );
  const [repeatEnabled, setRepeatEnabled] = useState(!!habitData.repeat);
  const [repeatType, setRepeatType] = useState(habitData.repeat || "weekly");
  const [selectedDays, setSelectedDays] = useState(
    habitData.repeatDays?.map(day => daysOfWeekFull.indexOf(day)).filter(i => i !== -1) || []
  );
  const [monthlyDates, setMonthlyDates] = useState(habitData.selectedMonthlyDates || []);
  const [endDateEnabled, setEndDateEnabled] = useState(!!habitData.endDate && !habitData.repeat);
  const [endDate, setEndDate] = useState(
    habitData.endDate ? format(new Date(habitData.endDate), 'yyyy-MM-dd') : null
  );
  const [selectedReminders, setSelectedReminders] = useState(habitData.reminderOffsets || []);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [weeklyFrequency, setWeeklyFrequency] = useState(
    habitData.frequency?.includes('week') 
      ? habitData.frequency.replace('weeks', 'week') 
      : "every 1 week"
  );
  const [monthlyFrequency, setMonthlyFrequency] = useState(
    habitData.frequency?.includes('month') 
      ? habitData.frequency.replace('months', 'month') 
      : "every 1 month"
  );
  const [repeatCount, setRepeatCount] = useState(habitData.repeatCount || null);
  const [repeatCountEnabled, setRepeatCountEnabled] = useState(!!habitData.repeatCount);

  // Form validation
 const isFormValid = 
    name.trim().length >= 1 && 
    description.trim().length > 0 &&
    (!repeatEnabled || 
      (repeatType === 'weekly' && selectedDays.length > 0) ||
      (repeatType === 'monthly' && monthlyDates.length > 0) ||
      (repeatType === 'daily')) &&
    (!repeatEnabled || (repeatCount && repeatCount >= 1));

  const handleSave = async () => {
    try {
      // Basic validation
      if (name.trim().length < 1) {
      throw new Error("Habit name is required");
   }

      if (!description.trim()) {
        throw new Error("Description cannot be empty");
      }

      if (repeatEnabled && repeatType === "weekly" && selectedDays.length === 0) {
        throw new Error("Please select at least one day for weekly repetition");
      }

      if (repeatEnabled && repeatType === "monthly" && monthlyDates.length === 0) {
        throw new Error("Please select at least one date for monthly repetition");
      }

      if (repeatEnabled && (!repeatCount || repeatCount < 1)) {
        throw new Error("Repeat count must be a positive number for repeating habits");
      }
      
      if (repeatEnabled && repeatCount > 365) {
        throw new Error("Repeat count cannot be more than 365.");
      }
      
      if (!repeatEnabled && selectedReminders.length > 0) {
        throw new Error("If you want to remove the whole repeat please also remove reminders!");
      }

      // Prepare the update object
      const habitUpdate = {
        name: name.trim(),
        description: description.trim(),
        startDate, // Already in YYYY-MM-DD format
        repeat: repeatEnabled ? repeatType : null,
        repeatDays: repeatType === "weekly" && repeatEnabled
          ? selectedDays.map(i => daysOfWeekFull[i])
          : null,
        frequency: repeatEnabled 
          ? repeatType === 'weekly' 
            ? weeklyFrequency
            : monthlyFrequency
          : null,
        selectedMonthlyDates: repeatType === "monthly" && repeatEnabled
          ? monthlyDates
          : null,
        endDate: endDateEnabled && !repeatEnabled && endDate
          ? endDate
          : null,
        reminderOffsets: repeatEnabled ? selectedReminders : [], // Only include if repeat is enabled
        repeatCount: repeatEnabled ? repeatCount : null
      };

      // Clean undefined/null values and empty arrays
      const cleanUpdate = Object.fromEntries(
        Object.entries(habitUpdate).filter(([_, v]) => {
          if (Array.isArray(v)) return v.length > 0;
          return v !== null && v !== undefined;
        })
      );

      console.log('Final update payload:', cleanUpdate);
      await updateHabit(habitData._id, cleanUpdate);
      router.back();

    } catch (error) {
      console.error('Error updating habit:', error);
      Alert.alert(
        "Error", 
        error.message || "Failed to update habit. Please check your inputs."
      );
    }
  };

  // Handle repeat type change - clear old settings when switching types
  const handleRepeatTypeChange = (newType) => {
    if (newType !== repeatType) {
      // Clear the old type's settings
      if (newType === "weekly") {
        setMonthlyDates([]);
      } else if (newType === "monthly") {
        setSelectedDays([]);
      }
    }
    setRepeatType(newType);
  };

  const toggleDaySelection = (dayIndex) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(i => i !== dayIndex) 
        : [...prev, dayIndex]
    );
  };

  const handleMonthlyDateSelect = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getTodayString();

    if (isBefore(createLocalDate(selectedDateString), createLocalDate(todayString)) && 
        !isSameDay(createLocalDate(selectedDateString), createLocalDate(todayString))) {
      Alert.alert("Error", "Cannot select past dates for monthly repetition!");
      return;
    }

    setMonthlyDates(prev => 
      prev.includes(selectedDateString) 
        ? prev.filter(d => d !== selectedDateString) 
        : [...prev, selectedDateString]
    );
  };

  const handleStartDateSelect = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getTodayString();

    if (isBefore(createLocalDate(selectedDateString), createLocalDate(todayString)) && 
        !isSameDay(createLocalDate(selectedDateString), createLocalDate(todayString))) {
      Alert.alert("Error", "Start date cannot be in the past!");
      return;
    }
    
    if (endDate && isBefore(createLocalDate(endDate), createLocalDate(selectedDateString))) {
      Alert.alert("Error", "End date cannot be earlier than start date!");
      return;
    }
    
    setStartDate(selectedDateString);
    setShowStartCalendar(false);
  };

  const handleEndDateSelect = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getTodayString();

    if (isBefore(createLocalDate(selectedDateString), createLocalDate(todayString)) && 
        !isSameDay(createLocalDate(selectedDateString), createLocalDate(todayString))) {
      Alert.alert("Error", "End date cannot be in the past!");
      return;
    }
    
    if (isBefore(createLocalDate(selectedDateString), createLocalDate(startDate))) {
      Alert.alert("Error", "End date cannot be earlier than start date!");
      return;
    }
    
    setEndDate(selectedDateString);
    setShowEndCalendar(false);
  };

  const toggleReminder = (value) => {
    setSelectedReminders(prev =>
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
      >
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
          style={styles.backButton}
          iconColor="#900C3F"
        />

        <Text style={styles.title}>Edit Habit</Text>

        {/* Habit Details */}
        <Card style={styles.card}>
          <Card.Title title="Habit Details" />
          <Card.Content>
            <TextInput
              placeholder="Habit Name *"
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
           <HelperText type="error" visible={name.trim().length === 0}>
           Name is required
           </HelperText>
            
            <TextInput
              placeholder="Description *"
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.descriptionInput]}
              multiline
            />
            <HelperText type="error" visible={description.trim().length === 0}>
              Description is required
            </HelperText>
          </Card.Content>
        </Card>

        {/* Start Date */}
        <Card style={styles.card}>
          <Card.Title title="Start Date" />
          <Card.Content>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowStartCalendar(!showStartCalendar)}
            >
              <Text style={styles.dateText}>
                {format(createLocalDate(startDate), 'MMM dd, yyyy')}
              </Text>
              <Icon source="calendar" size={24} color="#900C3F" />
            </TouchableOpacity>
            {showStartCalendar && (
              <Calendar
                current={startDate}
                onDayPress={handleStartDateSelect}
                minDate={getTodayString()}
                markedDates={{
                  [startDate]: { selected: true, selectedColor: '#900C3F' }
                }}
              />
            )}
          </Card.Content>
        </Card>

        {/* Repeat Settings */}
        <Card style={styles.card}>
          <Card.Title title="Repeat" />
          <Card.Content>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Repeat this habit</Text>
              <Switch
                value={repeatEnabled}
                onValueChange={(value) => {
                  setRepeatEnabled(value);
                  if (value) {
                    setEndDateEnabled(false);
                    setEndDate(null);
                  }
                }}
                trackColor={{ false: "#767577", true: "#900C3F" }}
                thumbColor="#f4f3f4"
              />
            </View>

            {repeatEnabled && (
              <>
                <SegmentedButtons
                  value={repeatType}
                  onValueChange={handleRepeatTypeChange}
                  buttons={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                  style={styles.segmentedButtons}
                />

                {repeatType === "weekly" && (
                  <>
                    <Text style={styles.subLabel}>Repeat on:</Text>
                    <View style={styles.daysContainer}>
                      {daysOfWeekShort.map((day, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.dayButton,
                            selectedDays.includes(index) && styles.selectedDayButton
                          ]}
                          onPress={() => toggleDaySelection(index)}
                        >
                          <Text style={selectedDays.includes(index) ? styles.selectedDayText : styles.dayText}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <HelperText type="error" visible={selectedDays.length === 0}>
                      Select at least one day
                    </HelperText>

                    <Text style={styles.subLabel}>Frequency:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={weeklyFrequency}
                        onValueChange={setWeeklyFrequency}
                      >
                        {weeklyOptions.map(option => (
                          <Picker.Item key={option} label={option} value={option} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}

                {repeatType === "monthly" && (
                  <>
                    <Text style={styles.subLabel}>Select dates:</Text>
                    <Calendar
                      markedDates={{
                        ...monthlyDates.reduce((acc, date) => {
                          acc[date] = { selected: true, selectedColor: "#900C3F" };
                          return acc;
                        }, {}),
                        [getTodayString()]: { disabled: true }
                      }}
                      onDayPress={handleMonthlyDateSelect}
                      minDate={getTodayString()}
                    />
                    <HelperText type="error" visible={monthlyDates.length === 0}>
                      Select at least one date
                    </HelperText>

                    <Text style={styles.subLabel}>Frequency:</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={monthlyFrequency}
                        onValueChange={setMonthlyFrequency}
                      >
                        {monthlyOptions.map(option => (
                          <Picker.Item key={option} label={option} value={option} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}

                <View style={styles.switchRow}>
                  <Text style={styles.label}>Repeat Count *</Text>
                  <TextInput
                    style={[styles.input, { width: 100 }]}
                    keyboardType="numeric"
                    value={repeatCount ? repeatCount.toString() : ''}
                    onChangeText={(text) => setRepeatCount(text ? parseInt(text) : null)}
                    placeholder="e.g. 10"
                  />
                </View>
                <HelperText type="error" visible={repeatEnabled && (!repeatCount || repeatCount < 1)}>
                  Enter a valid number (minimum 1)
                </HelperText>
              </>
            )}
          </Card.Content>
        </Card>

        {/* End Date */}
        <Card style={styles.card}>
          <Card.Title title="End Date (Optional)" />
          <Card.Content>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Set end date</Text>
              <Switch
                value={endDateEnabled && !repeatEnabled}
                onValueChange={(value) => {
                  if (!repeatEnabled) {
                    setEndDateEnabled(value);
                    if (!value) setEndDate(null);
                  }
                }}
                trackColor={{ false: "#767577", true: "#900C3F" }}
                thumbColor="#f4f3f4"
                disabled={repeatEnabled}
              />
            </View>
            {endDateEnabled && !repeatEnabled && (
              <>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowEndCalendar(!showEndCalendar)}
                >
                  <Text style={styles.dateText}>
                    {endDate ? format(createLocalDate(endDate), 'MMM dd, yyyy') : "Select end date"}
                  </Text>
                  <Icon source="calendar" size={24} color="#900C3F" />
                </TouchableOpacity>
                {showEndCalendar && (
                  <Calendar
                    onDayPress={handleEndDateSelect}
                    minDate={startDate}
                    markedDates={{
                      [endDate || startDate]: { selected: true, selectedColor: '#900C3F' }
                    }}
                  />
                )}
              </>
            )}
            {repeatEnabled && (
              <HelperText type="info" style={styles.infoText}>
                End date is disabled for repeating habits
              </HelperText>
            )}
          </Card.Content>
        </Card>

        {/* Reminders - Conditionally rendered based on repeatEnabled */}
        {repeatEnabled ? (
          <Card style={styles.card}>
            <Card.Title title="Reminders (Optional)" />
            <Card.Content>
              <Text style={styles.subLabel}>Send reminders before habit:</Text>
              {REMINDER_OPTIONS.map(option => (
                <View key={option.value} style={styles.reminderOption}>
                  <Switch
                    value={selectedReminders.includes(option.value)}
                    onValueChange={() => toggleReminder(option.value)}
                    trackColor={{ false: "#767577", true: "#900C3F" }}
                    thumbColor={selectedReminders.includes(option.value) ? "#f4f3f4" : "#f4f3f4"}
                  />
                  <Text style={styles.reminderLabel}>{option.label}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Card.Title title="Reminders" />
            <Card.Content>
              <HelperText type="info" style={styles.infoText}>
                Reminders are only available for repeating habits. Enable repeat to set reminders.
              </HelperText>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.footerButton}
          labelStyle={{ color: "#900C3F" }}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          disabled={!isFormValid}
          style={[styles.footerButton, { backgroundColor: "#900C3F" }]}
          labelStyle={{ color: "white" }}
        >
          Save Changes
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f4" },
  scrollContent: { padding: 20, paddingBottom: 120 },
  backButton: { 
    marginVertical: 10, 
    alignSelf: "flex-start", 
    backgroundColor: "#fff", 
    borderRadius: 8 
  },
  title: { 
    fontSize: 28, 
    fontWeight: "bold", 
    color: "#900C3F", 
    textAlign: "center", 
    marginBottom: 20 
  },
  card: { 
    marginBottom: 15, 
    elevation: 3, 
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    fontSize: 16
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  datePickerButton: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    paddingVertical: 12, 
    paddingHorizontal: 15, 
    borderWidth: 1, 
    borderColor: "#ddd", 
    borderRadius: 8, 
    marginTop: 10, 
    backgroundColor: "#fff" 
  },
  dateText: { 
    fontSize: 16, 
    color: "#333" 
  },
  switchRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginVertical: 10 
  },
  label: { 
    fontSize: 16, 
    color: "#333" 
  },
  subLabel: { 
    fontSize: 14, 
    color: "#666", 
    marginTop: 10, 
    marginBottom: 5 
  },
  infoText: { 
    color: '#900C3F', 
    fontStyle: 'italic', 
    marginTop: 5 
  },
  segmentedButtons: { 
    marginTop: 15 
  },
  daysContainer: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    justifyContent: "space-between", 
    marginTop: 5 
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  selectedDayButton: { 
    backgroundColor: "#900C3F", 
    borderColor: "#900C3F" 
  },
  dayText: { 
    fontSize: 14, 
    color: "#333" 
  },
  selectedDayText: { 
    fontSize: 14, 
    color: "white" 
  },
  pickerContainer: { 
    marginTop: 10, 
    backgroundColor: "#fff", 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: "#ddd" 
  },
  picker: { 
    height: 50 
  },
  repeatCountContainer: {
    marginTop: 15,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  reminderLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  footer: { 
    flexDirection: "row", 
    justifyContent: "space-around", 
    paddingVertical: 15, 
    paddingHorizontal: 10, 
    backgroundColor: "#fff", 
    borderTopWidth: 1, 
    borderTopColor: "#eee", 
    position: "absolute", 
    bottom: 0, 
    left: 0, 
    right: 0 
  },
  footerButton: { 
    flex: 1, 
    marginHorizontal: 5, 
    paddingVertical: 8,
    borderRadius: 8,
  }
});

export default EditHabitScreen;