import React from 'react';
import { useRouter } from "expo-router";
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

const PRIMARY_COLOR = '#900C3F';
const SECONDARY_COLOR = '#F48FB1';
const ACCENT_COLOR = '#FFD700'; // Gold for emphasis
const TEXT_COLOR_DARK = '#333333';
const TEXT_COLOR_LIGHT = '#777777';
const BACKGROUND_COLOR = '#F9F9F9';
const CARD_BACKGROUND = 'white';

export default function HabitTipsScreen() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={[BACKGROUND_COLOR, '#EDEDED']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          <Feather name="lightbulb" size={24} color={ACCENT_COLOR} style={{ marginRight: 8 }} />
          Habit Building Insights
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Habit Loop Section */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: PRIMARY_COLOR }]}>
            <Feather name="repeat" size={18} color={PRIMARY_COLOR} style={{ marginRight: 5 }} />
            Understanding the Habit Loop
          </Text>
          <Text style={styles.sectionText}>
            The habit loop consists of three key components:
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listItemNumber}>1.</Text>
            <Text style={styles.listItemText}>
              <Text style={{ fontWeight: 'bold', color: TEXT_COLOR_DARK }}>Cue:</Text> A trigger that initiates the behavior. Think of it as a signal to act.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listItemNumber}>2.</Text>
            <Text style={styles.listItemText}>
              <Text style={{ fontWeight: 'bold', color: TEXT_COLOR_DARK }}>Routine:</Text> The behavior or action you perform. This is the habit itself.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listItemNumber}>3.</Text>
            <Text style={styles.listItemText}>
              <Text style={{ fontWeight: 'bold', color: TEXT_COLOR_DARK }}>Reward:</Text> The benefit or satisfaction you gain. This reinforces the loop.
            </Text>
          </View>
          <Text style={[styles.sectionText, { marginTop: 10 }]}>
            By identifying these components in your existing habits, you can strategically modify them to build new, positive routines or break unwanted ones.
          </Text>
        </View>

        {/* Time to Form a Habit Section */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: SECONDARY_COLOR }]}>
            <Feather name="clock" size={18} color={SECONDARY_COLOR} style={{ marginRight: 5 }} />
            The Timeline of Habit Formation
          </Text>
          <Text style={styles.sectionText}>
            Forget the myth of 21 days! Research indicates that the time it takes to form a new habit varies significantly, ranging from approximately <Text style={{ fontWeight: 'bold', color: ACCENT_COLOR }}>18 to 254 days</Text>.
          </Text>
          <Text style={styles.sectionText}>
            The actual duration depends on several factors, including the individual's personality, the complexity of the habit, and their consistency in practicing it.
          </Text>
          <Text style={[styles.sectionText, { fontWeight: 'bold', color: TEXT_COLOR_DARK }]}>
            Focus on consistency and patience rather than a strict timeline.
          </Text>
        </View>

        {/* Willpower Section */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: PRIMARY_COLOR }]}>
            <Feather name="user-x" size={18} color={PRIMARY_COLOR} style={{ marginRight: 5 }} />
            Beyond Willpower: Designing for Success
          </Text>
          <Text style={styles.sectionText}>
            Relying solely on willpower to build habits is often a recipe for failure. Willpower is a finite resource that can be easily depleted by daily stresses and decisions.
          </Text>
          <Text style={styles.sectionText}>
            Instead of trying to force habits through sheer willpower, focus on:
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listItemNumber}>•</Text>
            <Text style={styles.listItemText}>
              <Text style={{ fontWeight: 'bold', color: TEXT_COLOR_DARK }}>Environment Design:</Text> Shape your surroundings to make good habits easier and bad habits harder.
            </Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listItemNumber}>•</Text>
            <Text style={styles.listItemText}>
              <Text style={{ fontWeight: 'bold', color: TEXT_COLOR_DARK }}>Making it Easy:</Text> Start with small, manageable steps to lower the barrier to entry.
            </Text>
          </View>
        </View>

        {/* Building Good Habits Section */}
        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: SECONDARY_COLOR }]}>
            <Feather name="trending-up" size={18} color={SECONDARY_COLOR} style={{ marginRight: 5 }} />
            The Power of Small Improvements: The 1% Rule
          </Text>
          <Text style={styles.sectionText}>
            The <Text style={{ fontWeight: 'bold', color: ACCENT_COLOR }}>1% rule</Text> highlights the remarkable impact of making small, incremental improvements consistently over time.
          </Text>
          <Text style={styles.sectionText}>
            Imagine getting just <Text style={{ fontWeight: 'bold', color: ACCENT_COLOR }}>1% better each day</Text> at a desired habit. While the progress on any single day might seem negligible, these small gains compound exponentially.
          </Text>
          <Text style={styles.sectionText}>
            <Text style={{ fontWeight: 'bold', color: TEXT_COLOR_DARK }}>Example:</Text> Reading just 5 pages of a book daily might not feel like much, but over a year, it can lead to finishing dozens of books, significantly expanding your knowledge and forming a reading habit.
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_COLOR_DARK,
    textAlign: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 15,
    color: TEXT_COLOR_LIGHT,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
  },
  listItemNumber: {
    fontSize: 16,
    color: ACCENT_COLOR,
    marginRight: 8,
  },
  listItemText: {
    fontSize: 16,
    lineHeight: 24,
    color: TEXT_COLOR_LIGHT,
    flex: 1,
  },
});