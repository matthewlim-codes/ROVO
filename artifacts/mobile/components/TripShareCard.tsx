import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { useColors } from "@/hooks/useColors";
import {
  formatTripShareDateTime,
  TripShareDetails,
} from "@/utils/tripShare";

interface TripShareCardProps {
  details: TripShareDetails;
  shareUrl: string;
  showQr?: boolean;
}

export function TripShareCard({
  details,
  shareUrl,
  showQr = true,
}: TripShareCardProps) {
  const colors = useColors();
  const modeLabel = details.mode === "arrival" ? "Arriving" : "Departing";
  const direction = details.mode === "arrival" ? "at" : "from";

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.brandRow, { borderBottomColor: colors.separator }]}>
        <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandTitle, { color: colors.foreground }]}>
            Rovo trip card
          </Text>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>
            Forward this to coordinate a tournament ride
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.name, { color: colors.foreground }]}>
          {details.userName}
        </Text>
        {details.userTeam ? (
          <Text style={[styles.team, { color: colors.mutedForeground }]}>
            {details.userTeam}
          </Text>
        ) : null}
        <Text style={[styles.tripLine, { color: colors.foreground }]}>
          {modeLabel} {direction}{" "}
          <Text style={{ fontFamily: "Inter_700Bold" }}>{details.airport}</Text>
        </Text>
      </View>

      <View style={styles.detailGrid}>
        <InfoRow icon="calendar" label="Tournament" value={details.tournamentName} />
        <InfoRow
          icon="clock"
          label="Time"
          value={formatTripShareDateTime(details.datetime)}
        />
        <InfoRow icon="home" label="Hotel" value={details.hotel} />
        {details.tournamentLocation ? (
          <InfoRow
            icon="map-pin"
            label="Location"
            value={details.tournamentLocation}
          />
        ) : null}
      </View>

      {(details.partySize || details.baggageCount) && (
        <View style={styles.badgeRow}>
          {details.partySize ? (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={13} color={colors.mutedForeground} />
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {details.partySize}{" "}
                {details.partySize === 1 ? "person" : "people"}
              </Text>
            </View>
          ) : null}
          {details.baggageCount ? (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Feather
                name="shopping-bag"
                size={13}
                color={colors.mutedForeground}
              />
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {details.baggageCount}{" "}
                {details.baggageCount === 1 ? "bag" : "bags"}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {showQr ? (
        <View style={[styles.qrSection, { borderTopColor: colors.separator }]}>
          <View style={styles.qrBox}>
            <QRCode value={shareUrl} size={144} backgroundColor="#fff" color="#111827" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.qrTitle, { color: colors.foreground }]}>
              Scan or tap the link
            </Text>
            <Text
              style={[styles.linkText, { color: colors.mutedForeground }]}
              numberOfLines={3}
            >
              {shareUrl}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: colors.accentSurface }]}>
        <Feather name={icon} size={15} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 6px 22px rgba(15,23,42,0.12)",
    elevation: 5,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  brandTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  brandSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  hero: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 4,
  },
  name: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.7,
  },
  team: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tripLine: {
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
  },
  detailGrid: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  qrSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderTopWidth: 1,
  },
  qrBox: {
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 16,
  },
  qrTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  linkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
