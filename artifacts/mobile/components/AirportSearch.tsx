import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/utils/api";
import {
  customAirportFromCode,
  searchLocalAirports,
} from "@/utils/airports";
import { extractCity } from "@/utils/location";

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
  upstreamError?: string;
  usedFallback?: boolean;
  allowCustomCode?: boolean;
}

function friendlyAirportHint(upstreamError?: string | null): string | null {
  if (!upstreamError) return null;
  return "Live airport search is temporarily unavailable. Showing common US airports — or enter a 3-letter code.";
}

export function AirportSearch({
  tournamentLocation,
  onSelect,
  selected,
}: AirportSearchProps) {
  const colors = useColors();
  const city = extractCity(tournamentLocation);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<AirportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [upstreamError, setUpstreamError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const localResults = useMemo(
    () => searchLocalAirports(query, city),
    [query, city],
  );

  const results = useMemo(() => {
    if (remoteResults.length > 0) return remoteResults;
    return localResults;
  }, [remoteResults, localResults]);

  useEffect(() => {
    let cancelled = false;
    // Prefer local search for short queries / known codes to avoid Google billing hits.
    const q = query.trim();
    const localStrong =
      !q ||
      /^[A-Za-z]{3,4}$/.test(q) ||
      localResults.length >= 1;

    if (localStrong && (!hasApiKey || usedFallback || !q)) {
      setRemoteResults([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ location: city });
        if (q) params.set("query", q);
        const data = await apiFetch<AirportsResponse>(
          `/places/airports?${params.toString()}`,
        );
        if (cancelled) return;
        setHasApiKey(data.hasApiKey);
        setUpstreamError(data.upstreamError ?? null);
        setUsedFallback(!!data.usedFallback || !data.hasApiKey);
        setRemoteResults(data.results);
      } catch {
        if (!cancelled) {
          setUsedFallback(true);
          setRemoteResults([]);
          setError(null);
          setUpstreamError("unavailable");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, q ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [city, query, hasApiKey, usedFallback, localResults.length]);

  const handleSelect = (a: AirportResult) => {
    onSelect(a);
    setQuery("");
    setShowResults(false);
  };

  const handleCustomCode = () => {
    const custom = customAirportFromCode(query);
    if (custom) {
      handleSelect(custom);
    }
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

  const hint = friendlyAirportHint(upstreamError);
  const showCustom =
    /^[A-Za-z]{3,4}$/.test(query.trim()) &&
    !results.some(
      (r) =>
        r.iataCode?.toUpperCase() === query.trim().toUpperCase(),
    );

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
          placeholder={`Search airports (code, city, or name)`}
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setShowResults(true)}
          autoCorrect={false}
          autoCapitalize="characters"
        />
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.foreground}
            style={{ marginRight: 14 }}
          />
        ) : null}
      </View>

      {hint ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {hint}
        </Text>
      ) : !hasApiKey || usedFallback ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Showing common US airports. Type a 3-letter code for any other airport.
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.hint, { color: colors.destructive }]}>
          {error}
        </Text>
      ) : null}

      {showResults && results.length > 0 ? (
        <ScrollView
          style={[
            styles.resultList,
            {
              backgroundColor: colors.muted,
              borderRadius: 12,
              maxHeight: Platform.OS === "web" ? 240 : 280,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {results.map((item, index) => (
            <Pressable
              key={`${item.placeId}-${item.iataCode ?? index}`}
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
          ))}
        </ScrollView>
      ) : showResults && !loading && query.trim() && !showCustom ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          No airports matched. Try a city name or a 3-letter code (for example, DFW).
        </Text>
      ) : null}

      {showResults && showCustom ? (
        <Pressable
          onPress={handleCustomCode}
          style={[
            styles.customCodeBtn,
            { backgroundColor: colors.primary, borderRadius: 12 },
          ]}
        >
          <Text style={styles.customCodeText}>
            Use airport code {query.trim().toUpperCase()}
          </Text>
        </Pressable>
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
  customCodeBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  customCodeText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
