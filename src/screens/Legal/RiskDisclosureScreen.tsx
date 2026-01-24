import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import { ScreenWrapper, Container } from '../../components/layout';
import { Card, Text } from '../../components/common';
import { useTheme } from '../../hooks';
import { TouchableOpacity } from 'react-native';

export default function RiskDisclosureScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const riskCategories = [
    {
      icon: 'trending-down-outline',
      color: '#f44336',
      title: 'Market Risk',
      risks: [
        'Forex markets are highly volatile and can experience rapid price movements.',
        'Currency values can be affected by economic data, political events, and market sentiment.',
        'Past performance is not indicative of future results.',
        'You may lose some or all of your invested capital.',
      ],
    },
    {
      icon: 'flash-outline',
      color: '#FF9800',
      title: 'Leverage Risk',
      risks: [
        'Leverage amplifies both potential gains and potential losses.',
        'Small market movements can result in significant account changes.',
        'You may lose more than your initial investment if using leverage.',
        'Margin calls may require you to deposit additional funds or close positions.',
      ],
    },
    {
      icon: 'analytics-outline',
      color: '#FFC107',
      title: 'AI & Technology Risk',
      risks: [
        'AI predictions and recommendations are based on historical data and algorithms that may not account for unprecedented market conditions.',
        'Technology failures, system outages, or connectivity issues may prevent you from executing trades.',
        'AI models can produce false signals or inaccurate predictions.',
        'No AI system can guarantee profitable trading outcomes.',
      ],
    },
    {
      icon: 'time-outline',
      color: '#2196F3',
      title: 'Liquidity Risk',
      risks: [
        'During periods of high volatility or low liquidity, you may not be able to execute trades at desired prices.',
        'Slippage can occur, resulting in trades executed at worse prices than expected.',
        'Some currency pairs may have limited liquidity, especially during off-market hours.',
      ],
    },
    {
      icon: 'globe-outline',
      color: '#9C27B0',
      title: 'Regulatory & Legal Risk',
      risks: [
        'Forex trading regulations vary by jurisdiction and may change.',
        'You are responsible for understanding and complying with local laws.',
        'Tax implications of trading vary by country and individual circumstances.',
        'Regulatory changes may impact your ability to trade certain instruments.',
      ],
    },
    {
      icon: 'person-outline',
      color: '#607D8B',
      title: 'Behavioral & Emotional Risk',
      risks: [
        'Emotional decision-making can lead to poor trading outcomes.',
        'Fear and greed can cause traders to deviate from their strategies.',
        'Overtrading and revenge trading often result in significant losses.',
        'Lack of discipline and risk management can deplete trading capital.',
      ],
    },
  ];

  const importantNotices = [
    'This application provides information, analysis, and AI-driven insights for educational purposes only.',
    'Nothing in this app constitutes financial advice, investment advice, or trading recommendations.',
    'You should consult with a licensed financial advisor before making investment decisions.',
    'Trading forex involves substantial risk and is not suitable for all investors.',
    'Only trade with capital you can afford to lose without affecting your financial well-being.',
    'The developers and operators of this app are not responsible for your trading decisions or outcomes.',
    'By using this app, you acknowledge that you understand these risks and accept full responsibility for your trading activities.',
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text variant="h3" style={styles.headerTitle}>
          Risk Disclosure
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Container>
          <View style={[styles.warningBanner, { backgroundColor: '#f4433614', borderColor: '#f4433644' }]}>
            <Icon name="warning-outline" size={32} color="#f44336" />
            <Text variant="h4" style={[styles.warningTitle, { color: '#f44336' }]}>
              Important Risk Warning
            </Text>
            <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.warningText}>
              Trading foreign exchange (forex) carries a high level of risk and may not be suitable for all investors. Please read this disclosure carefully before using our platform.
            </Text>
          </View>

          <Text variant="h4" style={styles.sectionHeader}>
            Understanding Trading Risks
          </Text>

          {riskCategories.map((category, idx) => (
            <Card key={idx} style={[styles.riskCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.riskHeader}>
                <View style={[styles.riskIcon, { backgroundColor: `${category.color}14` }]}>
                  <Icon name={category.icon} size={24} color={category.color} />
                </View>
                <Text variant="h4" style={styles.riskTitle}>
                  {category.title}
                </Text>
              </View>
              {category.risks.map((risk, riskIdx) => (
                <View key={riskIdx} style={styles.riskRow}>
                  <View style={[styles.bullet, { backgroundColor: category.color }]} />
                  <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.riskText}>
                    {risk}
                  </Text>
                </View>
              ))}
            </Card>
          ))}

          <Text variant="h4" style={styles.sectionHeader}>
            Important Notices
          </Text>

          <Card style={[styles.noticeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {importantNotices.map((notice, idx) => (
              <View key={idx} style={styles.noticeRow}>
                <Icon name="checkmark-circle" size={20} color={theme.colors.primary} />
                <Text variant="bodySmall" color={theme.colors.textSecondary} style={styles.noticeText}>
                  {notice}
                </Text>
              </View>
            ))}
          </Card>

          <View style={[styles.footer, { backgroundColor: '#f4433614', borderColor: '#f4433644' }]}>
            <Icon name="shield-outline" size={32} color="#f44336" />
            <Text variant="body" style={[styles.footerTitle, { color: '#f44336' }]}>
              Trade Responsibly
            </Text>
            <Text variant="caption" color={theme.colors.textSecondary} style={styles.footerText}>
              Never invest money you cannot afford to lose. Always use proper risk management, set stop-losses, and maintain realistic expectations about trading outcomes.
            </Text>
          </View>
        </Container>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontWeight: '900',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  warningBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeader: {
    fontWeight: '900',
    marginBottom: 16,
  },
  riskCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  riskIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskTitle: {
    fontWeight: '800',
    flex: 1,
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    marginRight: 10,
  },
  riskText: {
    flex: 1,
    lineHeight: 20,
  },
  noticeCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  noticeText: {
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  footerTitle: {
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  footerText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});
