import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
    logDistraction, 
    getDistractionLogs,
    updateDistraction,
    deleteDistraction 
} from "../api/DistractionApi";

const DistractionScreen = () => {
    const [formData, setFormData] = useState({
        category: '',
        severity: 3,
        description: ''
    });
    const [distractions, setDistractions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const categories = [
        'Social Media',
        'Environment',
        'Health',
        'Mood',
        'Lack of Time',
        'Other'
    ];

    const categoryDescriptions = {
        'Social Media': 'Scrolling through social platforms',
        'Environment': 'Noise or surroundings',
        'Health': 'Physical or mental health issue',
        'Mood': 'Emotional state affecting focus',
        'Lack of Time': 'Not enough time to complete task',
        'Other': 'Other unspecified distraction'
    };

    useEffect(() => {
        fetchDistractions();
    }, []);

    const fetchDistractions = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            if (token) {
                const response = await getDistractionLogs({}, token);
                setDistractions(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching distractions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCategorySelect = (category) => {
        setFormData({
            ...formData,
            category,
            description: categoryDescriptions[category] || ''
        });
    };

    const handleSubmit = async () => {
        if (!formData.category) {
            alert('Please select a category');
            return;
        }

        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            await logDistraction(formData, token);
            await fetchDistractions();
            setFormData({
                category: '',
                severity: 3,
                description: ''
            });
            alert('Distraction logged successfully!');
        } catch (error) {
            console.error('Error logging distraction:', error);
            alert('Failed to log distraction');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            category: '',
            severity: 3,
            description: ''
        });
    };

    const handleEdit = (id) => {
        setEditingId(id);
        const distraction = distractions.find(d => d._id === id);
        setFormData({
            category: distraction.category,
            severity: distraction.severity,
            description: distraction.description
        });
    };

    const handleUpdate = async () => {
        try {
            setIsLoading(true);
            const token = await AsyncStorage.getItem('token');
            await updateDistraction(editingId, formData, token);
            await fetchDistractions();
            setEditingId(null);
            setFormData({
                category: '',
                severity: 3,
                description: ''
            });
            Alert.alert('Success', 'Distraction updated successfully!');
        } catch (error) {
            console.error('Error updating distraction:', error);
            Alert.alert('Error', 'Failed to update distraction');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        Alert.alert(
            'Delete Distraction',
            'Are you sure you want to delete this distraction?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Delete',
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            const token = await AsyncStorage.getItem('token');
                            await deleteDistraction(id, token);
                            await fetchDistractions();
                            Alert.alert('Success', 'Distraction deleted successfully!');
                        } catch (error) {
                            console.error('Error deleting distraction:', error);
                            Alert.alert('Error', 'Failed to delete distraction');
                        } finally {
                            setIsLoading(false);
                        }
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    const getDescriptionInputStyle = () => ({
        ...styles.descriptionInput,
        backgroundColor: formData.category ? '#fff' : '#f5f5f5'
    });

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7B1FA2" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <Text style={styles.header}>
                {editingId ? 'Edit Distraction' : 'Log New Distraction'}
            </Text>

            {/* Category Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Category:</Text>
                <View style={styles.categoryContainer}>
                    {categories.map((category) => (
                        <TouchableOpacity
                            key={category}
                            style={[
                                styles.categoryButton,
                                formData.category === category && styles.selectedCategory
                            ]}
                            onPress={() => handleCategorySelect(category)}
                        >
                            <Text style={[
                                styles.categoryText,
                                formData.category === category && styles.selectedCategoryText
                            ]}>{category}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Description */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description auto-filled</Text>
                <TextInput
                    style={getDescriptionInputStyle()}
                    multiline
                    value={formData.description}
                    onChangeText={(text) => setFormData({...formData, description: text})}
                    placeholder="Description will auto-fill when you select a category"
                    editable={!!formData.category}
                />
            </View>

            {/* Severity Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Distraction Severity:</Text>
                <View style={styles.severityContainer}>
                    {[1, 2, 3, 4, 5].map((num) => (
                        <TouchableOpacity
                            key={num}
                            style={[
                                styles.severityButton,
                                styles[`severityButton${num}`],
                                formData.severity === num && styles[`selectedSeverity${num}`]
                            ]}
                            onPress={() => setFormData({...formData, severity: num})}
                        >
                            <Text style={styles.severityText}>{num}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.severityLabel}>
                    {formData.severity === 1 ? 'Minor' :
                        formData.severity === 2 ? '' :
                            formData.severity === 3 ? 'Significant' :
                                formData.severity === 4 ? '' : 'Critical'}
                </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                        if (editingId) {
                            setEditingId(null);
                            setFormData({
                                category: '',
                                severity: 3,
                                description: ''
                            });
                        } else {
                            handleCancel();
                        }
                    }}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.logButton}
                    onPress={editingId ? handleUpdate : handleSubmit}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? (editingId ? 'Updating...' : 'Logging...') : 
                         (editingId ? 'Update' : 'Log Distraction')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Recent Distractions */}
            <View style={styles.section}>
                <Text style={styles.recentDistractionsTitle}>Recent Distractions</Text>
                {distractions.length === 0 ? (
                    <Text style={styles.noDataText}>No distractions logged yet</Text>
                ) : (
                    distractions.map((distraction) => (
                        <View key={distraction._id} style={styles.distractionCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardCategory}>{distraction.category}</Text>
                                <Text style={styles.cardSeverity}>{distraction.severity}/5</Text>
                            </View>
                            <Text style={styles.cardDescription}>{distraction.description}</Text>
                            <Text style={styles.cardDate}>
                                {new Date(distraction.timestamp).toLocaleString()}
                            </Text>
                            <View style={styles.cardActions}>
                                <TouchableOpacity 
                                    onPress={() => handleEdit(distraction._id)}
                                    style={styles.editButton}
                                >
                                    <MaterialIcons name="edit" size={20} color="#4CAF50" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => handleDelete(distraction._id)}
                                    style={styles.deleteButton}
                                >
                                    <MaterialIcons name="delete" size={20} color="#F44336" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F5F5F5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#212121',
        textAlign: 'center',
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#424242',
    },
    categoryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 15,
    },
    categoryButton: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 20,
        backgroundColor: '#E0E0E0',
    },
    selectedCategory: {
        backgroundColor: '#822445',
    },
    categoryText: {
        fontSize: 14,
        color: '#424242',
    },
    selectedCategoryText: {
        color: '#FFFFFF',
    },
    descriptionInput: {
        borderWidth: 1,
        borderColor: '#BDBDBD',
        borderRadius: 8,
        padding: 12,
        minHeight: 80,
        textAlignVertical: 'top',
        fontSize: 14,
        color: '#616161',
    },
    severityContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    severityButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    severityButton1: {
        backgroundColor: '#81C784',
    },
    severityButton2: {
        backgroundColor: '#FFF176',
    },
    severityButton3: {
        backgroundColor: '#F4511E',
    },
    severityButton4: {
        backgroundColor: '#E57373',
    },
    severityButton5: {
        backgroundColor: '#D32F2F',
    },
    selectedSeverity1: {
        backgroundColor: '#66BB6A',
    },
    selectedSeverity2: {
        backgroundColor: '#FFEE58',
    },
    selectedSeverity3: {
        backgroundColor: '#E64A19',
    },
    selectedSeverity4: {
        backgroundColor: '#EF5350',
    },
    selectedSeverity5: {
        backgroundColor: '#C62828',
    },
    severityText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    severityLabel: {
        fontSize: 14,
        color: '#757575',
        textAlign: 'center',
        marginTop: 5,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    logButton: {
        backgroundColor: '#822445',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
        marginLeft: 8,
    },
    cancelButton: {
        backgroundColor: '#BDBDBD',
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    recentDistractionsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#424242',
    },
    noDataText: {
        textAlign: 'center',
        color: '#9E9E9E',
        fontStyle: 'italic',
        marginVertical: 20,
    },
    distractionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    cardCategory: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#822445',
    },
    cardSeverity: {
        fontSize: 16,
        color: '#D32F2F',
        fontWeight: 'bold',
    },
    cardDescription: {
        fontSize: 14,
        color: '#757575',
        marginBottom: 10,
    },
    cardDate: {
        fontSize: 12,
        color: '#9E9E9E',
        textAlign: 'right',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 15,
        marginTop: 10
    },
    editButton: {
        padding: 5
    },
    deleteButton: {
        padding: 5
    }
});

export default DistractionScreen;