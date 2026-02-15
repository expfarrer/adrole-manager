/**
 * Feature Loader
 * Dynamically loads enabled features from config
 */

const fs = require("fs");
const path = require("path");

let featuresConfig = null;

/**
 * Load features configuration
 * @returns {Object} Features config
 */
function loadFeaturesConfig() {
  if (featuresConfig) {
    return featuresConfig;
  }

  try {
    const configPath = path.join(__dirname, "../config/features.json");
    const configData = fs.readFileSync(configPath, "utf8");
    featuresConfig = JSON.parse(configData);
    return featuresConfig;
  } catch (error) {
    console.error("Warning: Could not load features config, using defaults");
    return {
      features: {
        "team-summary": { enabled: true },
      },
    };
  }
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Name of the feature
 * @returns {boolean} True if enabled
 */
function isFeatureEnabled(featureName) {
  const config = loadFeaturesConfig();
  const feature = config.features[featureName];
  return feature && feature.enabled === true;
}

/**
 * Load a feature module if enabled
 * @param {string} featureName - Name of the feature
 * @returns {Object|null} Feature module or null if disabled
 */
function loadFeature(featureName) {
  if (!isFeatureEnabled(featureName)) {
    console.error(`Feature '${featureName}' is not enabled`);
    console.error(`Enable it in config/features.json`);
    return null;
  }

  try {
    const featurePath = path.join(__dirname, "features", featureName);
    return require(featurePath);
  } catch (error) {
    console.error(`Error loading feature '${featureName}':`, error.message);
    return null;
  }
}

/**
 * List all available features
 * @returns {Array} Array of feature info
 */
function listFeatures() {
  const config = loadFeaturesConfig();
  return Object.keys(config.features).map((name) => ({
    name,
    ...config.features[name],
  }));
}

module.exports = {
  isFeatureEnabled,
  loadFeature,
  listFeatures,
  loadFeaturesConfig,
};
