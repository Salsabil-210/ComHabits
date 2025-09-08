import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Icon, Checkbox, Button, Card } from "react-native-paper";
import { useRouter } from "expo-router";
import { getFriendsList } from "../api/FriendsApi";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RequestHabitScreen = () => {
    const router = useRouter();
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchToken = async () => {
            const storedToken = await AsyncStorage.getItem('token');
            console.log("Token fetched in RequestHabitScreen:", storedToken);
            setToken(storedToken);
        };
        fetchToken();
    }, []);

    const fetchFriends = useCallback(async (currentToken) => {
        if (!currentToken) {
            console.log("No token available to fetch friends yet.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await getFriendsList(currentToken);
            console.log("Friends data received:", data);
            setFriends(data?.friends || []);
        } catch (err) {
            console.error("Error fetching friends:", err);
            setError(err.message || 'Failed to load friends.');
        } finally {
            setLoading(false);
        }
    }, [getFriendsList]);

    useEffect(() => {
        if (token) {
            fetchFriends(token);
        }
    }, [token, fetchFriends]);

    const toggleSelection = (friendId) => {
        setSelectedFriends(prev =>
            prev.includes(friendId)
                ? prev.filter(id => id !== friendId)
                : [...prev, friendId]
        );
    };

    const handleSend = () => {
        router.push({
            pathname: "/AddHabitScreen",
            params: { selectedFriends: JSON.stringify(selectedFriends) }
        });
    };

    const renderFriendItem = ({ item }) => (
        <TouchableOpacity
            style={styles.friendItem}
            onPress={() => toggleSelection(item._id)}
        >
            <Checkbox
                status={selectedFriends.includes(item._id) ? "checked" : "unchecked"}
            />
            <Text style={styles.friendName}>
                {item.name} {item.surname}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Card style={styles.header}>
                <Card.Title
                    title="Select Friends"
                    left={() => <Icon source="account-group" size={24} />}
                />
            </Card>

            {loading ? (
                <View style={styles.center}>
                    <Text>Loading friends...</Text>
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={{ color: 'red' }}>Error: {error}</Text>
                </View>
            ) : friends.length === 0 ? (
                <View style={styles.center}>
                    <Text>No friends found</Text>
                </View>
            ) : (
                <FlatList
                    data={friends}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.list}
                    renderItem={renderFriendItem}
                />
            )}

            <View style={styles.footer}>
                <Button
                    mode="outlined"
                    onPress={() => router.back()}
                >
                    Cancel
                </Button>
                <Button
                    mode="contained"
                    onPress={handleSend}
                    disabled={selectedFriends.length === 0}
                >
                    {`Send (${selectedFriends.length})`}
                </Button>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5'
    },
    header: {
        marginBottom: 16,
        borderRadius: 8
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    list: {
        paddingBottom: 80
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        backgroundColor: 'white',
        borderRadius: 8
    },
    friendName: {
        marginLeft: 12,
        fontSize: 16
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#eee'
    }
});

export default RequestHabitScreen;