#!/usr/bin/env node
const { program } = require("commander");
const { getLDAPInParallel } = require("../lib/ldapSearch.js");
const { loadFeature } = require("../lib/featureLoader");
const compare = require("../lib/listCompare.js");
const prompts = require("prompts");

// Simple loading spinner
function showSpinner(message) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  return setInterval(() => {
    process.stdout.write(`\r${frames[i]} ${message}`);
    i = (i + 1) % frames.length;
  }, 80);
}

function stopSpinner(spinner) {
  clearInterval(spinner);
  process.stdout.write("\r\x1b[K");
}

const run = async () => {
  program
    .version("0.1.0")
    .description("SSO ID(s) to process")
    .argument("[sso...]") // Changed to optional with square brackets
    .action(async (sso) => {
      if (!sso || sso.length === 0) {
        console.error("\n❌ Error: No users specified");
        console.error("Usage: yarn get-ad-groups <user1> <user2> ...");
        console.error('\n💡 Run "yarn commands" for examples and help\n');
        process.exit(1);
      }

      if (sso.length > 5) {
        console.error(`\n❌ Error: Maximum 5 users can be compared at once.`);
        console.error(
          `   You requested ${sso.length} users: ${sso.join(", ")}`,
        );
        console.error(
          `\n💡 Tip: Try "yarn team-summary" for analyzing larger teams`,
        );
        console.error('💡 Run "yarn commands" to see all available options\n');
        process.exit(1);
      }

      // Prompt for credentials (or use env vars for testing)
      let username, password;

      if (process.env.LDAP_TEST_USER && process.env.LDAP_TEST_PASS) {
        username = process.env.LDAP_TEST_USER;
        password = process.env.LDAP_TEST_PASS;
      } else {
        const responses = await prompts([
          {
            type: "text",
            name: "username",
            message: "Enter your SSO",
          },
          {
            type: "password",
            name: "password",
            message: "Enter your SSO password",
          },
        ]);
        username = responses.username;
        password = responses.password;
      }

      if (!(username && password)) {
        console.log("Username and password are required");
        process.exit(1);
      }

      try {
        const originalLog = console.log;
        const originalError = console.error;
        console.log = () => {};
        console.error = () => {};

        const spinner = showSpinner(`Analyzing ${sso.length} user(s)...`);
        const results = await getLDAPInParallel(username, password, sso);

        console.log = originalLog;
        console.error = originalError;
        stopSpinner(spinner);

        if (sso.length === 1) {
          displaySingleUserTable(sso[0], results[0]);
        } else {
          const processedResults = results.map((stdout, index) => {
            return {
              sso: sso[index],
              groups: stdout.split("\n").filter(Boolean),
            };
          });

          if (sso.length === 2) {
            compare.compare(processedResults[0], processedResults[1]);
          }

          if (sso.length > 2) {
            displayMultiColumnComparison(processedResults);
          }
        }

        process.exit(0);
      } catch (error) {
        console.error("\n❌ Error:", error.message);
        console.error(
          '\n💡 Tip: Run "yarn commands" to see all available options\n',
        );
        process.exit(1);
      }
    });

  program.parse(process.argv);
};

