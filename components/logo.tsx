import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LogoProps {
  size?: number;
  color?: string;
  showText?: boolean;
}

export function Logo({ size = 48, color = '#2196F3', showText = true }: LogoProps) {
  return (
    <View style={[styles.container, { width: showText ? size * 2.5 : size }]}>
      <View style={[styles.iconContainer, { 
        width: size, 
        height: size, 
        backgroundColor: color,
        borderRadius: size * 0.2 
      }]}>
        <Ionicons 
          name="book" 
          size={size * 0.6} 
          color="white" 
        />
      </View>
      {showText && (
        <Text style={[styles.text, { 
          fontSize: size * 0.35,
          marginLeft: size * 0.2,
          color: color 
        }]}>
          ReadBible
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontWeight: 'bold',
  },
});