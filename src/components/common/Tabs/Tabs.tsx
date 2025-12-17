import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { TabsProps } from './Tabs.types';
import { tabsStyles } from './Tabs.styles';

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <View style={tabsStyles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            tabsStyles.tab,
            activeTab === tab && tabsStyles.tabActive,
          ]}
          onPress={() => onTabChange(tab)}
        >
          <Text
            style={[
              tabsStyles.tabText,
              activeTab === tab && tabsStyles.tabTextActive,
            ]}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

