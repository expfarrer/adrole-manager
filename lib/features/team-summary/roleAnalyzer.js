/**
 * Role Analysis and Categorization
 * Analyzes AD role names to determine risk level and permissions
 */

/**
 * Categorize a role based on naming patterns
 * @param {string} roleName - AD role name (e.g., "AP-AWS-Admin")
 * @returns {Object} { name, category, riskLevel }
 */
function categorizeRole(roleName) {
  if (!roleName || typeof roleName !== "string") {
    return {
      name: roleName,
      category: "unknown",
      riskLevel: "low",
    };
  }

  const name = roleName.trim();
  const nameLower = name.toLowerCase();

  // Admin roles (highest risk)
  if (nameLower.includes("-admin")) {
    return {
      name,
      category: "admin",
      riskLevel: "high",
    };
  }

  // Write/Modify roles (medium-high risk)
  const writePatterns = [
    "-write",
    "-deploy",
    "-execute",
    "-approve",
    "-processor",
    "-run",
    "-contributor",
    "-manage",
  ];

  if (writePatterns.some((pattern) => nameLower.includes(pattern))) {
    return {
      name,
      category: "write",
      riskLevel: "medium",
    };
  }

  // Read-only roles (low risk)
  const readPatterns = [
    "-read",
    "-viewer",
    "-view",
    "-user",
    "-access",
    "-reporting",
  ];

  if (readPatterns.some((pattern) => nameLower.includes(pattern))) {
    return {
      name,
      category: "read",
      riskLevel: "low",
    };
  }

  // Default to other
  return {
    name,
    category: "other",
    riskLevel: "low",
  };
}

/**
 * Categorize an array of roles
 * @param {Array<string>} roles - Array of role names
 * @returns {Object} Categorized roles { admin: [], write: [], read: [], other: [] }
 */
function categorizeRoles(roles) {
  const categorized = {
    admin: [],
    write: [],
    read: [],
    other: [],
  };

  if (!Array.isArray(roles)) {
    return categorized;
  }

  roles.forEach((role) => {
    const { name, category } = categorizeRole(role);
    if (categorized[category]) {
      categorized[category].push(name);
    }
  });

  return categorized;
}

/**
 * Get risk emoji for display
 * @param {string} riskLevel - 'high', 'medium', or 'low'
 * @returns {string} Emoji representation
 */
function getRiskEmoji(riskLevel) {
  const emojiMap = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
    unknown: "⚪",
  };
  return emojiMap[riskLevel] || "⚪";
}

/**
 * Analyze a single user's roles
 * @param {Object} user - { sso, roles: [] }
 * @returns {Object} Analysis results
 */
function analyzeUserRoles(user) {
  const categorized = categorizeRoles(user.roles);

  return {
    sso: user.sso,
    totalRoles: user.roles.length,
    adminRoles: categorized.admin.length,
    writeRoles: categorized.write.length,
    readRoles: categorized.read.length,
    otherRoles: categorized.other.length,
    categorizedRoles: categorized,
    riskLevel:
      categorized.admin.length > 0
        ? "high"
        : categorized.write.length > 3
          ? "medium"
          : "low",
  };
}

module.exports = {
  categorizeRole,
  categorizeRoles,
  getRiskEmoji,
  analyzeUserRoles,
};
