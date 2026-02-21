import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  TextInput,
  Alert,
  Dimensions,
  Switch,
} from 'react-native';
import {LineChart, PieChart} from 'react-native-chart-kit';
import Slider from '@react-native-community/slider';

// theme colors
const COLORS = {
  background: '#0f0f1e',
  card: '#1a1a2e',
  text: '#ffffff',
  secondary: '#9e9e9e',
  accent: '#4CAF50',
  danger: '#f44336',
  warning: '#FFC107',
  info: '#2196F3',
};

// mock data constants
const initialStats = [
  {
    title: 'Total Users',
    value: '1,240',
    subtitle: '+28 this week',
    trend: 'up',
  },
  {
    title: 'Active Subscribers',
    value: '847',
    subtitle: '68% conversion',
    trend: 'up',
  },
  {
    title: 'Revenue This Month',
    value: '$16,940',
    subtitle: '+12% last month',
    trend: 'up',
  },
  {
    title: 'Alerts Today',
    value: '342',
    subtitle: '6 currency pairs',
    trend: 'neutral',
  },
];

const revenueData = {
  labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  datasets: [
    {
      data: [12000, 13200, 15000, 14000, 15500, 16000, 16940],
      color: () => COLORS.accent,
      strokeWidth: 2,
      name: 'Monthly',
    },
    {
      data: [40000, 42000, 44000, 43000, 45000, 46000, 47000],
      color: () => '#FFC107',
      strokeWidth: 2,
      name: '3 Month',
    },
    {
      data: [200000, 202000, 205000, 203000, 206000, 208000, 203280],
      color: () => '#2196F3',
      strokeWidth: 2,
      name: 'Annual',
    },
  ],
};

const subscriptionPieData = [
  {
    name: 'Monthly',
    population: 42,
    color: COLORS.accent,
    legendFontColor: COLORS.text,
    legendFontSize: 12,
  },
  {
    name: '3 Months',
    population: 31,
    color: '#FFC107',
    legendFontColor: COLORS.text,
    legendFontSize: 12,
  },
  {
    name: 'Annual',
    population: 27,
    color: '#2196F3',
    legendFontColor: COLORS.text,
    legendFontSize: 12,
  },
];

const alertTypes = ['Spike', 'Breakout', 'Volume Surge', 'Momentum Shift'];
const pairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'GBP/JPY'];

const userList = [
  {name: 'Alice Baker', email: 'alice@example.com', plan: 'Monthly', status: 'Active'},
  {name: 'Bob Carter', email: 'bob@example.com', plan: '3 Months', status: 'Trial'},
  {name: 'Cara Diaz', email: 'cara@example.com', plan: 'Annual', status: 'Active'},
  {name: 'Dan Evans', email: 'dan@example.com', plan: 'Monthly', status: 'Cancelled'},
  {name: 'Eva Ford', email: 'eva@example.com', plan: '3 Months', status: 'Active'},
  {name: 'Frank Green', email: 'frank@example.com', plan: 'Annual', status: 'Active'},
  {name: 'Gina Hall', email: 'gina@example.com', plan: 'Monthly', status: 'Trial'},
  {name: 'Hank Ivy', email: 'hank@example.com', plan: 'Annual', status: 'Active'},
];

const notificationsInitial = [
  {type: 'danger', message: 'Card declined for user@email.com', time: '2m ago'},
  {type: 'info', message: 'New user joined — Trial started', time: '5m ago'},
  {type: 'warning', message: 'FCS API reconnected after 3s', time: '10m ago'},
  {type: 'warning', message: '342 alerts sent in last hour', time: '30m ago'},
  {type: 'accent', message: 'New annual subscription — $192', time: '1h ago'},
];

const screenWidth = Dimensions.get('window').width - 32;

