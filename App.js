// App.js
import React, { useState, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";

/*
  Access Simulator - React Native
  - Single-file app
  - No backend required
  - Paste JSON or load sample JSON
*/

const ROOM_RULES = {
  "ServerRoom": { minLevel: 2, open: "09:00", close: "11:00", cooldown: 15 },
  "Vault": { minLevel: 3, open: "09:00", close: "10:00", cooldown: 30 },
  "R&D Lab": { minLevel: 1, open: "08:00", close: "12:00", cooldown: 10 },
};

const SAMPLE = [
  { id: "EMP001", access_level: 2, request_time: "09:15", room: "ServerRoom" },
  { id: "EMP002", access_level: 1, request_time: "09:30", room: "Vault" },
  { id: "EMP003", access_level: 3, request_time: "10:05", room: "ServerRoom" },
  { id: "EMP004", access_level: 3, request_time: "09:45", room: "Vault" },
  { id: "EMP005", access_level: 2, request_time: "08:50", room: "R&D Lab" },
  { id: "EMP006", access_level: 1, request_time: "10:10", room: "R&D Lab" },
  { id: "EMP007", access_level: 2, request_time: "10:18", room: "ServerRoom" },
  { id: "EMP008", access_level: 3, request_time: "09:55", room: "Vault" },
  { id: "EMP001", access_level: 2, request_time: "09:28", room: "ServerRoom" },
  { id: "EMP006", access_level: 1, request_time: "10:15", room: "R&D Lab" }
];

function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return NaN;
  const parts = hhmm.split(":").map(s => parseInt(s, 10));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return NaN;
  return parts[0] * 60 + parts[1];
}

