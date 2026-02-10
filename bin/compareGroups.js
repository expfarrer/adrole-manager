#!/usr/bin/env node
const { program } = require("commander");
const { getLDAPInParallel, ldapSearch } = require("../lib/ldapSearch.js");
const compare = require("../lib/listCompare.js");
const prompts = require("prompts");

const run = async () => {
  program
    .version("0.1.0")
    .description("SSO ID(s) to process")
    .argument("<sso...>")
    .action(async (sso) => {
      // Check max limit
      if (sso.length > 5) {
        console.error(`\n❌ Error: Maximum 5 users can be compared at once.`);
        console.error(
          `   You requested ${sso.length} users: ${sso.join(", ")}`,
        );
        console.error(
          `\n💡 Tip: Try comparing smaller groups or run multiple comparisons.\n`,
        );
        process.exit(1);
      }

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

      const { username, password } = responses;
      if (!(username && password)) {
        console.log("Username and password are required");
        process.exit(1);
      }

      const results = await getLDAPInParallel(username, password, sso);

      if (sso.length === 1) {
        console.log("Groups:", results[0]);
      } else {
        const processedResults = results.map((stdout, index) => {
          return {
            sso: sso[index],
            groups: stdout
              .split("\n")
              .filter(Boolean)
              .map((element) => {
                // Extract group name after cn= or CN= (case insensitive)
                const match = element.match(/cn=(.+)/i);
                return match ? match[1] : null;
              })
              .filter(Boolean) // Remove null values
              .filter((element) => {
                // Remove entries that end with the SSO username
                const currentSso = sso[index];
                return currentSso
                  ? !element.toLowerCase().endsWith(currentSso.toLowerCase())
                  : true;
              }),
          };
        });

        if (sso.length === 2) {
          compare.compare(processedResults[0], processedResults[1]);
        }

        if (sso.length > 2) {
          displayMultiColumnComparison(processedResults);
        }
      }
    });

  program.parse(process.argv);
};

function displayMultiColumnComparison(processedResults) {
  console.log("\n");

  // Find roles shared by ALL users
  const allGroups = processedResults.map((r) => new Set(r.groups));
  const sharedByAll = processedResults[0].groups.filter((group) =>
    allGroups.every((userGroups) => userGroups.has(group)),
  );

  // Calculate unique roles for each user
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

  // Column width optimized for up to 5 users
  const colWidth = 28;
  const separator = "─".repeat(colWidth);
  const topBorder = "┌" + processedResults.map(() => separator).join("┬") + "┐";
  const midBorder = "├" + processedResults.map(() => separator).join("┼") + "┤";
  const bottomBorder =
    "└" + processedResults.map(() => separator).join("┴") + "┘";

  console.log(topBorder);

  // Print user headers with unique count
  const headers = userUniqueRoles.map((u) =>
    `${u.sso} (${u.uniqueRoles.length} unique)`.padEnd(colWidth - 2),
  );
  console.log("│ " + headers.join(" │ ") + " │");
  console.log(midBorder);

  // Print unique roles in columns
  const maxUniqueRoles = Math.max(
    ...userUniqueRoles.map((u) => u.uniqueRoles.length),
  );

  for (let i = 0; i < maxUniqueRoles; i++) {
    const row = userUniqueRoles.map((u) => {
      const role = u.uniqueRoles[i] || "";
      return role.padEnd(colWidth - 2);
    });
    console.log("│ " + row.join(" │ ") + " │");
  }

  console.log(bottomBorder);

  // Print shared roles section
  if (sharedByAll.length > 0) {
    console.log(
      `\n🔗 Shared by ALL ${processedResults.length} users (${sharedByAll.length} roles):`,
    );
    console.log("═".repeat(80));

    // Print in 2 columns for better readability
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

  // Print summary statistics
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
