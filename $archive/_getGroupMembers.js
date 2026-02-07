#!/usr/bin/env node
const { program } = require("commander");
const { getLDAPParallel, ldapSearchByADGroup } = require("../lib/ldap");
const prompts = require("prompts");

const run = async () => {
  program
    .version("0.1.0")
    .argument("ADGroups...", "AD group to search members for")
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

      const results = await getLDAPParallel(ldapSearchByADGroup, username, password, ADGroups);
      if (!results) { process.exit("no results found"); }
      const table = results[0]
        .split("\n")
        .filter(Boolean)
        .map((entry) => {
          return {
            [ADGroups[0]]: entry,
          };
        });
      console.table(table);
    });

  program.parse();
};

run();
