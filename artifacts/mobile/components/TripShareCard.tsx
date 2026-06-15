import { Feather } from "@expo/vector-icons";
import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  formatTripShareTime,
  getFamilyName,
  getPeopleLabel,
  truncateTournamentName,
  TripShareDetails,
} from "@/utils/tripShare";

interface TripShareCardProps {
  details: TripShareDetails;
  shareUrl: string;
  showQr?: boolean;
}

export const TripShareCard = forwardRef<View, TripShareCardProps>(function TripShareCard(
  { details, shareUrl, showQr = true },
  ref,
) {
  const modeLabel = details.mode === "arrival" ? "Arrival" : "Departure";
  const familyName = getFamilyName(details.userName);

  return (
    <View ref={ref} collapsable={false} style={styles.captureWrap}>
      <View style={styles.card}>
        <View style={styles.banner}>
          <Text style={styles.bannerEyebrow}>Rovo Travel Info Card</Text>
          <Text style={styles.tournamentName} numberOfLines={1}>
            {truncateTournamentName(details.tournamentName)}
          </Text>
          <Text style={styles.tournamentDate} numberOfLines={1}>
            {details.tournamentDates ?? "Tournament dates"}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <View style={styles.sectionIcon}>
              <Feather name="map-pin" size={18} color="#0F766E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Airport</Text>
              <View style={styles.airportRow}>
                <Text style={styles.airportCode}>{details.airport}</Text>
                <View style={styles.timePill}>
                  <Text style={styles.timePillLabel}>{modeLabel}</Text>
                  <Text style={styles.timePillValue}>
                    {formatTripShareTime(details.datetime)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionIcon}>
              <Feather name="home" size={18} color="#0F766E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Hotel</Text>
              <Text style={styles.sectionValue} numberOfLines={2}>
                {details.hotel}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.sectionIcon}>
              <Feather name="users" size={18} color="#0F766E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionLabel}>Family</Text>
              <Text style={styles.sectionValue}>{familyName}</Text>
              <Text style={styles.peopleText}>
                {getPeopleLabel(details)}
                {details.baggageCount
                  ? ` - ${details.baggageCount} ${
                      details.baggageCount === 1 ? "bag" : "bags"
                    }`
                  : ""}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerActions}>
            <View style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Join this ride</Text>
            </View>
            <Text style={styles.secondaryLink}>See other matches</Text>
            <Text style={styles.shortLink} numberOfLines={1}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </Text>
          </View>
          {showQr ? (
            <View style={styles.qrBox}>
              <QRCode value={shareUrl} size={78} backgroundColor="#fff" color="#111827" />
            </View>
          ) : null}
        </View>

        {!details.active ? (
          <View style={styles.inactiveOverlay}>
            <Text style={styles.inactiveText}>This trip is no longer active</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  captureWrap: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#F8FAFC",
    padding: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    overflow: "hidden",
    boxShadow: "0px 6px 22px rgba(15,23,42,0.12)",
    elevation: 5,
  },
  banner: {
    backgroundColor: "#0F766E",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  bannerEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tournamentName: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginTop: 7,
  },
  tournamentDate: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  body: {
    padding: 18,
    gap: 12,
  },
  section: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  airportRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 3,
  },
  airportCode: {
    color: "#0F172A",
    fontSize: 42,
    lineHeight: 46,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.5,
  },
  timePill: {
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  timePillLabel: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  timePillValue: {
    color: "#0F172A",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 1,
  },
  sectionValue: {
    color: "#0F172A",
    fontSize: 18,
    lineHeight: 23,
    fontFamily: "Inter_700Bold",
    marginTop: 3,
  },
  peopleText: {
    color: "#475569",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginLeft: 50,
  },
  footer: {
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  footerActions: {
    flex: 1,
    gap: 7,
  },
  primaryButton: {
    backgroundColor: "#0F766E",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  secondaryLink: {
    color: "#0F766E",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  shortLink: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  qrBox: {
    backgroundColor: "#fff",
    padding: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  inactiveText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
});