function displaySingleUserTable(user, rolesString) {
  const teamSummary = loadFeature("team-summary");
  const roles = rolesString.split("\n").filter(Boolean);

  if (roles.length === 0) {
    console.log(`\n❌ No roles found for user: ${user}`);
    console.log("💡 User may not exist or has no group memberships\n");
    process.exit(1);
  }

  console.log("\n");

  const indexWidth = 5;
  const roleWidth = 71;
  const indexSep = "─".repeat(indexWidth);
  const roleSep = "─".repeat(roleWidth);

  const topBorder = "┌" + indexSep + "┬" + roleSep + "┐";
  const midBorder = "├" + indexSep + "┼" + roleSep + "┤";
  const bottomBorder = "└" + indexSep + "┴" + roleSep + "┘";

  const green = "\x1b[32m";
  const reset = "\x1b[0m";

  console.log(topBorder);
  console.log(
    "│ " +
      "#".padEnd(indexWidth - 2) +
      " │ " +
      `${user} (${roles.length} roles)`.padEnd(roleWidth - 2) +
      " │",
  );
  console.log(midBorder);

  roles.forEach((role, index) => {
    const displayRole =
      role.length > roleWidth - 4
        ? role.substring(0, roleWidth - 7) + "..."
        : role;
    const coloredRole = green + displayRole + reset;
    const padding = roleWidth - 2 - displayRole.length;
    console.log(
      "│ " +
        index.toString().padEnd(indexWidth - 2) +
        " │ " +
        coloredRole +
        " ".repeat(padding) +
        " │",
    );
  });

  console.log(bottomBorder);

  if (teamSummary) {
    const analysis = teamSummary.analyzeUserRoles({ sso: user, roles });
    const risk = teamSummary.getRiskEmoji(analysis.riskLevel);

    console.log("\n📊 Summary:");
    console.log("─".repeat(80));
    console.log(`   Total Roles: ${analysis.totalRoles}`);
    console.log(`   Risk Level:  ${risk} ${analysis.riskLevel.toUpperCase()}`);
    console.log("");
    console.log(
      `   Admin roles:  ${analysis.adminRoles.toString().padStart(2)} 🔴 (High risk)`,
    );
    console.log(
      `   Write roles:  ${analysis.writeRoles.toString().padStart(2)} 🟡 (Medium risk)`,
    );
    console.log(
      `   Read roles:   ${analysis.readRoles.toString().padStart(2)} 🟢 (Low risk)`,
    );
    console.log(
      `   Other roles:  ${analysis.otherRoles.toString().padStart(2)} ⚪ (Uncategorized)`,
    );

    if (analysis.categorizedRoles.admin.length > 0) {
      console.log("\n🔴 Admin Roles (High Risk):");
      console.log("─".repeat(80));
      analysis.categorizedRoles.admin.forEach((role) =>
        console.log(`   • ${role}`),
      );
    }

    if (analysis.categorizedRoles.write.length > 0) {
      console.log("\n🟡 Write/Modify Roles (Medium Risk):");
      console.log("─".repeat(80));
      analysis.categorizedRoles.write.forEach((role) =>
        console.log(`   • ${role}`),
      );
    }

    if (analysis.categorizedRoles.read.length > 0) {
      console.log("\n🟢 Read-Only Roles (Low Risk):");
      console.log("─".repeat(80));
      analysis.categorizedRoles.read.forEach((role) =>
        console.log(`   • ${role}`),
      );
    }

    if (analysis.categorizedRoles.other.length > 0) {
      console.log("\n⚪ Other Roles:");
      console.log("─".repeat(80));
      analysis.categorizedRoles.other.forEach((role) =>
        console.log(`   • ${role}`),
      );
    }

    console.log("\n💡 Recommendations:");
    console.log("─".repeat(80));
    if (analysis.adminRoles > 5) {
      console.log(
        `   ⚠️  User has ${analysis.adminRoles} admin roles - review for least privilege`,
      );
    }
    if (analysis.adminRoles === 0 && analysis.writeRoles === 0) {
      console.log("   ✓ User has read-only access - good security posture");
    }
    if (analysis.totalRoles > 40) {
      console.log("   ⚠️  High number of roles - possible access creep");
    }
    if (analysis.totalRoles < 5) {
      console.log(
        "   ℹ️  Low number of roles - verify user has sufficient access",
      );
    }
    if (analysis.adminRoles > 0 && analysis.adminRoles <= 3) {
      console.log("   ✓ Admin access is limited - reasonable for role");
    }
  }

  console.log("\n");
}

