import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { HotelResult, HotelSearch } from "@/components/HotelSearch";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { formatDateTime } from "@/utils/time";

const AIRPORTS = [
  "DFW", "DAL", "LAX", "SNA", "ORD", "MDW", "MCO", "TPA",
  "ATL", "DEN", "LAS", "PHX", "SEA", "SFO", "JFK", "EWR", "MIA",
];

function roundToNearestHalf(date: Date): Date {
  const ms = 30 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function DateTimePicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const colors = useColors();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];
  const days: Date[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const selectedDay = new Date(value);
  selectedDay.setHours(0, 0, 0, 0);

  const currentHour = value.getHours();
  const currentMinute = Math.round(value.getMinutes() / 15) * 15;

  const setDay = (d: Date) => {
    const newDate = new Date(d);
    newDate.setHours(currentHour, currentMinute, 0, 0);
    onChange(newDate);
  };

  const setHour = (h: number) => {
    const newDate = new Date(value);
    newDate.setHours(h);
    onChange(newDate);
  };

  const setMinute = (m: number) => {
    const newDate = new Date(value);
    newDate.setMinutes(m);
    onChange(newDate);
  };

  return (
    <View style={styles.dtPicker}>
      <Text style={[styles.dtLabel, { color: colors.mutedForeground }]}>Date</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.dtRow}>
          {days.map((d) => {
            const isSelected = d.toDateString() === selectedDay.toDateString();
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setDay(d)}
                style={[
                  styles.dtChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.muted,
                    borderRadius: colors.radius - 4,
                  },
                ]}
              >
                <Text style={[styles.dtChipDayName, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </Text>
                <Text style={[styles.dtChipDate, { color: isSelected ? "#fff" : colors.foreground }]}>
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Text style={[styles.dtLabel, { color: colors.mutedForeground }]}>Hour</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <View style={styles.dtRow}>
          {hours.map((h) => {
            const isSelected = h === currentHour;
            const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
            return (
              <Pressable
                key={h}
                onPress={() => setHour(h)}
                style={[
                  styles.dtHourChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.muted,
                    borderRadius: 8,
                  },
                ]}
              >
                <Text style={[styles.dtHourText, { color: isSelected ? "#fff" : colors.foreground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Text style={[styles.dtLabel, { color: colors.mutedForeground }]}>Minutes</Text>
      <View style={styles.dtRow}>
        {minutes.map((m) => {
          const isSelected = m === currentMinute;
          return (
            <Pressable
              key={m}
              onPress={() => setMinute(m)}
              style={[
                styles.dtMinChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.muted,
                  borderRadius: 8,
                },
              ]}
            >
              <Text style={[styles.dtHourText, { color: isSelected ? "#fff" : colors.foreground }]}>
                :{m.toString().padStart(2, "0")}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TravelInfoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedTournament, saveTrip } = useTrip();

  const [mode, setMode] = useState<"arrival" | "departure">("arrival");
  const [airport, setAirport] = useState("");
  const [showAirports, setShowAirports] = useState(false);
  const [hotel, setHotel] = useState<HotelResult | null>(null);
  const [datetime, setDatetime] = useState(roundToNearestHalf(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [baggage, setBaggage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!selectedTournament) {
    router.replace("/tournaments");
    return null;
  }

  const filteredAirports = airport
    ? AIRPORTS.filter((a) => a.toLowerCase().includes(airport.toLowerCase()))
    : AIRPORTS;

  const handleSubmit = async () => {
    setError("");
    if (!airport.trim()) {
      setError("Please enter your airport.");
      return;
    }
    if (!hotel) {
      setError("Please select your hotel.");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const trip = await saveTrip({
        userId: user.id,
        userName: user.name,
        userTeam: user.team,
        tournamentId: selectedTournament.id,
        airport: airport.toUpperCase(),
        hotel: hotel.name,
        hotelPlaceId: hotel.placeId,
        datetime: datetime.toISOString(),
        mode,
        baggageCount: baggage ? parseInt(baggage) : undefined,
      });
      router.push({ pathname: "/matches", params: { tripId: trip.id } });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.navy,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Travel Info</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {selectedTournament.name}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              TRAVEL MODE
            </Text>
            <View style={styles.modeToggle}>
              {(["arrival", "departure"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: mode === m ? colors.primary : colors.muted,
                      borderRadius: colors.radius - 4,
                    },
                  ]}
                >
                  <Feather
                    name={m === "arrival" ? "arrow-down-circle" : "arrow-up-circle"}
                    size={18}
                    color={mode === m ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.modeBtnText,
                      {
                        color: mode === m ? colors.primaryForeground : colors.mutedForeground,
                      },
                    ]}
                  >
                    {m === "arrival" ? "Arriving" : "Departing"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              AIRPORT
            </Text>
            <Input
              placeholder="e.g. DFW, LAX, ORD"
              value={airport}
              onChangeText={(t) => {
                setAirport(t.toUpperCase());
                setShowAirports(true);
              }}
              onFocus={() => setShowAirports(true)}
              onBlur={() => setTimeout(() => setShowAirports(false), 150)}
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon={<Feather name="airplay" size={18} color={colors.mutedForeground} />}
            />
            {showAirports && filteredAirports.length > 0 && (
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius - 4,
                  },
                ]}
              >
                {filteredAirports.slice(0, 6).map((a) => (
                  <Pressable
                    key={a}
                    onPress={() => {
                      setAirport(a);
                      setShowAirports(false);
                    }}
                    style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                  >
                    <Feather name="airplay" size={14} color={colors.orange} />
                    <Text style={[styles.dropdownText, { color: colors.foreground }]}>
                      {a}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {mode === "arrival" ? "ARRIVAL" : "DEPARTURE"} DATE & TIME
            </Text>
            <Pressable
              onPress={() => setShowDatePicker(!showDatePicker)}
              style={[
                styles.dateBtn,
                {
                  backgroundColor: colors.muted,
                  borderRadius: colors.radius - 4,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="clock" size={18} color={colors.orange} />
              <Text style={[styles.dateBtnText, { color: colors.foreground }]}>
                {formatDateTime(datetime.toISOString())}
              </Text>
              <Feather
                name={showDatePicker ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
            {showDatePicker && (
              <DateTimePicker value={datetime} onChange={setDatetime} />
            )}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              HOTEL
            </Text>
            <HotelSearch
              tournamentLocation={selectedTournament.location}
              onSelect={setHotel}
              selectedHotel={hotel}
            />
          </View>

          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              BAGS (optional)
            </Text>
            <Input
              placeholder="Number of bags"
              value={baggage}
              onChangeText={setBaggage}
              keyboardType="number-pad"
              leftIcon={<Feather name="shopping-bag" size={18} color={colors.mutedForeground} />}
            />
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: "#fef2f2",
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            title="Find Matching Families"
            onPress={handleSubmit}
            loading={loading}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  scroll: { padding: 16, gap: 12 },
  section: {
    padding: 20,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  modeBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dropdown: {
    borderWidth: 1.5,
    marginTop: 4,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1.5,
  },
  dateBtnText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  dtPicker: {
    paddingTop: 8,
    gap: 4,
  },
  dtLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dtRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
  },
  dtChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 64,
  },
  dtChipDayName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  dtChipDate: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dtHourChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 52,
    alignItems: "center",
  },
  dtHourText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  dtMinChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
});
