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

