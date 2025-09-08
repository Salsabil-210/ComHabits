import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    TextInput, 
    FlatList, 
    TouchableOpacity, 
    StyleSheet, 
    Image, 
    ActivityIndicator, 
    Alert,
    Dimensions,
    StatusBar,
    SafeAreaView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    searchUsers as searchUsersApi,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriendsList,
    getIncomingRequests,
    removeFriend,
    cancelFriendRequest,
} from '../../api/FriendsApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { Ionicons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');
const primaryButtonColor = '#9C2645';

const FriendsScreen = () => {
    const [activeTab, setActiveTab] = useState('Friends');
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [friends, setFriends] = useState([]);
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchToken = async () => {
            const storedToken = await AsyncStorage.getItem('token');
            setToken(storedToken);
        };
        fetchToken();
    }, []);

 useFocusEffect(
    useCallback(() => {
        if (token) {
            const fetchData = async () => {
                try {
                    if (activeTab === 'Friends') {
                        await fetchFriends();
                    } else if (activeTab === 'Requests') {
                        await fetchIncomingRequests();
                    }
                    
                    // If there's search text, refresh search results too
                    if (searchText.length > 2) {
                        await handleSearch(searchText);
                    }
                } catch (error) {
                    console.error("Error refreshing data:", error);
                }
            };
            
            fetchData();
        }
    }, [activeTab, token, searchText])
);

    const fetchFriends = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getFriendsList(token);
            setFriends(data.friends || []);
        } catch (err) {
            setError(err.message || 'Failed to load friends.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchIncomingRequests = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getIncomingRequests(token);
            setIncomingRequests(data.requests || []);
        } catch (err) {
            setError(err.message || 'Failed to load friend requests.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    const handleSearch = async (text) => {
    setSearchText(text);
    if (text.length > 2) {
        setSearchLoading(true);
        try {
            const data = await searchUsersApi(text, token);
            
            // Check if any of these users already have pending requests
            const updatedResults = data.users.map(user => {
                // Check if user is already a friend
                const isFriend = friends.some(friend => friend._id === user._id);
                if (isFriend) {
                    return { ...user, isFriend: true };
                }
                
                // Check if user has a pending request
                const pendingRequest = incomingRequests.find(req => 
                    req.requester._id === user._id || req.recipient._id === user._id
                );
                
                if (pendingRequest) {
                    return { 
                        ...user, 
                        requestSent: true, 
                        requestId: pendingRequest._id 
                    };
                }
                
                return user;
            });
            
            setSearchResults(updatedResults || []);
        } catch (err) {
            setError(err.message || 'Failed to search users.');
        } finally {
            setSearchLoading(false);
        }
    } else {
        setSearchResults([]);
    }
};

    const handleSendFriendRequest = async (recipientId) => {
        try {
            const result = await sendFriendRequest(recipientId, token);
            setSearchResults(prevResults =>
                prevResults.map(user =>
                    user._id === recipientId ? { ...user, requestSent: true, requestId: result.request._id } : user
                )
            );
            Alert.alert('Success', 'Friend request sent');
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    const handleAcceptRequest = async (requestId) => {
        try {
            await acceptFriendRequest(requestId, token);
            setIncomingRequests(prev => prev.filter(req => req._id !== requestId));
            fetchFriends();
            Alert.alert('Success', 'Friend request accepted');
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            await rejectFriendRequest(requestId, token);
            setIncomingRequests(prev => prev.filter(req => req._id !== requestId));
            Alert.alert('Success', 'Friend request rejected');
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

    const handleRemoveFriend = async (friendId) => {
        Alert.alert(
            "Confirm Removal",
            "Are you sure you want to remove this friend?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Remove",
                    style: "destructive",
                    async onPress() {
                        try {
                            const token = await AsyncStorage.getItem("token");
                            if (!token) {
                                throw new Error("Authentication required");
                            }

                            // Optimistic update - remove from UI immediately
                            setFriends(prev => prev.filter(friend => friend._id !== friendId));
                            
                            const response = await removeFriend(friendId, token);
                            
                            if (!response?.success) {
                                // Revert if failed by refetching friends
                                await fetchFriends();
                                throw new Error(response?.message || "Failed to remove friend");
                            }
                            
                            Alert.alert("Success", "Friend removed successfully");
                        } catch (error) {
                            console.error("Remove friend error:", error);
                            Alert.alert("Error", error.message || "Failed to remove friend");
                        }
                    }
                }
            ]
        );
    };

    const handleCancelRequest = async (requestId, recipientId) => {
        try {
            await cancelFriendRequest(requestId, recipientId, token);
            setSearchResults(prevResults =>
                prevResults.map(user =>
                    user._id === recipientId ? { ...user, requestSent: false, requestId: null } : user
                )
            );
            Alert.alert('Success', 'Friend request canceled');
        } catch (err) {
            Alert.alert('Error', err.message);
        }
    };

   const renderSearchResultItem = ({ item }) => (
    <View style={styles.listItem}>
        <View style={styles.avatarContainer}>
            <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
            <View style={styles.onlineIndicator} />
        </View>
        <View style={styles.listItemText}>
            <Text style={styles.name}>{`${item.name} ${item.surname}`}</Text>
        </View>
        {item.isFriend ? (
            <TouchableOpacity
                onPress={() => handleRemoveFriend(item._id)}
                style={[styles.actionButton, styles.removeBtn]}
                activeOpacity={0.8}>
                <Ionicons name="person-remove-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Remove</Text>
            </TouchableOpacity>
        ) : item.requestSent ? (
            <TouchableOpacity
                onPress={() => handleCancelRequest(item.requestId, item._id)}
                style={[styles.actionButton, styles.pendingBtn]}
                activeOpacity={0.8}>
                <Ionicons name="time-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Pending</Text>
            </TouchableOpacity>
        ) : (
            <TouchableOpacity
                onPress={() => handleSendFriendRequest(item._id)}
                style={[styles.actionButton, styles.addBtn]}
                activeOpacity={0.8}>
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Add</Text>
            </TouchableOpacity>
        )}
    </View>
);

    const renderFriendItem = ({ item }) => (
        <View style={styles.listItem}>
            <View style={styles.avatarContainer}>
                <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
                <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.listItemText}>
                <Text style={styles.name}>{`${item.name} ${item.surname}`}</Text>
            </View>
            <TouchableOpacity
                onPress={() => handleRemoveFriend(item._id)}
                style={[styles.actionButton, styles.removeBtn]}
                activeOpacity={0.8}>
                <Ionicons name="person-remove-outline" size={18} color="#fff" />
                <Text style={styles.buttonText}>Remove</Text>
            </TouchableOpacity>
        </View>
    );

    const renderIncomingRequestItem = ({ item }) => (
        <View style={styles.listItem}>
            <View style={styles.avatarContainer}>
                <Image source={{ uri: item.requester.profilePicture }} style={styles.avatar} />
                <View style={styles.requestBadge}>
                    <Ionicons name="mail" size={12} color="#fff" />
                </View>
            </View>
            <View style={styles.listItemText}>
                <Text style={styles.name}>{`${item.requester.name} ${item.requester.surname}`}</Text>
                <Text style={styles.subtitle}>Wants to be your friend</Text>
            </View>
            <View style={styles.requestActions}>
                <TouchableOpacity
                    onPress={() => handleAcceptRequest(item._id)}
                    style={[styles.actionButton, styles.acceptBtn]}
                    activeOpacity={0.8}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleRejectRequest(item._id)}
                    style={[styles.actionButton, styles.rejectBtn]}
                    activeOpacity={0.8}>
                    <Ionicons name="close-circle-outline" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Reject</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading)
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color={primaryButtonColor} />
                    <Text style={styles.loadingText}>Loading friends...</Text>
                </View>
            </SafeAreaView>
        );

    if (error)
        return (
            <SafeAreaView style={styles.errorContainer}>
                <View style={styles.errorCard}>
                    <Ionicons name="alert-circle-outline" size={50} color="#FF6B6B" />
                    <Text style={styles.errorText}>Oops! Something went wrong</Text>
                    <Text style={styles.errorSubtext}>{error}</Text>
                    <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => {
                            setError(null);
                            if (activeTab === 'Friends') {
                                fetchFriends();
                            } else {
                                fetchIncomingRequests();
                            }
                        }}>
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Friends</Text>
                <Text style={styles.headerSubtitle}>Connect with your friends</Text>
            </View>

            {/* Enhanced Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Ionicons name="search-outline" size={20} color="#9CA3AF" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for friends..."
                        placeholderTextColor="#9CA3AF"
                        value={searchText}
                        onChangeText={handleSearch}
                        returnKeyType="search"
                    />
                    {searchLoading && (
                        <ActivityIndicator style={styles.searchLoading} size="small" color={primaryButtonColor} />
                    )}
                    {searchText.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearch('')}>
                            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Enhanced Tabs */}
            {searchText.length < 3 && (
                <View style={styles.tabsContainer}>
                    <View style={styles.tabsWrapper}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'Friends' && styles.activeTab]}
                            onPress={() => setActiveTab('Friends')}
                            activeOpacity={0.8}>
                            <Ionicons 
                                name={activeTab === 'Friends' ? "people" : "people-outline"} 
                                size={20} 
                                color={activeTab === 'Friends' ? '#fff' : '#6B7280'} 
                                style={styles.tabIcon}
                            />
                            <Text style={[styles.tabText, activeTab === 'Friends' && styles.activeTabText]}>
                                Friends
                            </Text>
                            {friends.length > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{friends.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'Requests' && styles.activeTab]}
                            onPress={() => setActiveTab('Requests')}
                            activeOpacity={0.8}>
                            <Ionicons 
                                name={activeTab === 'Requests' ? "mail" : "mail-outline"} 
                                size={20} 
                                color={activeTab === 'Requests' ? '#fff' : '#6B7280'} 
                                style={styles.tabIcon}
                            />
                            <Text style={[styles.tabText, activeTab === 'Requests' && styles.activeTabText]}>
                                Requests
                            </Text>
                            {incomingRequests.length > 0 && (
                                <View style={[styles.badge, styles.requestBadgeTab]}>
                                    <Text style={styles.badgeText}>{incomingRequests.length}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Content List */}
            <View style={styles.contentContainer}>
                {searchText.length >= 3 ? (
                    // Search Results
                    searchResults.length > 0 ? (
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item) => item._id}
                            renderItem={renderSearchResultItem}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="search-outline" size={60} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>No results found</Text>
                            <Text style={styles.emptySubtitle}>Try searching with different keywords</Text>
                        </View>
                    )
                ) : activeTab === 'Friends' ? (
                    // Friends List
                    friends.length > 0 ? (
                        <FlatList
                            data={friends}
                            keyExtractor={(item) => item._id}
                            renderItem={renderFriendItem}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="people-outline" size={60} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>No friends yet</Text>
                            <Text style={styles.emptySubtitle}>Start connecting with people to build your network</Text>
                        </View>
                    )
                ) : (
                    // Incoming Requests
                    incomingRequests.length > 0 ? (
                        <FlatList
                            data={incomingRequests}
                            keyExtractor={(item) => item._id}
                            renderItem={renderIncomingRequestItem}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContainer}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="mail-outline" size={60} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>No friend requests</Text>
                            <Text style={styles.emptySubtitle}>New friend requests will appear here</Text>
                        </View>
                    )
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
    },
    loadingCard: {
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingHorizontal: 20,
    },
    errorCard: {
        backgroundColor: 'white',
        padding: 30,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
        maxWidth: width - 40,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'center',
        marginTop: 16,
    },
    errorSubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
    },
    retryButton: {
        backgroundColor: primaryButtonColor,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '400',
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        backgroundColor: 'white',
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 50,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    searchLoading: {
        marginHorizontal: 10,
    },
    tabsContainer: {
        backgroundColor: 'white',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    tabsWrapper: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        position: 'relative',
    },
    activeTab: {
        backgroundColor: primaryButtonColor,
        shadowColor: primaryButtonColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    tabIcon: {
        marginRight: 6,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    activeTabText: {
        color: '#fff',
    },
    badge: {
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
    requestBadgeTab: {
        backgroundColor: '#F59E0B',
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    },
    contentContainer: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    listContainer: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 20,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    avatarContainer: {
        position: 'relative',
        marginRight: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#E5E7EB',
        borderWidth: 3,
        borderColor: '#F3F4F6',
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: 'white',
    },
    requestBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: primaryButtonColor,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    listItemText: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '400',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    addBtn: {
        backgroundColor: primaryButtonColor,
    },
    pendingBtn: {
        backgroundColor: '#F59E0B',
    },
    removeBtn: {
        backgroundColor: '#EF4444',
    },
    acceptBtn: {
        backgroundColor: primaryButtonColor,
        marginRight: 8,
    },
    rejectBtn: {
        backgroundColor: '#EF4444',
    },
    requestActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default FriendsScreen;