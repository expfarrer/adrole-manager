/**
 * Team Statistics Calculator
 * Calculates team-wide access statistics and insights
 */

const { analyzeUserRoles } = require("./roleAnalyzer");

/**
 * Find roles that ALL users in the team have
 * @param {Array<Object>} users - Array of { sso, roles: [] }
 * @returns {Array<string>} Common roles
 */
function findCommonRoles(users) {
  if (!users || users.length === 0) {
    return [];
  }

  if (users.length === 1) {
    return users[0].roles;
  }

  // Start with first user's roles
  const firstUserRoles = new Set(users[0].roles);

  // Keep only roles that exist in ALL users
  const commonRoles = [...firstUserRoles].filter((role) => {
    return users.every((user) => user.roles.includes(role));
  });

  return commonRoles.sort();
}

/**
 * Calculate team-wide statistics
 * @param {Array<Object>} users - Array of { sso, roles: [] }
 * @returns {Object} Team statistics
 */
function calculateTeamStats(users) {
  if (!users || users.length === 0) {
    return {
      teamSize: 0,
      totalRoles: 0,
      avgRoles: 0,
      commonRoles: [],
      userAnalyses: [],
    };
  }

  // Analyze each user
  const userAnalyses = users.map((user) => analyzeUserRoles(user));

  // Calculate totals
  const totalRoles = userAnalyses.reduce((sum, u) => sum + u.totalRoles, 0);
  const totalAdminRoles = userAnalyses.reduce(
    (sum, u) => sum + u.adminRoles,
    0,
  );
  const totalWriteRoles = userAnalyses.reduce(
    (sum, u) => sum + u.writeRoles,
    0,
  );
  const totalReadRoles = userAnalyses.reduce((sum, u) => sum + u.readRoles, 0);

  // Calculate averages
  const avgRoles = totalRoles / users.length;
  const avgAdminRoles = totalAdminRoles / users.length;
  const avgWriteRoles = totalWriteRoles / users.length;
  const avgReadRoles = totalReadRoles / users.length;

  // Find common roles
  const commonRoles = findCommonRoles(users);

  // Find high-risk users (above average admin roles)
  const highRiskUsers = userAnalyses
    .filter((u) => u.adminRoles > avgAdminRoles)
    .sort((a, b) => b.adminRoles - a.adminRoles);

  // Find outliers (>150% of average total roles)
  const outliers = userAnalyses
    .filter((u) => u.totalRoles > avgRoles * 1.5)
    .sort((a, b) => b.totalRoles - a.totalRoles);

  return {
    teamSize: users.length,
    totalRoles,
    avgRoles: Math.round(avgRoles * 10) / 10,
    avgAdminRoles: Math.round(avgAdminRoles * 10) / 10,
    avgWriteRoles: Math.round(avgWriteRoles * 10) / 10,
    avgReadRoles: Math.round(avgReadRoles * 10) / 10,
    commonRoles,
    userAnalyses,
    highRiskUsers,
    outliers,
  };
}

/**
 * Generate insights and recommendations
 * @param {Object} teamStats - Output from calculateTeamStats
 * @returns {Array<string>} Array of recommendation strings
 */
function generateRecommendations(teamStats) {
  const recommendations = [];

  // Check for high-risk users
  if (teamStats.highRiskUsers.length > 0) {
    const topRiskUser = teamStats.highRiskUsers[0];
    recommendations.push(
      `Consider reviewing admin access for ${topRiskUser.sso} (${topRiskUser.adminRoles} admin roles)`,
    );
  }

  // Check for outliers
  if (teamStats.outliers.length > 0) {
    const topOutlier = teamStats.outliers[0];
    const percentAbove = Math.round(
      (topOutlier.totalRoles / teamStats.avgRoles - 1) * 100,
    );
    recommendations.push(
      `${topOutlier.sso} has ${topOutlier.totalRoles} roles (${percentAbove}% above average) - review for access creep`,
    );
  }

  // Check for low-access users
  const lowAccessUsers = teamStats.userAnalyses.filter(
    (u) => u.totalRoles < teamStats.avgRoles * 0.5,
  );
  if (lowAccessUsers.length > 0) {
    lowAccessUsers.forEach((user) => {
      recommendations.push(
        `${user.sso} has only ${user.totalRoles} roles (low) - verify they have sufficient access`,
      );
    });
  }

  // General health check
  if (teamStats.avgAdminRoles > 5) {
    recommendations.push(
      `Team average of ${teamStats.avgAdminRoles} admin roles per person is high - consider principle of least privilege`,
    );
  } else if (teamStats.avgAdminRoles < 1 && teamStats.teamSize > 3) {
    recommendations.push(
      `Team has low admin access (avg ${teamStats.avgAdminRoles}) - this is healthy from a security perspective`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Team access appears balanced and healthy");
  }

  return recommendations;
}

module.exports = {
  findCommonRoles,
  calculateTeamStats,
  generateRecommendations,
};
