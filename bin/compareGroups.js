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
        console.log('Groups:', results[0]);
      } else {
        const processedResults = results.map((stdout, index) => {
          return {
            sso: sso[index],
            groups: stdout
              .split("\n")
              .filter(Boolean)
              .map((element) => {
                return element.split("CN=")[1];
              })
              .filter((element) => !element.endsWith(sso[index]))
          };
        });
        
        if (sso.length === 2) {
          compare.compare(
            processedResults[0], 
            processedResults[1]
          );
        }
        
        if (sso.length > 2) {
          console.log("Comparing more than 2 users:");
          const table = processedResults
            .map((element) => {
              return {
                [element.sso]: element.groups
              };
            })
            .filter((element) => {
              const key = Object.keys(element)[0];
              return element[key].length > 2;
            });
          
          console.table(table);
        }
      }
    });

  program.parse(process.argv);
};

run();