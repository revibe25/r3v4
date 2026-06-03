/**
 * services/ai-mix/src/genreInference.ts
 *
 * BPM-based genre inference for AIMixingService.
 *
 * This is a transitional component. Once sessionMetrics gains a `genre`
 * column, callers should prefer `session.genre ?? inferGenreFromBpm(bpm)`.
 * The function is data-driven (profile table at the top of the file) so
 * adjustments don't require code review of the inference logic itself.
 *
 * Genre keys match AIMixingService's `genreHeadroom` table:
 *   electronic | hiphop | jazz | classical | rock
 *
 * Profile boundaries informed by:
 *   - Beatport BPM ranges per subgenre (techno 125-135, house 118-130)
 *   - DJ TechTools tempo charts
 *   - Common DAW tempo conventions
 */
/**
 * Profile table — order matters: first matching range wins.
 * Designed so the most common DAW tempos (120-140) resolve to "electronic"
 * which is the safest default for R3's primary user (techno/house DJs).
 */
const GENRE_PROFILES = [
    { minBpm: 0, maxBpm: 69, genre: "classical", description: "Slow / orchestral / ambient" },
    { minBpm: 70, maxBpm: 99, genre: "hiphop", description: "Hip-hop / trap / R&B" },
    { minBpm: 100, maxBpm: 114, genre: "rock", description: "Rock / pop / mid-tempo" },
    { minBpm: 115, maxBpm: 145, genre: "electronic", description: "House / techno / DnB low end" },
    { minBpm: 146, maxBpm: 175, genre: "electronic", description: "DnB / hardcore / fast techno" },
    { minBpm: 176, maxBpm: 999, genre: "electronic", description: "Speedcore / gabber" },
];
/** Default genre when BPM is invalid or unmatched (shouldn't happen with the table above) */
const FALLBACK_GENRE = "electronic";
/**
 * Infer genre from BPM using the static profile table.
 *
 * @param bpm  Beats per minute. Clamped to >= 0; non-finite values fall back.
 * @returns    A Genre string matching AIMixingService's headroom table.
 *
 * @example
 *   inferGenreFromBpm(128)  // "electronic"  (techno)
 *   inferGenreFromBpm(85)   // "hiphop"
 *   inferGenreFromBpm(60)   // "classical"
 *   inferGenreFromBpm(NaN)  // "electronic"  (fallback)
 */
export function inferGenreFromBpm(bpm) {
    if (!Number.isFinite(bpm) || bpm < 0)
        return FALLBACK_GENRE;
    for (const profile of GENRE_PROFILES) {
        if (bpm >= profile.minBpm && bpm <= profile.maxBpm) {
            return profile.genre;
        }
    }
    return FALLBACK_GENRE;
}
/** Exposed for testing — readonly view of the profile table */
export const GENRE_PROFILE_TABLE = GENRE_PROFILES;
