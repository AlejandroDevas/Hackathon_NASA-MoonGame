/** "3:05" for 185 s, "12:00" for 720 s, "1:02:03" past the hour. */
export function formatTripTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * What the visitor did on the way to the lander: metres driven and time spent. The first arrival is
 * frozen, so opening the sign again later keeps showing that first result.
 * @returns {{addDistance(m: number): void, tick(dt: number): void, arrive(): object, arrival(): object|null, reset(): void}}
 */
export function createTrip() {
  let distanceM = 0;
  let seconds = 0;
  let arrival = null;
  return {
    addDistance(metres) {
      if (arrival === null && metres > 0) distanceM += metres;
    },
    tick(dt) {
      if (arrival === null && dt > 0) seconds += dt;
    },
    /** Freeze the result the first time the rover reaches the lander; later calls return that same result. */
    arrive() {
      arrival ??= { distanceM, seconds };
      return arrival;
    },
    arrival: () => arrival,
    reset() {
      distanceM = 0;
      seconds = 0;
      arrival = null;
    },
  };
}
