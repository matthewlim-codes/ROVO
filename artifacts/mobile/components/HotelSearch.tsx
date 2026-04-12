import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
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

const MOCK_HOTELS: Record<string, HotelResult[]> = {
  default: [
    {
      placeId: "marriott-dallas-1",
      name: "Marriott Marquis Dallas",
      address: "2101 Commerce St, Dallas, TX 75201",
      rating: 4.3,
    },
    {
      placeId: "hyatt-dallas-1",
      name: "Hyatt Regency Dallas",
      address: "300 Reunion Blvd E, Dallas, TX 75207",
      rating: 4.2,
    },
    {
      placeId: "hilton-dallas-1",
      name: "Hilton Anatole",
      address: "2201 N Stemmons Fwy, Dallas, TX 75207",
      rating: 4.1,
    },
    {
      placeId: "omni-dallas-1",
      name: "Omni Dallas Hotel",
      address: "555 S Lamar St, Dallas, TX 75202",
      rating: 4.4,
    },
    {
      placeId: "westin-dallas-1",
      name: "The Westin Dallas Downtown",
      address: "1201 Main St, Dallas, TX 75202",
      rating: 4.0,
    },
  ],
  Anaheim: [
    {
      placeId: "disney-paradise-1",
      name: "Marriott Anaheim",
      address: "700 W Convention Way, Anaheim, CA 92802",
      rating: 4.2,
    },
    {
      placeId: "doubletree-anaheim-1",
      name: "Hilton Anaheim",
      address: "777 Convention Way, Anaheim, CA 92802",
      rating: 4.1,
    },
    {
      placeId: "hyatt-anaheim-1",
      name: "Hyatt Regency Orange County",
      address: "11999 Harbor Blvd, Garden Grove, CA 92840",
      rating: 4.3,
    },
  ],
  Chicago: [
    {
      placeId: "marriott-chicago-1",
      name: "Marriott Chicago Downtown",
      address: "540 N Michigan Ave, Chicago, IL 60611",
      rating: 4.3,
    },
    {
      placeId: "hilton-chicago-1",
      name: "Hilton Chicago",
      address: "720 S Michigan Ave, Chicago, IL 60605",
      rating: 4.0,
    },
    {
      placeId: "hyatt-chicago-1",
      name: "Hyatt Regency Chicago",
      address: "151 E Wacker Dr, Chicago, IL 60601",
      rating: 4.2,
    },
  ],
  Orlando: [
    {
      placeId: "marriott-orlando-1",
      name: "Marriott Orlando Downtown",
      address: "400 W Livingston St, Orlando, FL 32801",
      rating: 4.1,
    },
    {
      placeId: "hilton-orlando-1",
      name: "Hilton Orlando",
      address: "6001 Destination Pkwy, Orlando, FL 32819",
      rating: 4.2,
    },
    {
      placeId: "hyatt-orlando-1",
      name: "Hyatt Regency Orlando",
      address: "9801 International Dr, Orlando, FL 32819",
      rating: 4.3,
    },
    {
      placeId: "rosen-orlando-1",
      name: "Rosen Shingle Creek",
      address: "9939 Universal Blvd, Orlando, FL 32819",
      rating: 4.4,
    },
  ],
};

function getHotelsForLocation(location: string): HotelResult[] {
  for (const key of Object.keys(MOCK_HOTELS)) {
    if (key !== "default" && location.toLowerCase().includes(key.toLowerCase())) {
      return MOCK_HOTELS[key];
    }
  }
  return MOCK_HOTELS.default;
}

export function HotelSearch({
  tournamentLocation,
  onSelect,
  selectedHotel,
}: HotelSearchProps) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<HotelResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualName, setManualName] = useState("");

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.length < 1) {
      setShowResults(false);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const allHotels = getHotelsForLocation(tournamentLocation);
      const filtered = allHotels.filter(
        (h) =>
          h.name.toLowerCase().includes(text.toLowerCase()) ||
          h.address.toLowerCase().includes(text.toLowerCase())
      );
      setResults(filtered.length > 0 ? filtered : allHotels);
      setShowResults(true);
      setLoading(false);
    }, 400);
  };

  const handleFocus = () => {
    const hotels = getHotelsForLocation(tournamentLocation);
    setResults(hotels);
    setShowResults(true);
  };

  const handleSelect = (hotel: HotelResult) => {
    onSelect(hotel);
    setQuery(hotel.name);
    setShowResults(false);
    setManualEntry(false);
  };

  if (selectedHotel && !showResults && !manualEntry) {
    return (
      <Pressable
        onPress={() => {
          setQuery(selectedHotel.name);
          setShowResults(true);
          onSelect({ placeId: "", name: "", address: "" });
        }}
        style={[
          styles.selectedBox,
          {
            backgroundColor: colors.accent,
            borderColor: colors.orange,
            borderRadius: colors.radius - 4,
          },
        ]}
      >
        <Feather name="check-circle" size={18} color={colors.orange} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectedName, { color: colors.foreground }]}>
            {selectedHotel.name}
          </Text>
          <Text
            style={[styles.selectedAddress, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {selectedHotel.address}
          </Text>
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
            styles.inputRow,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: colors.radius - 4,
            },
          ]}
        >
          <Feather name="home" size={18} color={colors.mutedForeground} style={{ marginLeft: 14 }} />
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
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
            { backgroundColor: colors.secondary, borderRadius: colors.radius - 4 },
          ]}
        >
          <Text style={[styles.manualConfirmText, { color: colors.secondaryForeground }]}>
            Use this hotel
          </Text>
        </Pressable>
        <Pressable onPress={() => setManualEntry(false)}>
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
          styles.inputRow,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: colors.radius - 4,
          },
        ]}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} style={{ marginLeft: 14 }} />
        <TextInput
          style={[styles.textInput, { color: colors.foreground }]}
          placeholder="Search hotels near venue..."
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={handleSearch}
          onFocus={handleFocus}
          autoCorrect={false}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.orange}
            style={{ marginRight: 14 }}
          />
        )}
      </View>

      {showResults && (
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
          <FlatList
            data={results}
            keyExtractor={(item) => item.placeId}
            scrollEnabled={results.length > 4}
            style={{ maxHeight: Platform.OS === "web" ? 240 : 280 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelect(item)}
                style={({ pressed }) => [
                  styles.hotelRow,
                  { opacity: pressed ? 0.7 : 1, borderBottomColor: colors.border },
                ]}
              >
                <Feather name="home" size={16} color={colors.orange} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.hotelName, { color: colors.foreground }]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.hotelAddress, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {item.address}
                  </Text>
                  {item.rating && (
                    <Text style={[styles.hotelRating, { color: colors.orange }]}>
                      {item.rating} stars
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
          />
        </View>
      )}

      <Pressable onPress={() => setManualEntry(true)}>
        <Text style={[styles.manualLink, { color: colors.mutedForeground }]}>
          Can&apos;t find your hotel? Enter manually
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    height: 52,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingRight: 14,
  },
  dropdown: {
    borderWidth: 1.5,
    overflow: "hidden",
  },
  hotelRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
  },
  hotelName: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  hotelAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  hotelRating: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1.5,
  },
  selectedName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  selectedAddress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  manualLink: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  manualConfirm: {
    height: 44,
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
    textAlign: "center",
  },
});
