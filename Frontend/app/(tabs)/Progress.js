import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator, 
  RefreshControl 
} from "react-native";
import { Feather } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { fetchHabitStats } from '../../api/HabitApi';

const ProgressScreen = () => {
  const router = useRouter();
  const [stats, setStats] = useState({
    daily: [],
    overall: { 
      completed: 0, 
      uncompleted: 0, 
      totalHabits: 0,
      completionRate: 0 
    }
  });
  const [timeRange, setTimeRange] = useState('month'); // 'week', 'month', 'year'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      
     
       if (timeRange === 'month') {
        startDate.setMonth(endDate.getMonth() - 1); // Last 30 days
      } else {
        startDate.setFullYear(endDate.getFullYear(), 0, 1); // Year to date
      }
  
      // Format dates to YYYY-MM-DD
      const formatDate = (date) => date.toISOString().split('T')[0];
      
      const data = await fetchHabitStats(
        formatDate(startDate),
        formatDate(endDate)
      );
      console.log('Habit stats API response:', data); // <-- Debug log
  
      // Ensure we have valid data structure
      if (!data || !data.stats || !data.dailyCompletions) {
        console.warn('Invalid data structure received from API:', data); // <-- Debug log
        throw new Error('Invalid data structure received from API');
      }
  
      let processedDaily = [];
      const now = new Date();
      
      // Process daily completions based on time range
      if (timeRange === 'week') {
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        processedDaily = Array(7).fill().map((_, index) => {
          const targetDate = new Date(startDate);
          targetDate.setDate(startDate.getDate() + index);
          const dateStr = formatDate(targetDate);
          
          // Find matching day data or use defaults
          const dayData = data.dailyCompletions.find(d => d.date === dateStr) || {
            completed: 0,
            total: 0 // Changed from totalActive to match backend
          };
          
          return {
            day: daysOfWeek[targetDate.getDay()],
            date: dateStr,
            completed: dayData.completed,
            totalActive: dayData.total, // Match backend property name
            completionRate: dayData.total > 0 
              ? Math.round((dayData.completed / dayData.total) * 100)
              : 0
          };
        });
      } 
      // ... rest of your time range processing
  
      setStats({
        daily: processedDaily,
        overall: {
          completed: data.stats.completed || 0,
          uncompleted: data.stats.active + data.stats.inactive || 0, // Calculate uncompleted
          totalHabits: data.stats.totalHabits || 0,
          completionRate: data.stats.completionRate || 0
        }
      });
  
    } catch (error) {
      console.error("Failed to load stats:", error);
      Alert.alert("Error", "Failed to load habit statistics. Please try again.");
      // Set empty state on error
      setStats({
        daily: [],
        overall: { 
          completed: 0, 
          uncompleted: 0, 
          totalHabits: 0,
          completionRate: 0 
        }
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange])

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const renderTimeRangeSelector = () => (
    <View style={styles.rangeSelector}>
      {['month', 'year'].map((range) => (
        <TouchableOpacity
          key={range}
          style={[styles.rangeButton, timeRange === range && styles.activeRange]}
          onPress={() => setTimeRange(range)}
        >
          <Text style={[styles.rangeText, timeRange === range && styles.activeRangeText]}>
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatsCards = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#822445" />
          <Text style={styles.loadingText}>Loading stats...</Text>
        </View>
      );
    }

    return (
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.completedCard]}>
          <Text style={styles.statNumber}>{stats.overall.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
          <View style={styles.statIconContainer}>
            <Feather name="check-circle" size={20} color="#fff" />
          </View>
        </View>

        <View style={[styles.statCard, styles.uncompletedCard]}>
          <Text style={styles.statNumber}>{stats.overall.uncompleted}</Text>
          <Text style={styles.statLabel}>Uncompleted</Text>
          <View style={styles.statIconContainer}>
            <Feather name="x-circle" size={20} color="#fff" />
          </View>
        </View>

        <View style={[styles.statCard, styles.habitsCard]}>
          <Text style={styles.statNumber}>{stats.overall.totalHabits}</Text>
          <Text style={styles.statLabel}>Total Habits</Text>
          <View style={styles.statIconContainer}>
            <Feather name="list" size={20} color="#fff" />
          </View>
        </View>

        <View style={[styles.statCard, styles.rateCard]}>
          <Text style={styles.statNumber}>{stats.overall.completionRate}%</Text>
          <Text style={styles.statLabel}>Success Rate</Text>
          <View style={styles.statIconContainer}>
            <Feather name="trending-up" size={20} color="#fff" />
          </View>
        </View>
      </View>
    );
  };
 const renderChart = () => {
  if (loading) {
    return (
      <View style={styles.chartLoadingContainer}>
        <ActivityIndicator size="large" color="#822445" />
      </View>
    );
  }

  // Check if we have valid data to display
  if (!stats.daily || stats.daily.length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <View style={styles.noDataIcon}>
          <Feather name="bar-chart-2" size={24} color="#CBD5E0" />
        </View>
        <Text style={styles.noDataText}>No habit data available for this period</Text>
      </View>
    );
  }

  // Ensure all data points have valid completion rates and sort by date
  const validData = stats.daily
    .map(day => ({
      ...day,
      // Default to 0 if completionRate is invalid
      completionRate: isNaN(day.completionRate) ? 0 : Math.min(Math.max(day.completionRate, 0), 100)
    }));

  const chartData = {
    labels: validData.map(day => day.day),
    datasets: [{
      data: validData.map(day => day.completionRate),
      color: (opacity = 1) => `rgba(130, 36, 69, ${opacity})`, // Primary color
      strokeWidth: 3 // Slightly thicker line
    }]
  };

  // Add minimum y-axis value to ensure chart always shows 0-100% range
  if (!chartData.datasets[0].data.includes(0)) {
    chartData.datasets[0].data.push(0);
  }
  if (!chartData.datasets[0].data.includes(100)) {
    chartData.datasets[0].data.push(100);
  }

  return (
    <View style={styles.chartContainer}>
      <LineChart
        data={chartData}
        width={Dimensions.get('window').width - 48}
        height={220}
        yAxisSuffix="%"
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(130, 36, 69, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(45, 55, 72, ${opacity})`,
          strokeWidth: 3,
          propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: "#822445"
          },
          propsForLabels: {
            fontSize: 12,
            fontFamily: 'Inter_500Medium',
          },
          formatYLabel: (value) => Math.round(value).toString(),
          propsForBackgroundLines: {
            strokeDasharray: '', // Solid grid lines
            stroke: '#E2E8F0',
            strokeWidth: 1
          }
        }}
        bezier
        style={{
          ...styles.chart,
          paddingRight: 12 // Extra padding for labels
        }}
        withInnerLines={true}
        withOuterLines={true}
        withVerticalLines={false}
        withHorizontalLines={true}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        fromZero={true}
        segments={5}
      />
    </View>
  );
};
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#822445']}
          tintColor="#822445"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Habit Progress</Text>
        <Text style={styles.subtitle}>Track your habits and productivity</Text>
      </View>

      <View style={styles.rangeContainer}>{renderTimeRangeSelector()}</View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Summary</Text>
        {renderStatsCards()}
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Progress Chart</Text>
        {renderChart()}
      </View>

      <View style={styles.buttonsContainer}>
        <View style={styles.topButtons}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/AddDistraction')}
          >
            <Feather name="plus-circle" size={20} color="#fff" />
            <Text style={styles.buttonText}>Add Distraction</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/DistractionAnalytics')}
          >
            <Feather name="bar-chart-2" size={20} color="#fff" />
            <Text style={styles.buttonText}>Distraction Analytics</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.middleButtons}>
          <TouchableOpacity
            style={[styles.button, styles.tertiaryButton]}
            onPress={() => router.push('/HabitTipsScreen')}
          >
            <Feather name="book-open" size={20} color="#fff" />
            <Text style={styles.buttonText}>Habit Tips</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.quaternaryButton]}
            onPress={() => router.push('/BadHabitScreen')}
          >
            <Feather name="refresh-cw" size={20} color="#fff" />
            <Text style={styles.buttonText}>Habit Replacement</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2D3748',
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 16,
    fontFamily: 'Inter_700Bold',
  },
  rangeContainer: {
    paddingHorizontal: 24,
    marginVertical: 16,
  },
  rangeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#EDF2F7',
    borderRadius: 12,
    padding: 4,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeRange: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#822445',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rangeText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  activeRangeText: {
    color: '#822445',
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  content: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    borderRadius: 16,
    padding: 16,
    width: '48%',
    minHeight: 120,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 12,
  },
  completedCard: {
    backgroundColor: '#38A169',
  },
  uncompletedCard: {
    backgroundColor: '#E53E3E',
  },
  habitsCard: {
    backgroundColor: '#3182CE',
  },
  rateCard: {
    backgroundColor: '#822445',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  statIconContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 6,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  chart: {
    borderRadius: 12,
    marginTop: 8,
  },
  chartLoadingContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
  },
  noDataContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderRadius: 12,
    padding: 20,
  },
  noDataIcon: {
    backgroundColor: 'rgba(203, 213, 224, 0.2)',
    padding: 16,
    borderRadius: 40,
    marginBottom: 12,
  },
  noDataText: {
    color: '#A0AEC0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  topButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  middleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#822445',
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: '#4C51BF',
    flex: 1,
  },
  tertiaryButton: {
    backgroundColor: '#2D3748',
    flex: 1,
  },
  quaternaryButton: {
    backgroundColor: '#38A169',
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  bottomSpacer: {
    height: 24,
  },
});

export default ProgressScreen;