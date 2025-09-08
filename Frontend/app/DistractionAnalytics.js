import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Feather } from '@expo/vector-icons';
import { getDistractionCounts } from '../api/DistractionApi';

const DistractionAnalytics = () => {
  const [distractions, setDistractions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getDistractionCounts();
        console.log('Full response:', response); // Debug log
        
        if (response.success && response.data && response.data.categoryCounts) {
          // Access the categoryCounts array from the nested data object
          const sortedData = response.data.categoryCounts
            .sort((a, b) => b.count - a.count)
            .slice(0, 4); // Get top 4 distractions
          
          console.log('Sorted data:', sortedData); // Debug log
          setDistractions(sortedData);
        } else {
          console.log('No category counts found in response');
          setDistractions([]);
        }
      } catch (error) {
        console.error('Error fetching distraction counts:', error);
        setDistractions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getCategoryIcon = (category) => {
    const iconMap = {
      'Social Media': 'smartphone',
      'Environment': 'home',
      'Health': 'heart',
      'Mood': 'cloud-rain',
      'Lack of Time': 'clock',
      'Other': 'help-circle'
    };
    return iconMap[category] || 'alert-triangle';
  };

  const getCategoryColor = (category, index) => {
    const colorMap = {
      'Social Media': '#3B82F6',
      'Environment': '#10B981',
      'Health': '#EF4444',
      'Mood': '#8B5CF6',
      'Lack of Time': '#F59E0B',
      'Other': '#6B7280'
    };
    const fallbackColors = ['#822445', '#059669', '#DC2626', '#7C3AED'];
    return colorMap[category] || fallbackColors[index % fallbackColors.length];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#822445" />
          <Text style={styles.loadingText}>Analyzing your distractions...</Text>
        </View>
      </View>
    );
  }

  // Format chart data with longer labels and better formatting
  const chartData = {
    labels: distractions.map(item => {
      const label = item._id || 'Unknown';
      // Increased character limit and better label handling
      return label.length > 15 ? label.substring(0, 15) + '...' : label;
    }),
    datasets: [{
      data: distractions.length > 0 ? distractions.map(item => item.count || 0) : [0],
      color: (opacity = 1) => `rgba(130, 36, 69, ${opacity})`,
      strokeWidth: 3
    }]
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="trending-up" size={24} color="#822445" />
        </View>
        <Text style={styles.title}>Distraction Analytics</Text>
        <Text style={styles.subtitle}>Track your focus patterns</Text>
      </View>
      
      {/* Chart Section */}
      <View style={styles.chartContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <Feather name="bar-chart-2" size={16} color="#822445" />
          </View>
          <Text style={styles.sectionTitle}>Distraction Frequency</Text>
        </View>
        
        {distractions.length > 0 ? (
          <View style={styles.chartWrapper}>
            <LineChart
              data={chartData}
              width={Dimensions.get('window').width - 60}
              height={320}
              yAxisLabel=""
              yAxisSuffix=""
              yAxisInterval={1}
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#f8f9fa",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(130, 36, 69, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(74, 85, 104, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: "6",
                  strokeWidth: "3",
                  stroke: "#822445",
                  fill: "#ffffff"
                },
                propsForBackgroundLines: {
                  strokeDasharray: "3,3",
                  stroke: "#E2E8F0",
                  strokeWidth: 1
                },
                propsForLabels: {
                  fontSize: 12,
                  fontWeight: "600"
                },
                formatYLabel: (value) => {
                  try {
                    return Math.round(value).toString();
                  } catch (e) {
                    return value.toString();
                  }
                }
              }}
              bezier
              style={styles.chart}
              verticalLabelRotation={-45}
              fromZero
              segments={4}
            />
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <View style={styles.noDataIcon}>
              <Feather name="bar-chart-2" size={32} color="#CBD5E0" />
            </View>
            <Text style={styles.noDataTitle}>No Data Available</Text>
            <Text style={styles.noDataText}>Start logging distractions to see your analytics</Text>
          </View>
        )}
      </View>

      {/* Most Common Distractions Section */}
      <View style={styles.distractionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <Feather name="target" size={16} color="#822445" />
          </View>
          <Text style={styles.sectionTitle}>Top Distractions</Text>
        </View>
        
        {distractions.length > 0 ? (
          <View style={styles.distractionGrid}>
            {distractions.map((distraction, index) => {
              const categoryColor = getCategoryColor(distraction._id, index);
              const iconName = getCategoryIcon(distraction._id);
              
              return (
                <View key={index} style={[styles.distractionCard, { borderLeftColor: categoryColor }]}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.distractionIconContainer, { backgroundColor: `${categoryColor}15` }]}>
                      <Feather name={iconName} size={14} color={categoryColor} />
                    </View>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.distractionName} numberOfLines={2}>
                    {distraction._id || 'Unknown'}
                  </Text>
                  
                  <View style={styles.distractionStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{distraction.count || 0}</Text>
                      <Text style={styles.statLabel}>occurrences</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: categoryColor }]}>
                        {distraction.avgSeverity ? distraction.avgSeverity.toFixed(1) : 'N/A'}
                      </Text>
                      <Text style={styles.statLabel}>avg severity</Text>
                    </View>
                  </View>
                  
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${Math.min((distraction.count / Math.max(...distractions.map(d => d.count))) * 100, 100)}%`,
                            backgroundColor: categoryColor 
                          }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="target" size={32} color="#CBD5E0" />
            </View>
            <Text style={styles.emptyTitle}>No Distractions Recorded</Text>
            <Text style={styles.emptyText}>Your analytics will appear here once you start tracking</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 16,
  },
  chart: {
    borderRadius: 16,
  },
  noDataContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  noDataIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  distractionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  distractionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  distractionCard: {
    width: '48%',
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distractionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rankText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  distractionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    lineHeight: 18,
  },
  distractionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default DistractionAnalytics;