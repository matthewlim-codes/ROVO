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

export interface AirportResult {
  placeId: string;
  name: string;
  address: string;
  iataCode: string | null;
  rating?: number;
}

interface AirportSearchProps {
  tournamentLocation: string;
  onSelect: (airport: AirportResult) => void;
  selected: AirportResult | null;
}

interface AirportsResponse {
  results: AirportResult[];
  hasApiKey: boolean;
}

export function AirportSearch({
  tournamentLocation,
  onSelect,
  selected,
}: AirportSearchProps) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AirportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          location: tournamentLocation,
        });
        if (query.trim()) params.set("query", query.trim());
        const data = await apiFetch<AirportsResponse>(
          `/places/airports?${params.toString()}`
        );
        if (cancelled) return;
        setResults(data.results);
        setHasApiKey(data.hasApiKey);
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
  }, [tournamentLocation, query]);

  const handleSelect = (a: AirportResult) => {
    onSelect(a);
    setQuery("");
    setShowResults(false);
  };

  if (selected && !showResults) {
    return (
      <Pressable
        onPress={() => setShowResults(true)}
        style={[
          styles.selectedBox,
          {
            backgroundColor: colors.accentSurface,
            borderColor: colors.accentBorder,
            borderRadius: 12,
          },
        ]}
      >
        <View style={[styles.codeBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.codeBadgeText}>
            {selected.iataCode ?? "?"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedName, { color: colors.foreground }]}>
            {selected.name}
          </Text>
          <Text
            style={[styles.selectedAddr, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {selected.address}
          </Text>
        </View>
        <Feather name="edit-2" size={14} color={colors.mutedForeground} />
      </Pressable>
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
          placeholder="Search airports near venue..."
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
          Live airport search isn&apos;t configured yet.
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.hint, { color: colors.destructive }]}>
          {error}
        </Text>
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
              maxHeight: Platform.OS === "web" ? 240 : 280,
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
              <View
                style={[
                  styles.codeBadge,
                  { backgroundColor: colors.foreground },
                ]}
              >
                <Text style={styles.codeBadgeText}>
                  {item.iataCode ?? "—"}
                </Text>
              </View>
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
            </Pressable>
          )}
        />
      ) : showResults && !loading ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          No airports found near this venue.
        </Text>
      ) : null}
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  resultAddr: { fontSize: 12, fontFamily: "Inter_400Regular" },
  codeBadge: {
    minWidth: 46,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  codeBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
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
});
