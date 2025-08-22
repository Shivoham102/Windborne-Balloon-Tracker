/**
 * Application Configuration
 * 
 * QUICK START:
 * - To test with large mock hurricanes: Keep USE_REAL_DATA: false
 * - To use real hurricane data: Change USE_REAL_DATA: true
 * - To switch balloon data: Change BALLOON_DATA.USE_REAL_DATA
 */
export const APP_CONFIG = {
  // Hurricane Data Configuration
  HURRICANE_DATA: {
    // Set to true to fetch real hurricane data from NHC API
    // Set to false to use large mock hurricanes for testing
    USE_REAL_DATA: true,
    
    // Mock hurricane options
    MOCK_OPTIONS: {
      LARGE_TEST_HURRICANES: true,  // Use big hurricanes for intersection testing
      INCLUDE_PACIFIC: true,        // Include Pacific hurricanes
      INCLUDE_CONTINENTAL: true,    // Include continental US coverage
    }
  },
  
  // Balloon Data Configuration  
  BALLOON_DATA: {
    // Set to true to fetch real balloon data from WindBorne API
    // Set to false to use mock balloon data
    USE_REAL_DATA: true,
  },
  
  // Debug Configuration
  DEBUG: {
    VERBOSE_LOGGING: true,        // Enable detailed console logging
    SHOW_DATA_SOURCES: true,      // Show whether using real or mock data
  }
} as const;

// Helper functions for easy configuration checks
export const useRealHurricanes = () => APP_CONFIG.HURRICANE_DATA.USE_REAL_DATA;
export const useRealBalloons = () => APP_CONFIG.BALLOON_DATA.USE_REAL_DATA;
export const isDebugMode = () => APP_CONFIG.DEBUG.VERBOSE_LOGGING;