export default function AdminDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alerts, setAlerts] = useState([]);
  const [wsTicks, setWsTicks] = useState(0);
  const [lastTick, setLastTick] = useState(new Date());
  const [sensitivity, setSensitivity] = useState(70);
  const [volumeThreshold, setVolumeThreshold] = useState(60);
  const [toggles, setToggles] = useState({
    "EUR/USD": true,
    "GBP/USD": true,
    "USD/JPY": true,
    "AUD/USD": true,
    master: true,
  });
  const [searchText, setSearchText] = useState('');
  const [filteredUsers, setFilteredUsers] = useState(userList);
  const [notifications, setNotifications] = useState(notificationsInitial);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const clock = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {toValue: 1.4, duration: 600, useNativeDriver: true}),
        Animated.timing(pulseAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
      ])
    ).start();
  }, [pulseAnim]);

  // live alerts feed
  useEffect(() => {
    const interval = setInterval(() => {
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const type = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const direction = Math.random() > 0.5 ? 'up' : 'down';
      const usersReached = Math.floor(Math.random() * 500) + 50;
      const time = new Date().toLocaleTimeString();
      const newAlert = {pair, type, direction, usersReached, time};
      setAlerts(prev => {
        const next = [newAlert, ...prev];
        return next.slice(0, 6);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // websocket ticks
  useEffect(() => {
    let ticks = 0;
    const intv = setInterval(() => {
      ticks += Math.floor(Math.random() * 5) + 1;
      setWsTicks(prev => Math.min(prev + ticks, 342));
      setLastTick(new Date());
    }, 3000);
    return () => clearInterval(intv);
  }, []);

  // filter users
  useEffect(() => {
    const text = searchText.toLowerCase();
    setFilteredUsers(
      userList.filter(u =>
        u.name.toLowerCase().includes(text) || u.email.toLowerCase().includes(text)
      )
    );
  }, [searchText]);

  const handleUserPress = (user) => {
    Alert.alert(
      user.name,
      `${user.email}\nPlan: ${user.plan}\nStatus: ${user.status}`,
      [
        {text: 'View', onPress: () => {}},
        {text: 'Suspend', onPress: () => {}},
        {text: 'Cancel Subscription', onPress: () => {}},
        {text: 'Close', style: 'cancel'},
      ]
    );
  };

  const markAllRead = () => setNotifications([]);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLogo}>💎</Text>
          <Text style={styles.headerTitle}>Forex Future Admin</Text>
        </View>
        <View style={styles.headerRight}>
          <Animated.View
            style={[styles.liveDot, {transform: [{scale: pulseAnim}]}]}
          />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>
      <Text style={styles.clock}>{currentTime.toLocaleString()}</Text>

      {/* Section 1: Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        {initialStats.map((stat, idx) => (
          <PressableStatCard key={idx} stat={stat} />
        ))}
      </ScrollView>

      {/* Section 2: Revenue Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Overview — Last 30 Days</Text>
        <LineChart
          data={revenueData}
          width={screenWidth}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots={false}
        />
        <View style={styles.legendContainer}>
          {revenueData.datasets.map((d, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendColor, {backgroundColor: d.color()}]} />
              <Text style={styles.legendText}>{d.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Section 3: Subscription Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription Breakdown</Text>
        <PieChart
          data={subscriptionPieData}
          width={screenWidth}
          height={180}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
        <View style={styles.legendContainer}>
          {subscriptionPieData.map((d,i)=>(
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendColor,{backgroundColor: d.color}]} />
              <Text style={styles.legendText}>{d.name} — {d.population}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Section 4: Live Alerts Feed */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Live Alerts Feed</Text>
          <Animated.View style={[styles.redDot, {opacity: pulseAnim.interpolate({
            inputRange:[1,1.4],
            outputRange:[1,0.4]
          })}]} />
        </View>
        <View style={styles.card}>
          {alerts.map((a, i) => (
            <AnimatedAlertRow key={i} alert={a} />
          ))}
        </View>
      </View>

      {/* Section 5: WebSocket Monitor */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WebSocket Monitor</Text>
        <View style={styles.card}>
          <View style={styles.wsRow}>
            <View style={styles.greenDot} />
            <Text style={[styles.wsStatus,{color: COLORS.accent}]}>Connected</Text>
          </View>
          <View style={styles.wsRow}><Text style={styles.wsLabel}>Provider:</Text><Text style={styles.wsValue}>FCS API</Text></View>
          <View style={styles.wsRow}><Text style={styles.wsLabel}>Ticks / min:</Text><Text style={styles.wsValue}>{wsTicks}</Text></View>
          <View style={styles.wsRow}><Text style={styles.wsLabel}>Last tick:</Text><Text style={styles.wsValue}>{lastTick.toLocaleTimeString()}</Text></View>
          <View style={styles.wsRow}><Text style={styles.wsLabel}>Uptime:</Text><Text style={styles.wsValue}>99.8%</Text></View>
          <View style={styles.wsRow}><Text style={styles.wsLabel}>Reconnection attempts:</Text><Text style={styles.wsValue}>0</Text></View>
        </View>
      </View>

      {/* Section 6: Alert Engine Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Engine Controls</Text>
        <View style={styles.card}>
          <Text style={styles.controlLabel}>Global Alerts</Text>
          <Switch
            value={toggles.master}
            onValueChange={v=>setToggles(t=>({...t,master:v}))}
            trackColor={{true:COLORS.accent}}
          />
          <View style={styles.sliderRow}>
            <Text style={styles.controlLabel}>Sensitivity {sensitivity}%</Text>
            <Slider
              style={{flex:1}}
              value={sensitivity}
              minimumValue={0}
              maximumValue={100}
              onValueChange={v=>setSensitivity(Math.round(v))}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.secondary}
            />
          </View>
          <View style={styles.sliderRow}>
            <Text style={styles.controlLabel}>Volume threshold {volumeThreshold}%</Text>
            <Slider
              style={{flex:1}}
              value={volumeThreshold}
              minimumValue={0}
              maximumValue={100}
              onValueChange={v=>setVolumeThreshold(Math.round(v))}
              minimumTrackTintColor={COLORS.accent}
              maximumTrackTintColor={COLORS.secondary}
            />
          </View>
          {['EUR/USD','GBP/USD','USD/JPY','AUD/USD'].map(p=>(
            <View key={p} style={styles.toggleRow}>
              <Text style={styles.controlLabel}>{p}</Text>
              <Switch
                value={toggles[p]}
                onValueChange={v=>setToggles(t=>({...t,[p]:v}))}
                trackColor={{true:COLORS.accent}}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Section 7: User Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Management</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor={COLORS.secondary}
          value={searchText}
          onChangeText={setSearchText}
        />
        <View style={styles.card}>
          {filteredUsers.map((u,i)=>(
            <TouchableOpacity key={i} style={styles.userRow} onPress={()=>handleUserPress(u)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{u.name.split(' ').map(n=>n[0]).join('')}</Text></View>
              <View style={{flex:1,marginLeft:8}}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </View>
              <View style={styles.badge(u.plan)}><Text style={styles.badgeText}>{u.plan}</Text></View>
              <View style={styles.badge(u.status)}><Text style={styles.badgeText}>{u.status}</Text></View>
              <Text style={styles.chevron}>&gt;</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Section 8: Revenue Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Metrics</Text>
        <View style={styles.card}>
          {[
            ['New subscribers today', '14'],
            ['Cancelled today','3'],
            ['Trial conversions this week','67%'],
            ['Churn rate','2.3%'],
            ['MRR','$16,940'],
            ['ARR','$203,280'],
          ].map(([label,value],i)=>(
            <View key={i} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{label}</Text>
              <Text style={styles.metricValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Section 9: Admin Notifications */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Admin Notifications</Text>
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markRead}>Mark all read</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          {notifications.map((n,i)=>(
            <View key={i} style={styles.notifRow}>
              <View style={[styles.notifIcon,{backgroundColor:COLORS[n.type]||COLORS.info}]} />
              <Text style={styles.notifText}>{n.message}</Text>
              <Text style={styles.notifTime}>{n.time}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// small components
function PressableStatCard({stat}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, {toValue:0.95,useNativeDriver:true}).start();
  const onPressOut = () => Animated.spring(scale, {toValue:1,useNativeDriver:true}).start();
  return (
    <Animated.View style={[styles.statCard, {transform:[{scale}]}]}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
      >
        <Text style={styles.statTitle}>{stat.title}</Text>
        <Text style={styles.statValue}>{stat.value}</Text>
        <View style={styles.statFooter}>
          <Text style={[styles.statSubtitle, stat.trend==='up'&&{color:COLORS.accent}]}> {stat.subtitle} </Text>
          {stat.trend==='up' ? <Text style={[styles.arrow, {color:COLORS.accent}]}>▲</Text> : stat.trend==='down' ? <Text style={[styles.arrow, {color:COLORS.danger}]}>▼</Text> : <Text style={[styles.arrow, {color:COLORS.secondary}]}>•</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AnimatedAlertRow({alert}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {toValue:1,duration:600,useNativeDriver:true}).start();
  }, []);
  return (
    <Animated.View style={[styles.alertRow,{opacity}]}> 
      <Text style={styles.alertPair}>{alert.pair}</Text>
      <Text style={styles.alertType}>{alert.type}</Text>
      <Text style={[styles.alertDir,{color: alert.direction==='up'?COLORS.accent:COLORS.danger}]}>{alert.direction==='up'?'▲':'▼'}</Text>
      <Text style={styles.alertUsers}>{alert.usersReached}</Text>
      <Text style={styles.alertTime}>{alert.time}</Text>
    </Animated.View>
  );
}

const chartConfig = {
  backgroundGradientFrom: COLORS.card,
  backgroundGradientTo: COLORS.card,
  color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
  labelColor: () => COLORS.secondary,
  propsForDots: {
    r: '0',
  },
};

const styles = StyleSheet.create({
  container: {flex:1,backgroundColor:COLORS.background},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16},
  headerLeft:{flexDirection:'row',alignItems:'center'},
  headerLogo:{fontSize:20,color:COLORS.accent,marginRight:8},
  headerTitle:{fontSize:18,fontWeight:'bold',color:COLORS.text},
  headerRight:{flexDirection:'row',alignItems:'center'},
  liveDot:{width:10,height:10,borderRadius:5,backgroundColor:COLORS.accent,marginRight:6},
  liveText:{color:COLORS.accent,fontWeight:'600'},
  clock:{color:COLORS.secondary,textAlign:'center',marginBottom:16},

  statsScroll:{paddingLeft:16,marginBottom:24},
  statCard:{width:200,backgroundColor:COLORS.card,padding:16,borderRadius:12,marginRight:12,borderTopWidth:4,borderTopColor:COLORS.accent},
  statTitle:{fontSize:14,color:COLORS.secondary,marginBottom:8},
  statValue:{fontSize:24,fontWeight:'bold',color:COLORS.text},
  statFooter:{flexDirection:'row',alignItems:'center',marginTop:8},
  statSubtitle:{fontSize:12,color:COLORS.secondary},
  arrow:{fontSize:12,marginLeft:4},

  section:{paddingHorizontal:16,marginBottom:24},
  sectionTitle:{fontSize:18,fontWeight:'bold',color:COLORS.text,marginBottom:12},
  chart:{borderRadius:12},
  legendContainer:{flexDirection:'row',flexWrap:'wrap',marginTop:8},
  legendItem:{flexDirection:'row',alignItems:'center',marginRight:12,marginBottom:4},
  legendColor:{width:12,height:12,borderRadius:6,marginRight:4},
  legendText:{color:COLORS.text,fontSize:12},

  sectionHeaderRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  redDot:{width:8,height:8,borderRadius:4,backgroundColor:COLORS.danger,marginLeft:6},
  card:{backgroundColor:COLORS.card,padding:12,borderRadius:12},

  alertRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,borderBottomWidth:1,borderBottomColor:COLORS.background},
  alertPair:{color:COLORS.text,width:80},
  alertType:{color:COLORS.secondary,width:100},
  alertDir:{width:20,textAlign:'center'},
  alertUsers:{color:COLORS.text,width:60,textAlign:'center'},
  alertTime:{color:COLORS.secondary,width:60,textAlign:'right'},

  wsRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  greenDot:{width:10,height:10,borderRadius:5,backgroundColor:COLORS.accent},
  wsStatus:{fontWeight:'bold'},
  wsLabel:{color:COLORS.secondary},
  wsValue:{color:COLORS.text},

  controlLabel:{color:COLORS.text,fontSize:14,marginBottom:4},
  sliderRow:{marginVertical:8},
  toggleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginVertical:4},

  searchInput:{backgroundColor:COLORS.card,color:COLORS.text,padding:8,borderRadius:8,marginBottom:12},
  userRow:{flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:COLORS.background},
  avatar:{width:32,height:32,borderRadius:16,backgroundColor:COLORS.accent,justifyContent:'center',alignItems:'center'},
  avatarText:{color:COLORS.text,fontWeight:'bold'},
  userName:{color:COLORS.text},
  userEmail:{color:COLORS.secondary,fontSize:12},
  badge: (type) => ({
    backgroundColor: type==='Monthly'?COLORS.accent: type==='3 Months'?'#FFC107': type==='Annual'?'#2196F3': type==='Active'?COLORS.accent: type==='Trial'?COLORS.warning: COLORS.danger,
    paddingHorizontal:6,
    paddingVertical:2,
    borderRadius:4,
    marginHorizontal:4,
  }),
  badgeText:{color:COLORS.text,fontSize:10},
  chevron:{color:COLORS.secondary,fontSize:16,marginLeft:8},

  metricRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6},
  metricLabel:{color:COLORS.secondary},
  metricValue:{color:COLORS.text,fontWeight:'bold'},

  markRead:{color:COLORS.accent,fontSize:12},
  notifRow:{flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:COLORS.background},
  notifIcon:{width:10,height:10,borderRadius:5,marginRight:8},
  notifText:{color:COLORS.text,flex:1},
  notifTime:{color:COLORS.secondary,fontSize:12},
});
