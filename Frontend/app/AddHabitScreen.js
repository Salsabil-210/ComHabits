import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, ScrollView, Switch, TextInput, Platform } from "react-native";
import { Icon, Button, Card, SegmentedButtons, HelperText, IconButton, TextInput as PaperInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { Picker } from "@react-native-picker/picker";
import { Calendar } from "react-native-calendars";
import { createHabit } from "../api/HabitApi";
import { format } from 'date-fns';

const daysOfWeekFull = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const daysOfWeekShort = ["M", "Tue", "W", "Th", "F", "Sat", "Sun"];
const weeklyOptions = ["every 1 week", "every 2 weeks", "every 3 weeks"];
const monthlyOptions = ["every 1 month", "every 2 months", "every 3 months"];

const REMINDER_OPTIONS = [
  { label: "1 day before habit", value: 1 },
  { label: "2 days before habit", value: 2 },
  { label: "3 days before habit", value: 3 },
  { label: "4 days before habit", value: 4 },
  { label: "5 days before habit", value: 5 }
];

const AddHabitScreen = () => {
  const router = useRouter();
  const scrollViewRef = useRef(null);

  const [habitName, setHabitName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatType, setRepeatType] = useState("weekly");
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedMonthlyDates, setSelectedMonthlyDates] = useState([]);
  const [endDateEnabled, setEndDateEnabled] = useState(false);
  const [endDate, setEndDate] = useState(null);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [weeklyFrequency, setWeeklyFrequency] = useState("every 1 week");
  const [monthlyFrequency, setMonthlyFrequency] = useState("every 1 month");
  const [selectedReminders, setSelectedReminders] = useState([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [repeatCount, setRepeatCount] = useState(null);
  const [repeatCountEnabled, setRepeatCountEnabled] = useState(false);

  const getTodayString = () => {
    return format(new Date(), 'yyyy-MM-dd');
  };

  const createLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const isDateBefore = (dateString1, dateString2) => {
    return dateString1 < dateString2;
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollButton(offsetY > 100);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const toggleReminder = (value) => {
    setSelectedReminders(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleSave = async () => {
   if (!habitName || habitName.length < 1) {
  alert("Habit name is required!");
  return;
}
    if (!description) {
      alert("Description is required!");
      return;
    }
    if (repeatEnabled && repeatCountEnabled && (!repeatCount || repeatCount < 1)) {
      alert("Please set a repeat count for repeating habits.");
      return;
    }
    if (repeatEnabled && repeatType === "weekly" && selectedDays.length === 0) {
      alert("Please select at least one day for weekly repetition.");
      return;
    }
    if (repeatEnabled && repeatType === "monthly" && selectedMonthlyDates.length === 0) {
      alert("Please select at least one date for monthly repetition.");
      return;
    }
    if (repeatEnabled && repeatCountEnabled && repeatCount > 365) {
      alert("Repeat count cannot be more than 365.");
      return;
    }
    if (!repeatEnabled && selectedReminders.length > 0) {
      alert("Reminders can only be set for repeating habits!");
      return;
    }

    let finalEndDate = null;
    if (!repeatEnabled && endDateEnabled && endDate) {
      finalEndDate = endDate;
    }

    let finalRepeatDays = [];
    let finalMonthlyDates = [];

    if (repeatEnabled) {
      if (repeatType === "weekly") {
        finalRepeatDays = selectedDays.map((dayIndex) => daysOfWeekFull[dayIndex]);
      }
      if (repeatType === "monthly") {
        const todayString = getTodayString();
        finalMonthlyDates = selectedMonthlyDates
          .filter(dateStr => !isDateBefore(dateStr, todayString));
        
        if (finalMonthlyDates.length === 0) {
          alert("Please select at least one future date for monthly repetition.");
          return;
        }
      }
    }

    const habitData = {
      name: habitName,
      description,
      startDate: startDate,
      repeat: repeatEnabled ? repeatType : undefined,
      repeatDays: repeatType === "weekly" && repeatEnabled ? finalRepeatDays : undefined,
      frequency: repeatEnabled
        ? (repeatType === "weekly" ? weeklyFrequency : repeatType === "monthly" ? monthlyFrequency : undefined)
        : undefined,
      endDate: finalEndDate,
      reminderOffsets: selectedReminders.length > 0 ? selectedReminders : undefined,
      selectedMonthlyDates: repeatType === "monthly" && repeatEnabled ? finalMonthlyDates : undefined,
      repeatCount: repeatCountEnabled ? repeatCount : undefined,
    };

    const cleanedHabitData = Object.fromEntries(
      Object.entries(habitData).filter(([, v]) => v !== undefined)
    );

    console.log("Payload sent to backend:", cleanedHabitData);

    try {
      const response = await createHabit(cleanedHabitData);
      router.push({
        pathname: "/Home",
        params: { newHabit: JSON.stringify(response) },
      });
    } catch (error) {
      console.error("Error creating habit:", error);
      alert(error.message || "Failed to create habit. Please try again.");
    }
  };

  const handleStartDateSelect = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getTodayString();

    if (isDateBefore(selectedDateString, todayString)) {
      alert("Start date cannot be in the past!");
      return;
    }
    
    if (endDate && isDateBefore(endDate, selectedDateString)) {
      alert("End date cannot be earlier than start date!");
      return;
    }
    
    setStartDate(selectedDateString);
    setShowStartCalendar(false);
  };

  const handleEndDateSelect = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getTodayString();

    if (isDateBefore(selectedDateString, todayString)) {
      alert("End date cannot be in the past!");
      return;
    }
    
    if (startDate && isDateBefore(selectedDateString, startDate)) {
      alert("End date cannot be earlier than start date!");
      return;
    }
    
    setEndDate(selectedDateString);
    setShowEndCalendar(false);
  };

  const handleMonthlyDateSelect = (day) => {
    const selectedDateString = day.dateString;
    const todayString = getTodayString();

    if (isDateBefore(selectedDateString, todayString)) {
      alert("Cannot select past dates for monthly repetition!");
      return;
    }

    setSelectedMonthlyDates((prevDates) =>
      prevDates.includes(selectedDateString)
        ? prevDates.filter((d) => d !== selectedDateString)
        : [...prevDates, selectedDateString].sort()
    );
  };

  const toggleDaySelection = (dayIndex) => {
    setSelectedDays((prevDays) =>
      prevDays.includes(dayIndex)
        ? prevDays.filter((d) => d !== dayIndex)
        : [...prevDays, dayIndex].sort((a, b) => a - b)
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => router.back()}
            style={styles.backButton}
            iconColor="#900C3F"
          />
          <Text style={styles.title}>Add New Habit</Text>

          {/* Habit Details */}
          <Card style={styles.card}>
            <Card.Title title="Habit Details" />
            <Card.Content>
              <PaperInput
                label="Habit Name"
                value={habitName}
                onChangeText={setHabitName}
                mode="outlined"
              />
             {habitName.length === 0 && (
             <HelperText type="error">
              Habit name is required.
             </HelperText>
          )}
              <PaperInput
                label="Description"
                value={description}
                onChangeText={setDescription}
                mode="outlined"
                multiline
                style={styles.textArea}
              />
              {!description && (
                <HelperText type="error">Description is required.</HelperText>
              )}
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
                <Text style={styles.datePickerText}>
                  {`Start Date: ${format(createLocalDate(startDate), 'MMM d, yyyy')}`}
                </Text>
                <Icon source="calendar" size={24} color="#900C3F" />
              </TouchableOpacity>
              {showStartCalendar && (
                <Calendar
                  onDayPress={handleStartDateSelect}
                  minDate={getTodayString()}
                  markedDates={{
                    [startDate]: { selected: true, selectedColor: '#900C3F' }
                  }}
                />
              )}
            </Card.Content>
          </Card>

          {/* Repeat Section */}
          <Card style={styles.card}>
            <Card.Title title="Repeat" />
            <Card.Content>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Enable Repeat</Text>
                <Switch
                  value={repeatEnabled}
                  onValueChange={(value) => {
                    setRepeatEnabled(value);
                    // Only reset end date if disabling repeat
                    if (!value) {
                      setEndDateEnabled(false);
                      setEndDate(null);
                    }
                    // Keep other repeat settings intact
                  }}
                  trackColor={{ false: "#767577", true: "#900C3F" }}
                  thumbColor="#f4f3f4"
                />
              </View>
              {repeatEnabled && (
                <>
                  <SegmentedButtons
                    value={repeatType}
                    onValueChange={setRepeatType}
                    buttons={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                    style={styles.segmentedButtons}
                  />

                  {/* Weekly Options */}
                  {repeatType === "weekly" && (
                    <View style={styles.daysOfWeekContainer}>
                      <Text style={styles.subLabel}>Select Days:</Text>
                      <View style={styles.daysOfWeekButtons}>
                        {daysOfWeekShort.map((day, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.dayOfWeekButton,
                              selectedDays.includes(index) && styles.selectedDayOfWeek,
                            ]}
                            onPress={() => toggleDaySelection(index)}
                          >
                            <Text
                              style={[
                                styles.text,
                                selectedDays.includes(index) && { color: "white" },
                              ]}
                            >
                              {day}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {selectedDays.length === 0 && (
                        <HelperText type="error">
                          Please select at least one day for weekly repetition.
                        </HelperText>
                      )}
                      <View style={styles.frequencyPicker}>
                        <Text style={styles.subLabel}>Frequency:</Text>
                        <Picker
                          selectedValue={weeklyFrequency}
                          style={styles.picker}
                          onValueChange={setWeeklyFrequency}
                        >
                          {weeklyOptions.map((option) => (
                            <Picker.Item key={option} label={option} value={option} />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  )}

                  {/* Monthly Options */}
                  {repeatType === "monthly" && (
                    <View>
                      <Text style={styles.subLabel}>Select Dates:</Text>
                      <Calendar
                        onDayPress={handleMonthlyDateSelect}
                        minDate={getTodayString()}
                        markedDates={{
                          ...selectedMonthlyDates.reduce((acc, dateStr) => {
                            acc[dateStr] = { selected: true, selectedColor: "#900C3F" };
                            return acc;
                          }, {}),
                        }}
                      />
                      {selectedMonthlyDates.length === 0 && (
                        <HelperText type="error">
                          Please select at least one date for monthly repetition.
                        </HelperText>
                      )}
                      <View style={styles.frequencyPicker}>
                        <Text style={styles.subLabel}>Frequency:</Text>
                        <Picker
                          selectedValue={monthlyFrequency}
                          style={styles.picker}
                          onValueChange={setMonthlyFrequency}
                        >
                          {monthlyOptions.map((option) => (
                            <Picker.Item key={option} label={option} value={option} />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  )}

                  {/* Repeat Count */}
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Set Repeat Count</Text>
                    <Switch
                      value={repeatCountEnabled}
                      onValueChange={setRepeatCountEnabled}
                      trackColor={{ false: "#767577", true: "#900C3F" }}
                      thumbColor="#f4f3f4"
                    />
                  </View>
                  {repeatCountEnabled && (
                    <View style={styles.repeatCountContainer}>
                      <TextInput
                        style={styles.repeatCountInput}
                        keyboardType="numeric"
                        value={repeatCount ? repeatCount.toString() : ""}
                        onChangeText={(text) => {
                          const num = parseInt(text, 10);
                          setRepeatCount(isNaN(num) ? null : num);
                        }}
                        placeholder="Number of repetitions"
                        maxLength={4}
                      />
                      {repeatCountEnabled && (!repeatCount || repeatCount < 1) && (
                        <HelperText type="error">
                          Repeat count must be a positive number.
                        </HelperText>
                      )}
                    </View>
                  )}
                </>
              )}
            </Card.Content>
          </Card>

          {/* End Date */}
          <Card style={styles.card}>
            <Card.Title title="End Date (Optional)" />
            <Card.Content>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Enable End Date</Text>
                <Switch
                  value={endDateEnabled && !repeatEnabled}
                  onValueChange={(value) => {
                    if (!repeatEnabled) {
                      setEndDateEnabled(value);
                      if (!value) {
                        setEndDate(null);
                      } else if (!endDate) {
                        setEndDate(getTodayString());
                      }
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
                    <Text style={styles.datePickerText}>
                      {endDate ? `End Date: ${format(createLocalDate(endDate), 'MMM d, yyyy')}` : "Select End Date"}
                    </Text>
                    <Icon source="calendar" size={24} color="#900C3F" />
                  </TouchableOpacity>
                  {showEndCalendar && (
                    <Calendar
                      onDayPress={handleEndDateSelect}
                      minDate={getTodayString()}
                      markedDates={{
                        [endDate || getTodayString()]: {
                          selected: true,
                          selectedColor: '#900C3F',
                        },
                      }}
                    />
                  )}
                </>
              )}
              {repeatEnabled && (
                <HelperText type="info" style={styles.infoText}>
                  End date is disabled for repeating habits. Use "Repeat Count" instead.
                </HelperText>
              )}
            </Card.Content>
          </Card>

          {/* Reminders - Only shown for repeating habits */}
          {repeatEnabled ? (
            <Card style={styles.card}>
              <Card.Title title="Reminders (Optional)" />
              <Card.Content>
                <Text style={styles.subLabel}>Select reminder days before habit:</Text>
                {REMINDER_OPTIONS.map((option) => (
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
                  Reminders are only available for repeating habits. Please enable repeat to set reminders.
                </HelperText>
              </Card.Content>
            </Card>
          )}

        </ScrollView>

        {/* Scroll to top button */}
        {showScrollButton && (
          <TouchableOpacity style={styles.scrollButton} onPress={scrollToTop}>
            <Icon source="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Footer Buttons */}
        <View style={styles.footer}>
          <Button
            style={[styles.footerButton, { backgroundColor: "#ddd" }]}
            labelStyle={{ color: "#333" }}
            onPress={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            style={[styles.footerButton, { backgroundColor: "#900C3F" }]}
            labelStyle={{ color: "white" }}
            onPress={handleSave}
          >
            Save Habit
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f4f4" },
  scrollContainer: { padding: 20, paddingBottom: 120 },
  backButton: { marginVertical: 10, alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 8 },
  title: { fontSize: 28, fontWeight: "bold", color: "#900C3F", textAlign: "center", marginBottom: 20 },
  card: { marginBottom: 15, elevation: 3, borderRadius: 8 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 10 },
  label: { fontSize: 16, color: "#333" },
  subLabel: { fontSize: 14, color: "#666", marginTop: 10, marginBottom: 5 },
  infoText: { color: '#900C3F', fontStyle: 'italic', marginTop: 5 },
  textArea: { minHeight: 80, marginTop: 10 },
  datePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginTop: 10,
    backgroundColor: "#fff"
  },
  datePickerText: { fontSize: 16, color: "#333" },
  segmentedButtons: { marginTop: 15 },
  daysOfWeekContainer: { marginTop: 15 },
  daysOfWeekButtons: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", marginTop: 5 },
  dayOfWeekButton: {
    width: "13%",
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  },
  selectedDayOfWeek: { backgroundColor: "#900C3F", borderColor: "#900C3F" },
  text: { fontSize: 14, color: "#333" },
  frequencyPicker: { marginTop: 15 },
  picker: {
    marginTop: 5,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc"
  },
  scrollButton: {
    position: "absolute",
    bottom: 90,
    right: 20,
    backgroundColor: "#900C3F",
    borderRadius: 30,
    padding: 15,
    elevation: 5
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
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  repeatCountContainer: {
    marginTop: 15,
  },
  repeatCountInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  reminderLabel: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default AddHabitScreen;