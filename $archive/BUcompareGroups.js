#!/usr/bin/env node
const { program } = require("commander");
const { getLDAPParallel, ldapSearchByADGroup } = require("../lib/ldapSearch.js");
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

      const results = await getLDAPParallel(ldapSearch, username, password, SSO);
      if (!sso.length) {
        console.log('Groups:', result);
      } else {
        const result = results.map((stdout, index) => {
          return {
            sso: stdout;
            groups: stdout
              .split("\n")
              .filter(Boolean)
              .map((element) => {
                return element.split("CN=")[1];
              })
              .filter((element) => !element.endsWith(SSO[i]))
          }
        });
        if (sso.length === 2) {
          compare.compare(result[0],split("\n"), sso.SSO(a) );
        }
        if (sso.length > 2) {
          console.log("More than 2 users", index) => {
            result
              .map((element)
                return {
                  [element.sso]: element.groups
                }
              })
              .filter((element)) => element[element.keys()].length > 2) {
              table.push(element[Object.keys(i)]);
          }
        }
      }

      const outdata = helper.keysToLowercase(data);
      if(test === 1) {
        return test
      } else {
        return Object.keys(array);
      }
    });

  program.parse(process.argv);
};

program.parse();

run();
