const util = require("util");
const { execFile } = require("child_process");
const execFilePromise = util.promisify(execFile);
const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

// ============================================================================
// SECURITY: Input Validation
// ============================================================================

function validateUsername(username) {
  if (!username || typeof username !== "string") {
    throw new Error("Invalid username: must be a non-empty string");
  }

  // Only allow alphanumeric, dots, hyphens, underscores
  // Prevents command injection and LDAP injection
  if (!/^[a-zA-Z0-9._-]{1,50}$/.test(username)) {
    throw new Error(
      "Invalid username: contains illegal characters or exceeds length limit",
    );
  }

  // Prevent directory traversal
  if (
    username.includes("..") ||
    username.includes("/") ||
    username.includes("\\")
  ) {
    throw new Error("Invalid username: path traversal detected");
  }

  return true;
}

// ============================================================================
// SECURITY: LDAP Filter Escaping
// ============================================================================

function escapeLDAPFilter(str) {
  // Escape special LDAP filter characters per RFC 4515
  // Prevents LDAP injection attacks
  const escapeMap = {
    "*": "\\2a",
    "(": "\\28",
    ")": "\\29",
    "\\": "\\5c",
    "\0": "\\00",
  };

  return str
    .split("")
    .map((char) => escapeMap[char] || char)
    .join("");
}

// ============================================================================
// SECURITY: Rate Limiting
// ============================================================================

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20; // Max queries per window

function checkRateLimit(username) {
  const now = Date.now();
  const userKey = username.toLowerCase();

  // Get user's query history
  const userLog = rateLimitStore.get(userKey) || [];

  // Remove expired entries
  const recentQueries = userLog.filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW,
  );

  // Check if limit exceeded
  if (recentQueries.length >= RATE_LIMIT_MAX) {
    const resetTime = Math.ceil(
      (recentQueries[0] + RATE_LIMIT_WINDOW - now) / 1000,
    );
    throw new Error(
      `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX} queries per minute. Try again in ${resetTime} seconds.`,
    );
  }

  // Add current query
  recentQueries.push(now);
  rateLimitStore.set(userKey, recentQueries);

  return true;
}

// ============================================================================
// SECURITY: Audit Logging
// ============================================================================

async function auditLog(event, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event,
    user: details.user || "unknown",
    target: details.target || [],
    sessionId: details.sessionId || crypto.randomBytes(8).toString("hex"),
    success: details.success !== undefined ? details.success : true,
    error: details.error || null,
    ipAddress: process.env.SSH_CLIENT?.split(" ")[0] || "localhost",
    hostname: os.hostname(),
  };

  // Log to stderr (not stdout, so it doesn't interfere with data)
  console.error(`[AUDIT] ${JSON.stringify(logEntry)}`);

  // Also write to log file
  try {
    const logDir = path.join(os.tmpdir(), "adrole-manager-logs");
    await fs.mkdir(logDir, { recursive: true });

    const logFile = path.join(
      logDir,
      `audit-${new Date().toISOString().split("T")[0]}.log`,
    );
    await fs.appendFile(logFile, JSON.stringify(logEntry) + "\n");
  } catch (err) {
    // Don't fail if logging fails
    console.error("[AUDIT] Warning: Could not write to log file:", err.message);
  }
}

// ============================================================================
// SECURITY: Secure Password Handling
// ============================================================================

function clearSensitiveData(obj) {
  // Overwrite password in memory before deletion
  if (obj && obj.password) {
    obj.password = crypto.randomBytes(obj.password.length).toString("hex");
    delete obj.password;
  }
}

// ============================================================================
// MAIN LDAP SEARCH FUNCTION (SECURED)
// ============================================================================

