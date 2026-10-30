// GPS for recording runs, from the iPhone app's native location plugin (SPEC
// decision 82). It keeps working with the screen locked; a browser can't, so
// on the website recording isn't offered.
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import type { TrackPoint } from "./run-track";

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

/** Whether this is the iPhone app, which can record runs. */
export const canRecordRuns = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BackgroundGeolocation");

export type GpsError = "denied" | "unavailable";

/** Starts GPS. Returns a function that stops it. */
export async function watchGps(onPoint: (p: TrackPoint) => void, onError: (e: GpsError) => void): Promise<() => Promise<void>> {
  const id = await BackgroundGeolocation.addWatcher(
    {
      // Setting this keeps updates coming with the screen locked.
      backgroundMessage: "Recording your run",
      backgroundTitle: "ede.",
      requestPermissions: true,
      stale: false,
      distanceFilter: 2,
    },
    (location, error) => {
      if (error) return onError(error.code === "NOT_AUTHORIZED" ? "denied" : "unavailable");
      if (!location) return;
      onPoint({ lat: location.latitude, lng: location.longitude, t: Math.round(location.time ?? Date.now()), acc: location.accuracy, alt: location.altitude });
    },
  );
  return () => BackgroundGeolocation.removeWatcher({ id });
}

/** Opens the app's page in Settings, to allow location after saying no. */
export const openLocationSettings = () => BackgroundGeolocation.openSettings();