function padMin(m) {
  const hh = Math.floor(m / 60).toString().padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function validateRequestObj(r) {
  // checks required fields
  return r && typeof r.id === "string" && typeof r.room === "string" &&
         (typeof r.access_level === "number" || /^\d+$/.test(String(r.access_level))) &&
         typeof r.request_time === "string";
}

export default function App() {
  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE, null, 2));
  const [results, setResults] = useState([]);
  const [lastRunInfo, setLastRunInfo] = useState(null);

  const loadSample = () => {
    setJsonText(JSON.stringify(SAMPLE, null, 2));
  };

  const parseInput = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        Alert.alert("Input error", "Top-level JSON must be an array of requests.");
        return null;
      }
      // normalize types
      for (let i = 0; i < parsed.length; i++) {
        const r = parsed[i];
        if (!validateRequestObj(r)) {
          Alert.alert("Input error", `Request at index ${i} is missing required fields or has wrong types.`);
          return null;
        }
  
        parsed[i].access_level = Number(parsed[i].access_level);
      }
      return parsed;
    } catch (e) {
      Alert.alert("JSON parse error", e.message);
      return null;
    }
  };

  function simulate(requests) {
    const copy = requests.map((r, i) => ({ ...r, __idx: i }));

    for (const r of copy) {
      const t = timeToMinutes(r.request_time);
      if (isNaN(t)) throw new Error(`Invalid time format for request_time: ${r.request_time}`);
      r.__t = t;
    }
    // sort by time then index
    copy.sort((a, b) => a.__t - b.__t || a.__idx - b.__idx);

    const accessLog = {}; // key: `${id}|${room}` => last granted minute (number)
    const out = [];

    for (const r of copy) {
      const id = r.id;
      const room = r.room;
      const level = r.access_level;
      const t = r.__t;

      if (!ROOM_RULES[room]) {
        out.push({ request: r, decision: "DENIED", reason: `Unknown room: ${room}` });
        continue;
      }

      const meta = ROOM_RULES[room];

      // 1. access level
      if (level < meta.minLevel) {
        out.push({ request: r, decision: "DENIED", reason: `Denied: Below required level (has ${level}, needs ${meta.minLevel})` });
        continue;
      }

      // 2. time window (open inclusive, close exclusive)
      const openMin = timeToMinutes(meta.open);
      const closeMin = timeToMinutes(meta.close);
      if (!(openMin <= t && t < closeMin)) {
        out.push({ request: r, decision: "DENIED", reason: `Denied: Room closed at ${r.request_time} (open ${meta.open} - ${meta.close})` });
        continue;
      }

      // 3. cooldown (per employee per room)
      const key = `${id}|${room}`;
      const last = accessLog[key];
      if (last !== undefined && (t - last) < meta.cooldown) {
        const waitUntil = last + meta.cooldown;
        out.push({
          request: r,
          decision: "DENIED",
          reason: `Denied: Cooldown — last access at ${padMin(last)}, must wait until ${padMin(waitUntil)} (cooldown ${meta.cooldown} min)`
        });
        continue;
      }

      // granted
      accessLog[key] = t;
      out.push({ request: r, decision: "GRANTED", reason: `Granted: Access to ${room}` });
    }

    return out;
  }

  const onSimulate = () => {
    const data = parseInput();
    if (!data) return;
    try {
      const out = simulate(data);
      setResults(out);
      setLastRunInfo({ count: out.length, time: new Date().toLocaleString() });
    } catch (err) {
      Alert.alert("Simulation Error", err.message);
    }
  };

  const renderResultItem = ({ item, index }) => {
    const r = item.request;
    const decisionStyle = item.decision === "GRANTED" ? styles.granted : styles.denied;
    return (
      <View style={[styles.resultRow, decisionStyle]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={styles.reqTitle}>{index + 1}. {r.id} → {r.room} @ {r.request_time}</Text>
          <Text style={[styles.badge, item.decision === "GRANTED" ? styles.badgeOk : styles.badgeNo]}>
            {item.decision}
          </Text>
        </View>
        <Text style={styles.reason}>{item.reason}</Text>
      </View>
    );
  };

  const summary = useMemo(() => {
    const s = { granted: 0, denied: 0 };
    for (const it of results) {
      if (it.decision === "GRANTED") s.granted++;
      else s.denied++;
    }
    return s;
  }, [results]);



  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Access Simulator — HR / Security</Text>
        <Text style={styles.sub}>Paste JSON (array of requests) or tap <Text style={{fontWeight:"700"}}>Load sample</Text>.</Text>

        <TextInput
          style={styles.input}
          multiline
          placeholder="Paste JSON array of requests here..."
          value={jsonText}
          onChangeText={setJsonText}
          textAlignVertical="top"
          autoCorrect={false}
        />

        <View style={styles.controls}>
          <TouchableOpacity style={styles.btn} onPress={loadSample}>
            <Text style={styles.btnText}>Load sample</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.primary]} onPress={onSimulate}>
            <Text style={[styles.btnText, { color: "#fff" }]}>Simulate Access</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.small}>Room rules (editable in code):</Text>
        </View>
        <View style={styles.roomBox}>
          {Object.entries(ROOM_RULES).map(([name, meta]) => (
            <View key={name} style={styles.roomRow}>
              <Text style={{fontWeight:"600"}}>{name}</Text>
              <Text>Level: {meta.minLevel}</Text>
              <Text>{meta.open} - {meta.close}</Text>
              <Text>Cooldown: {meta.cooldown} min</Text>
            </View>
          ))}
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Results</Text>
          <Text style={styles.small}>{lastRunInfo ? `${lastRunInfo.count} requests — run at ${lastRunInfo.time}` : "No simulation yet."}</Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryText}>Granted: {summary.granted}</Text>
          <Text style={styles.summaryText}>Denied: {summary.denied}</Text>
        </View>

        {results.length === 0 ? (
          <Text style={styles.small}>No results to show — run simulation.</Text>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderResultItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}




const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7fafc" },
  container: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 20, fontWeight: "700", marginBottom: 6 },
  sub: { color: "#475569", marginBottom: 12 },
  input: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    fontFamily: "monospace",
    marginBottom: 12,
  },
  controls: { flexDirection: "row", gap: 8, marginBottom: 12 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    marginRight: 8,
  },
  primary: { backgroundColor: "#0ea5a4", borderColor: "#0ea5a4" },
  btnText: { color: "#0f172a", fontWeight: "600" },
  infoRow: { marginBottom: 6 },
  small: { color: "#475569", fontSize: 13 },
  roomBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  roomRow: { marginBottom: 8 },
  resultsHeader: { marginTop: 6, marginBottom: 6 },
  resultsTitle: { fontSize: 16, fontWeight: "700" },
  summary: { flexDirection: "row", gap: 12, marginBottom: 8 },
  summaryText: { fontWeight: "700" },
  resultRow: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e6eef0",
    backgroundColor: "#fff"
  },
  granted: { borderColor: "#d1fae5", backgroundColor: "#f0fdf4" },
  denied: { borderColor: "#fee2e2", backgroundColor: "#fff7f7" },
  reqTitle: { fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, fontWeight: "700" },
  badgeOk: { backgroundColor: "#ecfdf5", color: "#065f46" },
  badgeNo: { backgroundColor: "#fff1f2", color: "#991b1b" },
  reason: { marginTop: 6, color: "#334155" }
});   