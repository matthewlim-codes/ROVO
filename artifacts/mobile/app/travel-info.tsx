import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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

import { AirportResult, AirportSearch } from "@/components/AirportSearch";
import { Button } from "@/components/Button";
import { HotelResult, HotelSearch } from "@/components/HotelSearch";
import { Input } from "@/components/Input";
import { useAuth } from "@/context/AuthContext";
import { useTrip } from "@/context/TripContext";
import { useColors } from "@/hooks/useColors";
import { buildRideshareGroupId } from "@/utils/tripShare";
import { formatDateTime } from "@/utils/time";

function roundToNearestHalf(date: Date): Date {
  const ms = 30 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

function InlineDatePicker({
  value,
  onChange,
  maxDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  maxDate?: Date;
}) {
  const colors = useColors();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minLength = 14;
  const daysUntilMax =
    maxDate !== undefined
      ? Math.floor((maxDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)) + 1
      : 0;
  const count = Math.max(minLength, daysUntilMax);
  const days = Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
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
  const params = useLocalSearchParams<{
    joinShareId?: string;
    joinTargetTripId?: string;
    joinFamilyName?: string;
    joinHotel?: string;
    prefillMode?: "arrival" | "departure";
    prefillAirport?: string;
    prefillHotel?: string;
    prefillHotelPlaceId?: string;
    prefillDatetime?: string;
  }>();
  const { user } = useAuth();
  const { selectedTournament, saveTrip, refreshTrips } = useTrip();

  const [mode, setMode] = useState<"arrival" | "departure">("arrival");
  const [airport, setAirport] = useState<AirportResult | null>(null);
  const [hotel, setHotel] = useState<HotelResult | null>(null);
  const [datetime, setDatetime] = useState(roundToNearestHalf(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [baggage, setBaggage] = useState("");
  const [partySize, setPartySize] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.prefillMode === "arrival" || params.prefillMode === "departure") {
      setMode(params.prefillMode);
    }
    if (params.prefillAirport) {
      setAirport({
        placeId: `shared-${params.prefillAirport}`,
        name: params.prefillAirport,
        address: "Shared trip airport",
        iataCode: params.prefillAirport.length <= 4 ? params.prefillAirport : null,
      });
    }
    if (params.prefillHotel) {
      setHotel({
        placeId: params.prefillHotelPlaceId || `shared-${params.prefillHotel}`,
        name: params.prefillHotel,
        address: "",
      });
    }
    if (params.prefillDatetime) {
      const parsed = new Date(params.prefillDatetime);
      if (!Number.isNaN(parsed.getTime())) setDatetime(parsed);
    }
  }, [
    params.prefillAirport,
    params.prefillDatetime,
    params.prefillHotel,
    params.prefillHotelPlaceId,
    params.prefillMode,
  ]);

  if (!selectedTournament) {
    router.replace("/tournaments");
    return null;
  }

  const handleSubmit = async () => {
    setError("");
    if (!airport) {
      setError("Please select your airport.");
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
        airport: airport.iataCode ?? airport.name,
        hotel: hotel.name,
        hotelPlaceId: hotel.placeId,
        datetime: datetime.toISOString(),
        mode,
        baggageCount: baggage ? parseInt(baggage) : undefined,
        partySize: partySize ? parseInt(partySize) : undefined,
      });
      if (params.joinTargetTripId && trip.id.startsWith("srv-")) {
        await refreshTrips(selectedTournament.id);
        const groupId = buildRideshareGroupId(trip.id, params.joinTargetTripId);
        router.replace(`/chat/${encodeURIComponent(groupId)}`);
        return;
      }
      if (mode === "arrival") {
        router.push({
          pathname: "/rideshare-matches",
          params: {
            tripId: trip.id,
            tripJson: JSON.stringify(trip),
            showShareCard: "1",
          },
        });
      } else {
        router.push({
          pathname: "/matches",
          params: {
            tripId: trip.id,
            tripJson: JSON.stringify(trip),
            showShareCard: "1",
          },
        });
      }
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
            {params.joinFamilyName && params.joinHotel ? (
              <View
                style={[
                  styles.joinBanner,
                  {
                    backgroundColor: colors.accentSurface,
                    borderColor: colors.accentBorder,
                  },
                ]}
              >
                <Feather name="users" size={17} color={colors.accent} />
                <Text style={[styles.joinBannerText, { color: colors.foreground }]}>
                  You're joining {params.joinFamilyName}'s trip to {params.joinHotel}.
                  Enter your own travel details, then we'll open a message thread.
                </Text>
              </View>
            ) : null}
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
            <AirportSearch
              tournamentLocation={selectedTournament.location}
              onSelect={setAirport}
              selected={airport}
            />
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
                maxDate={(() => {
                  const d = new Date(selectedTournament.startDate + "T00:00:00");
                  d.setDate(d.getDate() + 7);
                  return d;
                })()}
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
              Party size (optional)
            </Text>
            <Input
              placeholder="How many people in your party?"
              value={partySize}
              onChangeText={setPartySize}
              keyboardType="number-pad"
              leftIcon={
                <Feather
                  name="users"
                  size={18}
                  color={colors.mutedForeground}
                />
              }
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
  joinBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  joinBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 19,
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
