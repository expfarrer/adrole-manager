#!/usr/bin/env node
const { program } = require("commander");
const { getLDAPInParallel } = require("../lib/ldapSearch");
const { loadFeature } = require("../lib/featureLoader");
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

function showMaxUsersWarning(requested, limit) {
  console.log("\n");
  console.log(
    "┌───────────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│  🚫  MAXIMUM USERS REACHED                                        │",
  );
  console.log(
    "├───────────────────────────────────────────────────────────────────┤",
  );
  console.log(
    `│  👥 Requested: ${requested.toString().padStart(2)} users  │  ⚠️  Limit: ${limit.toString().padStart(2)} users (LDAP max)       │`,
  );
  console.log(
    "├───────────────────────────────────────────────────────────────────┤",
  );
  console.log(
    "│  💡 Options:                                                      │",
  );
  console.log(
    "│     • Split into groups of 5 or fewer                             │",
  );
  console.log(
    "│     • Run multiple queries back-to-back                           │",
  );
  console.log(
    "│     • Contact LDAP admin for higher limits                        │",
  );
  console.log(
    "└───────────────────────────────────────────────────────────────────┘",
  );
  console.log("\n");
}

const run = async () => {
  program
    .version("1.1.0")
    .description("Generate team access summary report")
    .argument("<users...>", "SSO usernames to analyze")
    .option("-o, --output <file>", "Output file (default: console)")
    .option("-f, --format <type>", "Output format: text or html", "text")
    .action(async (users, options) => {
      const teamSummary = loadFeature("team-summary");
      if (!teamSummary) {
        console.error("\n❌ Team summary feature is not available");
        console.error("💡 Enable it in config/features.json");
        console.error('💡 Run "yarn commands" to see all available commands\n');
        process.exit(1);
      }

      if (!users || users.length === 0) {
        console.error("\n❌ Error: No users specified");
        console.error("Usage: yarn team-summary <user1> <user2> <user3> ...");
        console.error('\n💡 Run "yarn commands" for examples and help\n');
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

      const originalLog = console.log;

      try {
        console.log = () => {};

        const spinner = showSpinner(`Analyzing ${users.length} user(s)...`);
        const results = await getLDAPInParallel(username, password, users);
        stopSpinner(spinner);

        console.log = originalLog;

        const processedUsers = results.map((stdout, index) => {
          return {
            sso: users[index],
            roles: stdout.split("\n").filter(Boolean),
          };
        });

        const analysis = teamSummary.analyzeTeam(processedUsers);

        console.log("\nTeam Summary Report");
        console.log("=".repeat(80));
        console.log(`Team size: ${analysis.teamSize} members`);
        console.log(
          `Total roles: ${analysis.totalRoles} (avg ${analysis.avgRoles} per person)`,
        );
        console.log(`Average admin roles: ${analysis.avgAdminRoles}`);
        console.log(`Average write roles: ${analysis.avgWriteRoles}`);
        console.log(`Average read roles: ${analysis.avgReadRoles}`);

        console.log("\n📊 Team Members:");
        console.log("─".repeat(80));
        analysis.userAnalyses.forEach((user) => {
          const risk = teamSummary.getRiskEmoji(user.riskLevel);
          console.log(
            `${risk} ${user.sso.padEnd(15)} Total: ${user.totalRoles.toString().padStart(2)}  |  Admin: ${user.adminRoles.toString().padStart(2)}  |  Write: ${user.writeRoles.toString().padStart(2)}  |  Read: ${user.readRoles.toString().padStart(2)}`,
          );
        });

        if (analysis.commonRoles.length > 0) {
          console.log(`\n🔗 Common roles (all ${analysis.teamSize} members):`);
          console.log("─".repeat(80));
          analysis.commonRoles.forEach((role) => console.log(`  • ${role}`));
        }

        console.log("\n💡 Recommendations:");
        console.log("─".repeat(80));
        analysis.recommendations.forEach((rec) => console.log(`  • ${rec}`));

        console.log("\n");

        process.exit(0);
      } catch (error) {
        console.log = originalLog;

        // Check if it's the max users error
        if (error.message.includes("Too many concurrent queries")) {
          const limit = 5;
          showMaxUsersWarning(users.length, limit);
          process.exit(1);
        }

        console.error("\n❌ Error:", error.message);
        console.error(
          '\n💡 Tip: Run "yarn commands" to see all available options\n',
        );
        process.exit(1);
      }
    });

  program.parse(process.argv);
};

run();
