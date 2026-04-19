import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/utils/api";
import { extractCity } from "@/utils/location";

export interface HotelResult {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
}

interface HotelSearchProps {
  tournamentLocation: string;
  onSelect: (hotel: HotelResult) => void;
  selectedHotel: HotelResult | null;
}

interface HotelsResponse {
  results: HotelResult[];
  hasApiKey: boolean;
  upstreamError?: string;
}

export function HotelSearch({
  tournamentLocation,
  onSelect,
  selectedHotel,
}: HotelSearchProps) {
  const colors = useColors();
  const city = extractCity(tournamentLocation);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HotelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualName, setManualName] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ location: city });
        if (query.trim()) params.set("query", query.trim());
        const data = await apiFetch<HotelsResponse>(
          `/places/hotels?${params.toString()}`
        );
        if (cancelled) return;
        setResults(data.results);
        setHasApiKey(data.hasApiKey);
        setUpstreamError(data.upstreamError ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Search failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [city, query]);

  const handleSelect = (hotel: HotelResult) => {
    onSelect(hotel);
    setQuery("");
    setShowResults(false);
    setManualEntry(false);
  };

  if (selectedHotel && selectedHotel.name && !showResults && !manualEntry) {
    return (
      <Pressable
        onPress={() => {
          setShowResults(true);
          onSelect({ placeId: "", name: "", address: "" });
        }}
        style={[
          styles.selectedBox,
          {
            backgroundColor: colors.accentSurface,
            borderColor: colors.accentBorder,
            borderRadius: 12,
          },
        ]}
      >
        <Feather name="check-circle" size={18} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedName, { color: colors.foreground }]}>
            {selectedHotel.name}
          </Text>
          {selectedHotel.address ? (
            <Text
              style={[styles.selectedAddr, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {selectedHotel.address}
            </Text>
          ) : null}
        </View>
        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
      </Pressable>
    );
  }

  if (manualEntry) {
    return (
      <View style={{ gap: 10 }}>
        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.input, borderRadius: 12 },
          ]}
        >
          <Feather
            name="home"
            size={18}
            color={colors.mutedForeground}
            style={{ marginLeft: 14 }}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Hotel name..."
            placeholderTextColor={colors.mutedForeground}
            value={manualName}
            onChangeText={setManualName}
            autoFocus
          />
        </View>
        <Pressable
          onPress={() => {
            if (manualName.trim()) {
              onSelect({
                placeId: `manual-${Date.now()}`,
                name: manualName.trim(),
                address: "",
              });
            }
            setManualEntry(false);
          }}
          style={[
            styles.manualConfirm,
            { backgroundColor: colors.primary, borderRadius: 100 },
          ]}
        >
          <Text style={[styles.manualConfirmText, { color: "#fff" }]}>
            Use this hotel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setManualEntry(false)}
          style={{ alignItems: "center" }}
        >
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <View
        style={[
          styles.searchRow,
          { backgroundColor: colors.input, borderRadius: 12 },
        ]}
      >
        <Feather
          name="search"
          size={18}
          color={colors.mutedForeground}
          style={{ marginLeft: 14 }}
        />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder={`Search hotels in ${city}...`}
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setShowResults(true)}
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.foreground}
            style={{ marginRight: 14 }}
          />
        ) : null}
      </View>

      {!hasApiKey ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Live hotel search isn&apos;t configured yet.
        </Text>
      ) : upstreamError ? (
        <Text style={[styles.hint, { color: "#dc2626" }]}>
          Hotel search unavailable: {upstreamError}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.hint, { color: "#dc2626" }]}>{error}</Text>
      ) : null}

      {showResults && results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.placeId}
          scrollEnabled={results.length > 4}
          style={[
            styles.resultList,
            {
              backgroundColor: colors.muted,
              borderRadius: 12,
              maxHeight: Platform.OS === "web" ? 220 : 260,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                styles.resultItem,
                {
                  opacity: pressed ? 0.7 : 1,
                  borderBottomColor: colors.separator,
                },
                index === results.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={[styles.resultName, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.resultAddr,
                    { color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {item.address}
                </Text>
              </View>
              {item.rating ? (
                <View
                  style={[
                    styles.ratingPill,
                    { backgroundColor: colors.accentSurface },
                  ]}
                >
                  <Text style={[styles.ratingText, { color: colors.accent }]}>
                    {item.rating}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      ) : showResults && !loading && hasApiKey ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          No hotels found in {city}.
        </Text>
      ) : null}

      <Pressable onPress={() => setManualEntry(true)}>
        <Text style={[styles.manualLink, { color: colors.mutedForeground }]}>
          Can&apos;t find your hotel? Enter manually
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingRight: 14,
  },
  resultList: { overflow: "hidden" },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  resultAddr: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ratingPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  selectedName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  selectedAddr: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 4,
  },
  manualLink: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  manualConfirm: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  manualConfirmText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cancelText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
