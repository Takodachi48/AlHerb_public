import React from 'react';
import { Text, Linking, StyleProp, TextStyle } from 'react-native';

export interface LinkedTextProps {
    text: string;
    style?: StyleProp<TextStyle>;
    linkStyle?: StyleProp<TextStyle>;
}

const LinkedText: React.FC<LinkedTextProps> = ({ text, style, linkStyle }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = String(text).split(urlRegex);

    return (
        <Text style={style}>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return (
                        <Text key={i} style={linkStyle} onPress={() => Linking.openURL(part)}>
                            {part}
                        </Text>
                    );
                }
                return part;
            })}
        </Text>
    );
};

export default LinkedText;
