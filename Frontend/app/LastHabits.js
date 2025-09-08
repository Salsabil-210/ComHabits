import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  format,
  parseISO,
  isSameDay,
  subDays,
  subWeeks,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchHabitsByDateRange } from '../api/HabitApi';

const PRIMARY_COLOR = '#822445';
const SECONDARY_COLOR = '#8B5CF6';
const ACCENT_COLOR = '#EC4899';
const BACKGROUND_COLOR = '#F8FAFC';
const CARD_BACKGROUND = '#FFFFFF';
const TEXT_PRIMARY = '#1E293B';
const TEXT_SECONDARY = '#64748B';
const TEXT_MUTED = '#94A3B8';
const SUCCESS_COLOR = '#10B981';
const SUCCESS_LIGHT = '#D1FAE5';
const WARNING_COLOR = '#F59E0B';
const ERROR_COLOR = '#EF4444';
const ERROR_LIGHT = '#FEE2E2';
const BORDER_COLOR = '#E2E8F0';

const { width } = Dimensions.get('window');

const LastHabits = () => {
  const params = useLocalSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [habits, setHabits] = React.useState(params.habits ? JSON.parse(params.habits) : []);
  const [filterType, setFilterType] = React.useState(params.filterType || 'today');
  const [startDate, setStartDate] = React.useState(params.startDate ? parseISO(params.startDate) : new Date());
  const [endDate, setEndDate] = React.useState(params.endDate ? parseISO(params.endDate) : new Date());

  const refreshData = async (newFilterType = filterType) => {
    try {
      setLoading(true);
      setError(null);
      
      let newStartDate, newEndDate;
      switch (newFilterType) {
        case 'today':
          newStartDate = startOfDay(new Date());
          newEndDate = endOfDay(new Date());
          break;
        case 'week':
          newStartDate = startOfDay(subWeeks(new Date(), 1));
          newEndDate = endOfDay(new Date());
          break;
        default:
          newStartDate = startOfDay(new Date());
          newEndDate = endOfDay(new Date());
      }

      const habitsData = await fetchHabitsByDateRange(
        newStartDate.toISOString(),
        newEndDate.toISOString()
      );
      setHabits(habitsData);
      setFilterType(newFilterType);
      setStartDate(newStartDate);
      setEndDate(newEndDate);
    } catch (err) {
      console.error('Error refreshing habits:', err);
      setError(err.message || 'Failed to load habits');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!params.habits) {
      refreshData();
    }
  }, []);

  const safeFormat = (date, formatStr, fallback = '') => {
    try {
      return date ? format(date, formatStr) : fallback;
    } catch (e) {
      console.warn('Date formatting error:', e);
      return fallback;
    }
  };

  const getTitle = () => {
    switch (filterType) {
      case 'today':
        return `Today's Habits`;
      case 'week':
        return `Last Week's Habits`;
      default:
        return `Habits from ${safeFormat(startDate, 'MMM d, yyyy')} to ${safeFormat(endDate, 'MMM d, yyyy')}`;
    }
  };

  const getSubtitle = () => {
    switch (filterType) {
      case 'today':
        return safeFormat(startDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        return `${safeFormat(startDate, 'MMM d')} - ${safeFormat(endDate, 'MMM d, yyyy')}`;
      default:
        return null;
    }
  };

  const groupHabitsByDate = () => {
    const grouped = {};
    
    habits.forEach(habit => {
      if (!habit) return;
      
      // Use the datesInRange provided by the backend
      habit.datesInRange?.forEach(dateStr => {
        if (!grouped[dateStr]) {
          grouped[dateStr] = [];
        }
        
        // Only add the habit if it's not already in the array for this date
        if (!grouped[dateStr].some(h => h._id === habit._id)) {
          grouped[dateStr].push(habit);
        }
      });
    });

    return grouped;
  };

  const groupedHabits = groupHabitsByDate();
  const totalHabits = Object.values(groupedHabits).flat().length;
  const completedHabits = Object.values(groupedHabits).flat().filter(habit => {
    return habit.completionDates?.some(completionDate => {
      try {
        const completionDay = parseISO(completionDate);
        return completionDay >= startDate && completionDay <= endDate;
      } catch {
        return false;
      }
    });
  }).length;

  const filterOptions = [
    { label: 'Today', value: 'today', icon: 'today' },
    { label: 'Last Week', value: 'week', icon: 'date-range' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient 
        colors={[PRIMARY_COLOR, SECONDARY_COLOR]} 
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{getTitle()}</Text>
            {getSubtitle() && (
              <Text style={styles.headerSubtitle}>{getSubtitle()}</Text>
            )}
          </View>
          <View style={{ width: 24 }} />
        </View>
        
        {/* Enhanced Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialIcons name="check-circle" size={20} color={SUCCESS_COLOR} />
            </View>
            <Text style={styles.statNumber}>{completedHabits}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialIcons name="cancel" size={20} color={ERROR_COLOR} />
            </View>
            <Text style={styles.statNumber}>{totalHabits - completedHabits}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <MaterialIcons name="trending-up" size={20} color={WARNING_COLOR} />
            </View>
            <Text style={styles.statNumber}>
              {totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0}%
            </Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {filterOptions.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterButton,
              filterType === option.value && styles.activeFilterButton,
            ]}
            onPress={() => refreshData(option.value)}
            activeOpacity={0.7}
          >
            <MaterialIcons 
              name={option.icon} 
              size={18} 
              color={filterType === option.value ? 'white' : TEXT_SECONDARY} 
              style={styles.filterIcon}
            />
            <Text
              style={[
                styles.filterButtonText,
                filterType === option.value && styles.activeFilterButtonText,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading habits...</Text>
          </View>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={48} color={ERROR_COLOR} style={styles.errorIcon} />
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refreshData()}>
              <MaterialIcons name="refresh" size={18} color="white" style={styles.retryIcon} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content */}
      {!loading && !error && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {Object.keys(groupedHabits).length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyCard}>
                <MaterialIcons name="inbox" size={64} color={TEXT_MUTED} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No habits found</Text>
                <Text style={styles.emptyText}>
                  Start building better habits today!
                </Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => router.push('/AddHabitScreen')}
                >
                  <MaterialIcons name="add" size={20} color="white" style={styles.addIcon} />
                  <Text style={styles.addButtonText}>Add New Habit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.habitsContainer}>
              {Object.entries(groupedHabits)
                .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
                .map(([date, dateHabits]) => {
                  if (!dateHabits || dateHabits.length === 0) return null;
                  
                  const completedCount = dateHabits.filter(habit => {
                    return habit.completionDates?.some(completionDate => {
                      try {
                        return isSameDay(parseISO(completionDate), parseISO(date));
                      } catch {
                        return false;
                      }
                    });
                  }).length;
                  
                  const totalCount = dateHabits.length;
                  const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                  
                  return (
                    <View key={date} style={styles.dateSection}>
                      <View style={[
                        styles.dateHeaderCard,
                        completionRate === 100 ? styles.dateHeaderSuccess : 
                        completionRate === 0 ? styles.dateHeaderError : styles.dateHeaderPartial
                      ]}>
                        <View style={styles.dateHeaderContent}>
                          <View>
                            <Text style={styles.dateHeader}>
                              {safeFormat(parseISO(date), 'EEEE, MMMM d')}
                            </Text>
                            <Text style={styles.dateSubheader}>
                              {completedCount} of {totalCount} habits completed
                            </Text>
                          </View>
                          <View style={styles.dateProgressContainer}>
                            <Text style={[
                              styles.dateProgressText,
                              completionRate === 100 ? styles.progressSuccess :
                              completionRate === 0 ? styles.progressError : styles.progressWarning
                            ]}>
                              {Math.round(completionRate)}%
                            </Text>
                            <View style={styles.progressBar}>
                              <View style={[
                                styles.progressFill,
                                { width: `${completionRate}%` },
                                completionRate === 100 ? styles.progressFillSuccess :
                                completionRate === 0 ? styles.progressFillError : styles.progressFillWarning
                              ]} />
                            </View>
                          </View>
                        </View>
                      </View>
                      
                      {dateHabits.map((habit, index) => {
                        if (!habit) return null;
                        
                        const isCompleted = habit.completionDates?.some(completionDate => {
                          try {
                            return isSameDay(parseISO(completionDate), parseISO(date));
                          } catch {
                            return false;
                          }
                        });
                        
                        return (
                          <View key={`${habit.id}-${index}`} style={[
                            styles.habitCard,
                            isCompleted ? styles.habitCardCompleted : styles.habitCardPending
                          ]}>
                            <View style={styles.habitContent}>
                              <View style={styles.habitHeader}>
                                <View style={styles.habitTitleContainer}>
                                  <Text style={styles.habitName}>
                                    {habit.name || 'Unnamed Habit'}
                                  </Text>
                                  {habit.description && (
                                    <Text style={styles.habitDescription}>{habit.description}</Text>
                                  )}
                                </View>
                                <View
                                  style={[
                                    styles.statusBadge,
                                    isCompleted ? styles.statusCompleted : styles.statusPending,
                                  ]}
                                >
                                  <MaterialIcons
                                    name={isCompleted ? 'check-circle' : 'cancel'}
                                    size={24}
                                    color={isCompleted ? SUCCESS_COLOR : ERROR_COLOR}
                                  />
                                </View>
                              </View>
                              
                              <View style={styles.habitFooter}>
                                <View style={[
                                  styles.statusContainer,
                                  isCompleted ? styles.statusContainerCompleted : styles.statusContainerPending
                                ]}>
                                  <Text
                                    style={[
                                      styles.statusText,
                                      isCompleted ? styles.statusTextCompleted : styles.statusTextPending,
                                    ]}
                                  >
                                    {isCompleted ? '✓ Completed' : '✗ Not completed'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                            
                            <View style={[
                              styles.completedIndicator,
                              isCompleted ? styles.completedIndicatorSuccess : styles.completedIndicatorError
                            ]} />
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 12,
    flex: 1,
    justifyContent: 'center',
  },
  activeFilterButton: {
    backgroundColor: PRIMARY_COLOR,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  filterIcon: {
    marginRight: 8,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  activeFilterButtonText: {
    color: 'white',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(248,250,252,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  habitsContainer: {
    padding: 20,
  },
  dateSection: {
    marginBottom: 32,
  },
  dateHeaderCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderLeftWidth: 4,
  },
  dateHeaderSuccess: {
    borderLeftColor: SUCCESS_COLOR,
    backgroundColor: SUCCESS_LIGHT,
  },
  dateHeaderError: {
    borderLeftColor: ERROR_COLOR,
    backgroundColor: ERROR_LIGHT,
  },
  dateHeaderPartial: {
    borderLeftColor: WARNING_COLOR,
    backgroundColor: '#FEF3C7',
  },
  dateHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  dateSubheader: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  dateProgressContainer: {
    alignItems: 'flex-end',
  },
  dateProgressText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  progressSuccess: {
    color: SUCCESS_COLOR,
  },
  progressError: {
    color: ERROR_COLOR,
  },
  progressWarning: {
    color: WARNING_COLOR,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillSuccess: {
    backgroundColor: SUCCESS_COLOR,
  },
  progressFillError: {
    backgroundColor: ERROR_COLOR,
  },
  progressFillWarning: {
    backgroundColor: WARNING_COLOR,
  },
  habitCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  habitCardCompleted: {
    borderLeftColor: SUCCESS_COLOR,
  },
  habitCardPending: {
    borderLeftColor: ERROR_COLOR,
  },
  habitContent: {
    padding: 20,
  },
  habitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  habitTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 22,
  },
  habitDescription: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginTop: 4,
    lineHeight: 18,
  },
  statusBadge: {
    padding: 10,
    borderRadius: 16,
  },
  statusCompleted: {
    backgroundColor: SUCCESS_LIGHT,
  },
  statusPending: {
    backgroundColor: ERROR_LIGHT,
  },
  habitFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusContainerCompleted: {
    backgroundColor: SUCCESS_LIGHT,
  },
  statusContainerPending: {
    backgroundColor: ERROR_LIGHT,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: SUCCESS_COLOR,
  },
  statusTextPending: {
    color: ERROR_COLOR,
  },
  completedIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  completedIndicatorSuccess: {
    backgroundColor: SUCCESS_COLOR,
  },
  completedIndicatorError: {
    backgroundColor: ERROR_COLOR,
  },
});

export default LastHabits;