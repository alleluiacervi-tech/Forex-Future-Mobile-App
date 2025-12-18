import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { mockCurrencyPairs } from '../data/mockData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TradingScreen() {
  // Get parent stack navigator to navigate to stack screens
  const navigation = useNavigation<NavigationProp>();
  const stackNavigation = navigation.getParent<NavigationProp>();
  const [selectedPair, setSelectedPair] = useState(mockCurrencyPairs[0]);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [lotSize, setLotSize] = useState('0.01');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const handleTrade = () => {
    Alert.alert(
      'Confirm Trade',
      `${tradeType.toUpperCase()} ${lotSize} lots of ${selectedPair.symbol}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            Alert.alert('Success', 'Trade executed successfully!');
            setLotSize('0.01');
            setStopLoss('');
            setTakeProfit('');
          },
        },
      ]
    );
  };

  const marginRequired = parseFloat(lotSize) * 1000;
  const pipValue = parseFloat(lotSize) * 10;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Pair Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Currency Pair</Text>
          <TouchableOpacity
            style={styles.pairSelector}
            onPress={() => {
              const nav = stackNavigation || navigation;
              nav.navigate('TradeDetail', { pair: selectedPair.symbol });
            }}
          >
            <View>
              <Text style={styles.pairSymbol}>{selectedPair.symbol}</Text>
              <Text style={styles.pairPrice}>
                ${selectedPair.price.toFixed(5)}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#9e9e9e" />
          </TouchableOpacity>
        </View>

        {/* Trade Type Selector */}
        <View style={styles.section}>
          <View style={styles.tradeTypeContainer}>
            <TouchableOpacity
              style={[
                styles.tradeTypeButton,
                tradeType === 'buy' && styles.tradeTypeButtonActive,
                tradeType === 'buy' && { backgroundColor: '#4CAF50' },
              ]}
              onPress={() => setTradeType('buy')}
            >
              <Text
                style={[
                  styles.tradeTypeText,
                  tradeType === 'buy' && styles.tradeTypeTextActive,
                ]}
              >
                BUY
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tradeTypeButton,
                tradeType === 'sell' && styles.tradeTypeButtonActive,
                tradeType === 'sell' && { backgroundColor: '#f44336' },
              ]}
              onPress={() => setTradeType('sell')}
            >
              <Text
                style={[
                  styles.tradeTypeText,
                  tradeType === 'sell' && styles.tradeTypeTextActive,
                ]}
              >
                SELL
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Trading Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lot Size</Text>
          <TextInput
            style={styles.input}
            value={lotSize}
            onChangeText={setLotSize}
            keyboardType="decimal-pad"
            placeholder="0.01"
            placeholderTextColor="#666"
          />

          <Text style={styles.sectionTitle}>Stop Loss (pips)</Text>
          <TextInput
            style={styles.input}
            value={stopLoss}
            onChangeText={setStopLoss}
            keyboardType="numeric"
            placeholder="Optional"
            placeholderTextColor="#666"
          />

          <Text style={styles.sectionTitle}>Take Profit (pips)</Text>
          <TextInput
            style={styles.input}
            value={takeProfit}
            onChangeText={setTakeProfit}
            keyboardType="numeric"
            placeholder="Optional"
            placeholderTextColor="#666"
          />
        </View>

        {/* Trade Info */}
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.infoCard}
        >
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Margin Required</Text>
            <Text style={styles.infoValue}>${marginRequired.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Pip Value</Text>
            <Text style={styles.infoValue}>${pipValue.toFixed(2)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Spread</Text>
            <Text style={styles.infoValue}>2.0 pips</Text>
          </View>
        </LinearGradient>

        {/* Execute Button */}
        <TouchableOpacity
          style={[
            styles.executeButton,
            { backgroundColor: tradeType === 'buy' ? '#4CAF50' : '#f44336' },
          ]}
          onPress={handleTrade}
        >
          <Text style={styles.executeButtonText}>
            {tradeType.toUpperCase()} {selectedPair.symbol}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#9e9e9e',
    marginBottom: 12,
    fontWeight: '500',
  },
  pairSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
  },
  pairSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  pairPrice: {
    fontSize: 16,
    color: '#4CAF50',
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeTypeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  tradeTypeButtonActive: {
    opacity: 1,
  },
  tradeTypeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#9e9e9e',
  },
  tradeTypeTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  infoCard: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#9e9e9e',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  executeButton: {
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  executeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

