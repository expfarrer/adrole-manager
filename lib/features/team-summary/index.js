/**
 * Team Summary Feature
 * Analyzes team access and generates management reports
 */

const {
  analyzeUserRoles,
  categorizeRoles,
  getRiskEmoji,
} = require("./roleAnalyzer");
const {
  calculateTeamStats,
  findCommonRoles,
  generateRecommendations,
} = require("./teamStats");

/**
 * Main team summary function
 * @param {Array<Object>} users - Array of { sso, roles: [] }
 * @returns {Object} Complete team analysis
 */
function analyzeTeam(users) {
  const teamStats = calculateTeamStats(users);
  const recommendations = generateRecommendations(teamStats);

  return {
    ...teamStats,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  analyzeTeam,
  analyzeUserRoles,
  categorizeRoles,
  getRiskEmoji,
  calculateTeamStats,
  findCommonRoles,
  generateRecommendations,
};
