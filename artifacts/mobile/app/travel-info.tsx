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

function InlineDatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const colors = useColors();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const selectedDay = new Date(value);
  selectedDay.setHours(0, 0, 0, 0);
  const currentHour = value.getHours();
  const currentMinute = Math.round(value.getMinutes() / 15) * 15;

  const setDay = (d: Date) => {
    const n = new Date(d);
    n.setHours(currentHour, currentMinute, 0, 0);
    onChange(n);
  };
  const setHour = (h: number) => {
    const n = new Date(value);
    n.setHours(h);
    onChange(n);
  };
  const setMinute = (m: number) => {
    const n = new Date(value);
    n.setMinutes(m);
    onChange(n);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8 }}>
        <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>
          Date
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {days.map((d) => {
              const isSelected =
                d.toDateString() === selectedDay.toDateString();
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => setDay(d)}
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.muted,
                      borderRadius: 12,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dateChipDay,
                      {
                        color: isSelected
                          ? "rgba(255,255,255,0.7)"
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text
                    style={[
                      styles.dateChipNum,
                      { color: isSelected ? "#fff" : colors.foreground },
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                  <Text
                    style={[
                      styles.dateChipMonth,
                      {
                        color: isSelected
                          ? "rgba(255,255,255,0.7)"
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {d.toLocaleDateString("en-US", { month: "short" })}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>
          Hour
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {hours.map((h) => {
              const isSelected = h === currentHour;
              const label =
                h === 0
                  ? "12am"
                  : h < 12
                    ? `${h}am`
                    : h === 12
                      ? "12pm"
                      : `${h - 12}pm`;
              return (
                <Pressable
                  key={h}
                  onPress={() => setHour(h)}
                  style={[
                    styles.hourChip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : colors.muted,
                      borderRadius: 10,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hourChipText,
                      { color: isSelected ? "#fff" : colors.foreground },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={[styles.pickerLabel, { color: colors.mutedForeground }]}>
          Minutes
        </Text>
        <View style={styles.chipRow}>
          {minutes.map((m) => {
            const isSelected = m === currentMinute;
            return (
              <Pressable
                key={m}
                onPress={() => setMinute(m)}
                style={[
                  styles.minChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : colors.muted,
                    borderRadius: 10,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.hourChipText,
                    { color: isSelected ? "#fff" : colors.foreground },
                  ]}
                >
                  :{m.toString().padStart(2, "0")}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
    ? AIRPORTS.filter((a) =>
        a.toLowerCase().includes(airport.toLowerCase())
      )
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
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Travel details
          </Text>
          <Text
            style={[styles.headerSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
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
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.section,
              { backgroundColor: colors.card, borderRadius: 18 },
            ]}
          >
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Travel mode
            </Text>
            <View style={styles.segmented}>
              {(["arrival", "departure"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor:
                        mode === m ? colors.primary : "transparent",
                      borderRadius: 10,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      {
                        color:
                          mode === m ? "#fff" : colors.mutedForeground,
                        fontFamily:
                          mode === m
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {m === "arrival" ? "Arriving" : "Departing"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: colors.card, borderRadius: 18 },
            ]}
          >
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Airport
            </Text>
            <Input
              placeholder="e.g. DFW, LAX, ORD"
              value={airport}
              onChangeText={(t) => {
                setAirport(t.toUpperCase());
                setShowAirports(true);
              }}
              onFocus={() => setShowAirports(true)}
              onBlur={() =>
                setTimeout(() => setShowAirports(false), 150)
              }
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon={
                <Feather
                  name="airplay"
                  size={18}
                  color={colors.mutedForeground}
                />
              }
            />
            {showAirports && filteredAirports.length > 0 && (
              <View
                style={[
                  styles.dropdown,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: 12,
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
                    style={[
                      styles.dropdownItem,
                      { borderBottomColor: colors.separator },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        { color: colors.foreground },
                      ]}
                    >
                      {a}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: colors.card, borderRadius: 18 },
            ]}
          >
            <Pressable
              onPress={() => setShowDatePicker(!showDatePicker)}
              style={styles.dateRow}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {mode === "arrival" ? "Arrival" : "Departure"} time
                </Text>
                <Text
                  style={[styles.dateValue, { color: colors.foreground }]}
                >
                  {formatDateTime(datetime.toISOString())}
                </Text>
              </View>
              <Feather
                name={showDatePicker ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.mutedForeground}
              />
            </Pressable>
            {showDatePicker && (
              <InlineDatePicker
                value={datetime}
                onChange={setDatetime}
              />
            )}
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: colors.card, borderRadius: 18 },
            ]}
          >
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Hotel
            </Text>
            <HotelSearch
              tournamentLocation={selectedTournament.location}
              onSelect={setHotel}
              selectedHotel={hotel}
            />
          </View>

          <View
            style={[
              styles.section,
              { backgroundColor: colors.card, borderRadius: 18 },
            ]}
          >
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Bags (optional)
            </Text>
            <Input
              placeholder="How many bags?"
              value={baggage}
              onChangeText={setBaggage}
              keyboardType="number-pad"
              leftIcon={
                <Feather
                  name="shopping-bag"
                  size={18}
                  color={colors.mutedForeground}
                />
              }
            />
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: "#FEF2F2", borderRadius: 14 },
              ]}
            >
              <Feather
                name="alert-circle"
                size={14}
                color={colors.destructive}
              />
              <Text
                style={[styles.errorText, { color: colors.destructive }]}
              >
                {error}
              </Text>
            </View>
          ) : null}

          <Button
            title="Find matching families"
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
    gap: 4,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  scroll: { padding: 16, gap: 12 },
  section: {
    padding: 20,
    gap: 14,
    boxShadow: "0px 1px 6px rgba(0,0,0,0.04)",
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 15,
  },
  dropdown: {
    overflow: "hidden",
    marginTop: 4,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
    letterSpacing: -0.2,
  },
  pickerLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: "row",
    gap: 6,
  },
  dateChip: {
    width: 58,
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
  },
  dateChipDay: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  dateChipNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  dateChipMonth: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  hourChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 54,
    alignItems: "center",
  },
  hourChipText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  minChip: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    alignItems: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
});