function displayMultiColumnComparison(processedResults) {
  console.log("\n");

  const allGroups = processedResults.map((r) => new Set(r.groups));
  const sharedByAll = processedResults[0].groups.filter((group) =>
    allGroups.every((userGroups) => userGroups.has(group)),
  );

  const userUniqueRoles = processedResults.map((user, index) => {
    const otherUsersGroups = new Set();
    processedResults.forEach((otherUser, otherIndex) => {
      if (otherIndex !== index) {
        otherUser.groups.forEach((g) => otherUsersGroups.add(g));
      }
    });

    return {
      sso: user.sso,
      totalRoles: user.groups.length,
      uniqueRoles: user.groups.filter((g) => !otherUsersGroups.has(g)),
      allRoles: user.groups,
    };
  });

  let longestRole = 0;
  userUniqueRoles.forEach((user) => {
    user.uniqueRoles.forEach((role) => {
      longestRole = Math.max(longestRole, role.length);
    });
  });

  const longestHeader = Math.max(
    ...userUniqueRoles.map(
      (u) => `${u.sso} (${u.uniqueRoles.length} unique)`.length,
    ),
  );

  const userCount = processedResults.length;
  let maxColWidth;

  if (userCount === 2) {
    maxColWidth = 50;
  } else if (userCount === 3) {
    maxColWidth = 36;
  } else if (userCount === 4) {
    maxColWidth = 28;
  } else {
    maxColWidth = 24;
  }

  const colWidth = Math.max(
    Math.min(longestRole + 2, maxColWidth),
    Math.min(longestHeader + 2, maxColWidth),
    20,
  );

  const separator = "─".repeat(colWidth);
  const topBorder = "┌" + processedResults.map(() => separator).join("┬") + "┐";
  const midBorder = "├" + processedResults.map(() => separator).join("┼") + "┤";
  const bottomBorder =
    "└" + processedResults.map(() => separator).join("┴") + "┘";

  const green = "\x1b[32m";
  const reset = "\x1b[0m";

  console.log(topBorder);

  const headers = userUniqueRoles.map((u) => {
    const header = `${u.sso} (${u.uniqueRoles.length} unique)`;
    if (header.length > colWidth - 2) {
      return (header.substring(0, colWidth - 5) + "...").padEnd(colWidth - 2);
    }
    return header.padEnd(colWidth - 2);
  });
  console.log("│ " + headers.join(" │ ") + " │");
  console.log(midBorder);

  const maxUniqueRoles = Math.max(
    ...userUniqueRoles.map((u) => u.uniqueRoles.length),
  );

  for (let i = 0; i < maxUniqueRoles; i++) {
    const row = userUniqueRoles.map((u) => {
      const role = u.uniqueRoles[i] || "";
      let displayRole = role;
      if (role.length > colWidth - 2) {
        displayRole = role.substring(0, colWidth - 5) + "...";
      }
      if (displayRole) {
        const coloredRole = green + displayRole + reset;
        const padding = colWidth - 2 - displayRole.length;
        return coloredRole + " ".repeat(padding);
      }
      return "".padEnd(colWidth - 2);
    });
    console.log("│ " + row.join(" │ ") + " │");
  }

  console.log(bottomBorder);

  if (sharedByAll.length > 0) {
    console.log(
      `\n🔗 Shared by ALL ${processedResults.length} users (${sharedByAll.length} roles):`,
    );
    console.log("═".repeat(80));

    const sharedSorted = sharedByAll.sort();
    const halfWay = Math.ceil(sharedSorted.length / 2);
    const col1 = sharedSorted.slice(0, halfWay);
    const col2 = sharedSorted.slice(halfWay);

    for (let i = 0; i < col1.length; i++) {
      const left = `  • ${col1[i]}`.padEnd(45);
      const right = col2[i] ? `  • ${col2[i]}` : "";
      console.log(left + right);
    }
  }

  console.log("\n📊 Summary:");
  console.log("═".repeat(80));
  userUniqueRoles.forEach((u) => {
    const sharedCount = u.totalRoles - u.uniqueRoles.length;
    console.log(
      `  ${u.sso.padEnd(15)} Total: ${u.totalRoles.toString().padStart(2)}  |  Unique: ${u.uniqueRoles.length.toString().padStart(2)}  |  Shared: ${sharedCount.toString().padStart(2)}`,
    );
  });
  console.log("\n");
}

run();