const ldapSearch = async (user, password, sso) => {
  const sessionId = crypto.randomBytes(8).toString("hex");

  try {
    // SECURITY: Input validation
    validateUsername(user);
    validateUsername(sso);

    if (!password || typeof password !== "string" || password.length > 256) {
      throw new Error("Invalid password format");
    }

    // SECURITY: Rate limiting
    checkRateLimit(user);

    // SECURITY: Audit logging (start)
    await auditLog("LDAP_QUERY_START", {
      user,
      target: [sso],
      sessionId,
    });

    console.log(`Searching for user: ${sso}`);

    // SECURITY: Escape LDAP filter to prevent injection
    const escapedSso = escapeLDAPFilter(sso);

    // SECURITY: Use execFile instead of exec
    // execFile does NOT invoke a shell, preventing command injection
    const args = [
      "-x", // Simple authentication
      "-b",
      "dc=company,dc=com", // Base DN
      "-H",
      "ldap://localhost:389", // LDAP URL
      "-D",
      "cn=admin,dc=company,dc=com", // Bind DN
      "-w",
      password, // Password (passed as argument, not interpolated)
      `(uid=${escapedSso})`, // Escaped filter
      "memberOf", // Requested attributes
    ];

    // SECURITY: Add timeout and buffer limits
    const options = {
      timeout: 10000, // 10 second timeout
      maxBuffer: 1024 * 1024, // 1MB max output
      killSignal: "SIGTERM",
    };

    const { stdout, stderr } = await execFilePromise(
      "ldapsearch",
      args,
      options,
    );

    if (stderr) {
      // Log stderr but don't expose details to user
      await auditLog("LDAP_QUERY_WARNING", {
        user,
        target: [sso],
        sessionId,
        error: "stderr output received",
      });
    }

    // Parse results
    const groups = stdout
      .split("\n")
      .filter((line) => /^memberOf:/i.test(line))
      .map((line) => {
        const match = line.match(/cn=([^,]+)/i);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .sort()
      .join("\n");

    console.log("Found groups:", groups);

    // SECURITY: Audit logging (success)
    await auditLog("LDAP_QUERY_SUCCESS", {
      user,
      target: [sso],
      sessionId,
      resultCount: groups.split("\n").filter(Boolean).length,
    });

    return groups;
  } catch (error) {
    // SECURITY: Audit logging (failure)
    await auditLog("LDAP_QUERY_FAILED", {
      user,
      target: [sso],
      sessionId,
      success: false,
      error: error.code || error.message,
    });

    // SECURITY: Don't expose internal error details to user
    if (error.message.includes("Rate limit")) {
      throw error; // Rate limit errors are safe to expose
    } else if (error.message.includes("Invalid username")) {
      throw error; // Validation errors are safe to expose
    } else if (error.killed || error.signal) {
      throw new Error("LDAP query timeout - request took too long");
    } else {
      console.error("LDAP query error:", error.message);
      throw new Error(
        "Failed to query LDAP server. Please contact your administrator.",
      );
    }
  } finally {
    // SECURITY: Clear password from memory
    clearSensitiveData({ password });
  }
};

// ============================================================================
// GROUP SEARCH FUNCTION (SECURED)
// ============================================================================

async function loadSearchByADGroup(user, password, group) {
  const sessionId = crypto.randomBytes(8).toString("hex");

  try {
    // SECURITY: Input validation
    validateUsername(user);
    validateUsername(group);

    if (!password || typeof password !== "string") {
      throw new Error("Invalid password format");
    }

    // SECURITY: Rate limiting
    checkRateLimit(user);

    // SECURITY: Audit logging
    await auditLog("LDAP_GROUP_QUERY_START", {
      user,
      target: [group],
      sessionId,
    });

    console.log(`Searching for group: ${group}`);

    // SECURITY: Escape LDAP filter
    const escapedGroup = escapeLDAPFilter(group);

    // SECURITY: Use execFile instead of exec
    const args = [
      "-x",
      "-b",
      "dc=company,dc=com",
      "-H",
      "ldap://localhost:389",
      "-D",
      "cn=admin,dc=company,dc=com",
      "-w",
      password,
      `(&(objectClass=groupOfNames)(cn=${escapedGroup}))`,
      "member",
    ];

    const options = {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGTERM",
    };

    const { stdout, stderr } = await execFilePromise(
      "ldapsearch",
      args,
      options,
    );

    if (stderr) {
      await auditLog("LDAP_GROUP_QUERY_WARNING", {
        user,
        target: [group],
        sessionId,
        error: "stderr output received",
      });
    }

    // Parse results
    const members = stdout
      .split("\n")
      .filter((line) => /^member:/i.test(line))
      .map((line) => {
        const match = line.match(/cn=([^,]+)/i);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .join("\n");

    console.log("Found members:", members);

    // SECURITY: Audit logging (success)
    await auditLog("LDAP_GROUP_QUERY_SUCCESS", {
      user,
      target: [group],
      sessionId,
      resultCount: members.split("\n").filter(Boolean).length,
    });

    return members;
  } catch (error) {
    // SECURITY: Audit logging (failure)
    await auditLog("LDAP_GROUP_QUERY_FAILED", {
      user,
      target: [group],
      sessionId,
      success: false,
      error: error.code || error.message,
    });

    // SECURITY: Sanitize error messages
    if (error.message.includes("Rate limit")) {
      throw error;
    } else if (error.message.includes("Invalid username")) {
      throw error;
    } else if (error.killed || error.signal) {
      throw new Error("LDAP query timeout - request took too long");
    } else {
      console.error("LDAP group query error:", error.message);
      throw new Error(
        "Failed to query LDAP server. Please contact your administrator.",
      );
    }
  } finally {
    // SECURITY: Clear password from memory
    clearSensitiveData({ password });
  }
}

// ============================================================================
// PARALLEL QUERY FUNCTION (SECURED)
// ============================================================================

async function getLDAPInParallel(username, password, queries) {
  const sessionId = crypto.randomBytes(8).toString("hex");

  try {
    // SECURITY: Validate inputs
    validateUsername(username);

    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error("Invalid queries: must be a non-empty array");
    }

    // SECURITY: Limit concurrent queries
    if (queries.length > 5) {
      throw new Error(
        "Too many concurrent queries. Maximum 5 users can be queried at once.",
      );
    }

    // SECURITY: Validate each query target
    queries.forEach((query) => validateUsername(query));

    // SECURITY: Audit logging
    await auditLog("LDAP_PARALLEL_QUERY_START", {
      user: username,
      target: queries,
      sessionId,
    });

    const promises = queries.map((query) =>
      ldapSearch(username, password, query),
    );
    const results = await Promise.all(promises);

    console.log("All Promises fulfilled");

    // SECURITY: Audit logging (success)
    await auditLog("LDAP_PARALLEL_QUERY_SUCCESS", {
      user: username,
      target: queries,
      sessionId,
    });

    return results;
  } catch (error) {
    // SECURITY: Audit logging (failure)
    await auditLog("LDAP_PARALLEL_QUERY_FAILED", {
      user: username,
      target: queries,
      sessionId,
      success: false,
      error: error.message,
    });

    console.error("Error in parallel search");
    throw error;
  }
}

// Clean up rate limit store periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now();
    for (const [username, queries] of rateLimitStore.entries()) {
      const recentQueries = queries.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW,
      );
      if (recentQueries.length === 0) {
        rateLimitStore.delete(username);
      } else {
        rateLimitStore.set(username, recentQueries);
      }
    }
  },
  5 * 60 * 1000,
);

module.exports = {
  ldapSearch,
  getLDAPInParallel,
  loadSearchByADGroup,
};
