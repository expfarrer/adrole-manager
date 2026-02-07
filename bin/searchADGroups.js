#!/usr/bin/env node
const { program } = require("commander");
const { loadSearchByADGroup } = require("../lib/ldapSearch.js");
const prompts = require("prompts");

const run = async () => {
  program
    .version("0.1.0")
    .argument("<ADGroups...>", "AD group to search members for")
    .action(async (ADGroups) => {
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
          mask: "*",
        },
      ]);
      
      const { username, password } = responses;
      if (!(username && password)) {
        console.log("Username and password are required");
        process.exit(1);
      }

      // Get members for each AD group
      const results = await Promise.all(
        ADGroups.map(group => loadSearchByADGroup(username, password, group))
      );
      
      if (!results || results.length === 0) { 
        console.log('No results found');
        process.exit(1);
      }

      // Process results for each group
      ADGroups.forEach((group, index) => {
        if (results[index]) {
          const table = results[index]
            .split("\n")
            .filter(Boolean)
            .map((entry) => {
              const member = entry.split("CN=")[1] || entry;
              return {
                Group: group,
                Member: member,
              };
            });
          
          console.log(`\n=== Members of ${group} ===`);
          console.table(table);
        }
      });
    });

  program.parse();
};

run();