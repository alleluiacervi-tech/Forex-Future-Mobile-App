import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { CurrencyPair } from '../../types/market';
import { Text } from '../common/Text';
import { colors } from '../../theme';

interface PriceChartProps {
  pair: CurrencyPair;
  timeframe: string;
}

export const PriceChart: React.FC<PriceChartProps> = ({ pair, timeframe }) => {
  // Generate mock chart data
  const generateChartData = () => {
    const basePrice = pair.price;
    const data = [];
    for (let i = 0; i < 24; i++) {
      const variation = (Math.random() - 0.5) * 0.001;
      data.push(basePrice + variation);
    }
    return data;
  };

  const chartData = {
    labels: Array.from({ length: 24 }, (_, i) => {
      if (i % 4 === 0) return `${i}:00`;
      return '';
    }),
    datasets: [
      {
        data: generateChartData(),
        color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const screenWidth = Dimensions.get('window').width - 64;

  return (
    <View style={styles.container}>
      <Text variant="h4" style={styles.title}>
        {pair.symbol} - {timeframe}
      </Text>
      <LineChart
        data={chartData}
        width={screenWidth}
        height={220}
        chartConfig={{
          backgroundColor: colors.surface,
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          decimalPlaces: 5,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: colors.primary,
          },
        }}
        bezier
        style={styles.chart}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        withInnerLines={true}
        withOuterLines={false}
        withShadow={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: 16,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

