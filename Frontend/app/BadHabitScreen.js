import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BadHabitApi } from '../api/badHabitApi';
import { Ionicons } from '@expo/vector-icons';

const BadHabitScreen = () => {
  const [badHabits, setBadHabits] = useState([]);
  const [badHabitInput, setBadHabitInput] = useState('');
  const [goodHabitInput, setGoodHabitInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [motivation, setMotivation] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await BadHabitApi.getBadHabits();
      setBadHabits(response.data || []);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleAddHabit = async () => {
    if (!badHabitInput.trim() || !goodHabitInput.trim()) {
      Alert.alert('Error', 'Please enter both bad and good habits');
      return;
    }

    try {
      setLoading(true);
      await BadHabitApi.addBadHabit(badHabitInput, goodHabitInput);
      setBadHabitInput('');
      setGoodHabitInput('');
      const response = await BadHabitApi.getBadHabits();
      setBadHabits(response.data);
      setMotivation({
        message: "New habit added! Time to make a change!",
        type: "success"
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHabit = async (id) => {
    Alert.alert(
      'Delete Habit',
      'Are you sure you want to delete this habit pair?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setLoading(true);
              await BadHabitApi.deleteBadHabit(id);
              const response = await BadHabitApi.getBadHabits();
              setBadHabits(response.data);
              setMotivation({
                message: "Habit deleted successfully",
                type: "info"
              });
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleTrackHabit = async (id) => {
            try {
     setLoading(true);
   const { success, message, data } = await BadHabitApi.trackHabit(id);
    
     if (!success) {
   Alert.alert('Already Tracked', message);
     return;
     }
    
     setBadHabits(prev => prev.map(h => 
     h._id === id ? { ...h, ...data } : h
     ));
    
     setMotivation({
     message,
     streak: data.streak,
     type: "achievement", // Assuming tracking is an achievement
    timeout: setTimeout(() => setMotivation(null), 3000)
     });
    
    } catch (error) {
     Alert.alert('Error', error.message);
     } finally {
     setLoading(false);
    }
    };

  const getProgressColor = (streak) => {
    if (streak >= 21) return '#4CAF50';
    if (streak >= 14) return '#8BC34A';
    if (streak >= 7) return '#FFC107';
    if (streak >= 3) return '#FF9800';
    return '#F44336';
  };

  const renderHabitItem = ({ item }) => (
    <View style={[
      styles.habitItem,
      item.completed && styles.completedHabitItem,
      { borderLeftColor: getProgressColor(item.streak) }
    ]}>
      <View style={styles.habitTextContainer}>
        <Text style={styles.badHabitText}>{item.badHabit}</Text>
        <Ionicons name="arrow-forward" size={18} color="#7E57C2" style={styles.arrowIcon} />
        <Text style={styles.goodHabitText}>{item.goodHabit}</Text>
        
        {item.completed && item.streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {item.streak}d</Text>
          </View>
        )}
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[
            styles.actionButton, 
            item.completed ? styles.completedButton : styles.incompleteButton
          ]}
          onPress={() => handleTrackHabit(item._id)}
          disabled={loading}
        >
          <Ionicons 
            name={item.completed ? "checkmark-circle" : "ellipse-outline"} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteHabit(item._id)}
          disabled={loading}
        >
          <Ionicons name="trash-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Habit Replacement Tracker</Text>
        <Text style={styles.subtitle}>Replace bad habits with positive alternatives</Text>
      </View>
      
      {motivation && (
        <View style={[
          styles.motivationBanner,
          { 
            backgroundColor: motivation.type === "achievement" ? '#E8F5E9' : 
                          motivation.type === "success" ? '#E3F2FD' : '#FFF3E0'
          }
        ]}>
          <Ionicons 
            name={motivation.type === "achievement" ? "flame" : 
                 motivation.type === "success" ? "checkmark-circle" : "information-circle"} 
            size={20} 
            color={motivation.type === "achievement" ? '#FF5722' : 
                  motivation.type === "success" ? '#2196F3' : '#FF9800'} 
          />
          <Text style={styles.motivationText}>{motivation.message}</Text>
          {motivation.streak > 0 && (
            <Text style={styles.streakText}>{motivation.streak} day streak!</Text>
          )}
        </View>
      )}
      
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="warning-outline" size={20} color="#FF5252" />
          <TextInput
            style={styles.input}
            placeholder="Bad habit (e.g. Scrolling social media)"
            placeholderTextColor="#999"
            value={badHabitInput}
            onChangeText={setBadHabitInput}
            editable={!loading}
          />
        </View>
        
        <View style={styles.inputWrapper}>
          <Ionicons name="heart-outline" size={20} color="#4CAF50" />
          <TextInput
            style={styles.input}
            placeholder="Replacement (e.g. Read a book)"
            placeholderTextColor="#999"
            value={goodHabitInput}
            onChangeText={setGoodHabitInput}
            editable={!loading}
          />
        </View>
        
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={handleAddHabit}
          disabled={loading || !badHabitInput.trim() || !goodHabitInput.trim()}
        >
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.buttonText}>{loading ? 'Adding...' : 'Add Habit Pair'}</Text>
        </TouchableOpacity>
      </View>

      {loading && badHabits.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7E57C2" />
        </View>
      ) : (
        <FlatList
          data={badHabits}
          renderItem={renderHabitItem}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={() => {
            BadHabitApi.getBadHabits()
              .then(response => setBadHabits(response.data))
              .catch(error => Alert.alert('Error', error.message));
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="happy-outline" size={50} color="#B39DDB" />
              <Text style={styles.emptyText}>No habits yet</Text>
              <Text style={styles.emptySubtext}>Add your first habit pair to get started</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  motivationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  motivationText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
  },
  streakText: {
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 5,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 12,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    height: '100%',
    fontSize: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#822445',
    padding: 15,
    borderRadius: 8,
    shadowColor: '#7E57C2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 10,
    fontSize: 16,
  },
  habitItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  completedHabitItem: {
    opacity: 0.9,
  },
  habitTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  badHabitText: {
    color: '#D32F2F',
    fontWeight: '600',
    fontSize: 16,
  },
  goodHabitText: {
    color: '#388E3C',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 5,
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
  streakBadge: {
    backgroundColor: '#EDE7F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
  },
  streakText: {
    color: '#7E57C2',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  incompleteButton: {
    backgroundColor: '#FF9800',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  listContainer: {
    paddingBottom: 20,
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
    fontSize: 18,
    color: '#7E57C2',
    marginTop: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 5,
    textAlign: 'center',
  },
});

export default BadHabitScreen;