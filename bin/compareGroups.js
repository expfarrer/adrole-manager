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
          console.log("Comparing more than 2 users:");
          const table = processedResults
            .map((element) => {
              return {
                [element.sso]: element.groups,
              };
            })
            .filter((element) => {
              const key = Object.keys(element)[0];
              return element[key] && element[key].length > 0;
            });

          console.table(table);
        }
      }
    });

  program.parse(process.argv);
};

run();
