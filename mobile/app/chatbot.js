import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Platform,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { chatbotService } from '../services/apiServices';
import Header from '../components/common/Header';
import SafeScreen from '../components/layout/SafeScreen';

const markdownStyles = {
    body: {
        fontSize: 15,
        lineHeight: 22,
        color: '#1F2937',
    },
    strong: {
        fontWeight: 'bold',
        color: '#064E3B',
    },
    bullet_list: {
        marginVertical: 4,
    },
    ordered_list: {
        marginVertical: 4,
    },
    list_item: {
        marginVertical: 2,
    },
    paragraph: {
        marginVertical: 2,
    },
    heading1: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#064E3B',
        marginVertical: 4,
    },
    heading2: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#064E3B',
        marginVertical: 4,
    },
    heading3: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#064E3B',
        marginVertical: 2,
    },
    code_inline: {
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        paddingHorizontal: 4,
        fontSize: 13,
        color: '#10B981',
    },
};

const userMarkdownStyles = {
    ...markdownStyles,
    body: {
        ...markdownStyles.body,
        color: '#FFFFFF',
    },
    strong: {
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    heading1: { ...markdownStyles.heading1, color: '#FFFFFF' },
    heading2: { ...markdownStyles.heading2, color: '#FFFFFF' },
    heading3: { ...markdownStyles.heading3, color: '#FFFFFF' },
};

const ChatbotScreen = () => {
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am your AlgoHerbarium AI Assistant. How can I help you today with Philippine medicinal herbs?',
            timestamp: new Date().toISOString()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const flatListRef = useRef(null);

    const handleSend = async () => {
        if (input.trim() === '' || loading) return;

        const userMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        Keyboard.dismiss();

        try {
            // Prepare history (limit to last 10 messages for context)
            const history = messages.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const response = await chatbotService.sendMessage(userMessage.content, history);

            if (response.success) {
                const aiMessage = {
                    id: (Date.now() + 1).toString(),
                    ...response.data
                };
                setMessages(prev => [...prev, aiMessage]);
            }
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please check your connection or try again later.',
                timestamp: new Date().toISOString(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (flatListRef.current) {
            setTimeout(() => {
                flatListRef.current.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages, loading]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, (event) => {
            const height = event?.endCoordinates?.height || 0;
            setKeyboardOffset(height);
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardOffset(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const renderMessage = ({ item }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[
                styles.messageContainer,
                isUser ? styles.userMessageContainer : styles.aiMessageContainer
            ]}>
                {!isUser && (
                    <View style={styles.aiAvatar}>
                        <Ionicons name="leaf" size={16} color="#FFFFFF" />
                    </View>
                )}
                <View style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                    item.isError && styles.errorBubble
                ]}>
                    <Markdown style={isUser ? userMarkdownStyles : markdownStyles}>
                        {item.content}
                    </Markdown>
                    <Text style={styles.timestamp}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeScreen
            style={{ backgroundColor: '#F9FAFB' }}
            topBackgroundColor="#FFFFFF"
            withTabBar={false}
        >
            <View style={styles.container}>
                <Header
                    title="AI Assistant"
                    subtitle="Online"
                    showBack={true}
                    rightActions={[
                        { icon: 'ellipsis-vertical', onPress: () => { }, size: 20 }
                    ]}
                />

                <View
                    style={[
                        styles.chatArea,
                        { paddingBottom: keyboardOffset ? keyboardOffset + insets.bottom : insets.bottom }
                    ]}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.messageList}
                        showsVerticalScrollIndicator={false}
                        ListFooterComponent={loading ? (
                            <View style={styles.loadingContainer}>
                                <View style={styles.loadingBubble}>
                                    <ActivityIndicator size="small" color="#10B981" />
                                </View>
                            </View>
                        ) : null}
                    />

                    <View style={[styles.inputArea, { paddingBottom: 8 }]}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="Ask about herbs..."
                                placeholderTextColor="#9CA3AF"
                                value={input}
                                onChangeText={setInput}
                                multiline
                            />
                            <TouchableOpacity
                                onPress={handleSend}
                                style={[styles.sendButton, input.trim() === '' && styles.sendButtonDisabled]}
                                disabled={input.trim() === '' || loading}
                            >
                                <Ionicons name="send" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </SafeScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    chatArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        marginTop: Platform.OS === 'android' ? 30 : 0,
    },
    backButton: {
        padding: 4,
    },
    headerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#064E3B',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: '#6B7280',
    },
    menuButton: {
        padding: 4,
    },
    messageList: {
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingBottom: 16,
    },
    messageContainer: {
        flexDirection: 'row',
        marginBottom: 20,
        maxWidth: '85%',
    },
    userMessageContainer: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
    },
    aiMessageContainer: {
        alignSelf: 'flex-start',
    },
    aiAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: 4,
    },
    messageBubble: {
        paddingTop: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    userBubble: {
        backgroundColor: '#10B981',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    errorBubble: {
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userMessageText: {
        color: '#FFFFFF',
    },
    aiMessageText: {
        color: '#1F2937',
    },
    timestamp: {
        fontSize: 10,
        color: 'rgba(0,0,0,0.3)',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    loadingContainer: {
        alignSelf: 'flex-start',
        marginBottom: 20,
        marginLeft: 40,
    },
    loadingBubble: {
        paddingTop: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    inputArea: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        maxHeight: 100,
        paddingVertical: 8,
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: '#10B981',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#D1D5DB',
    }
});

export default ChatbotScreen;
