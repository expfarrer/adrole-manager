const { program } = require("commander");
const { getLDAPParallel, ldapSearch } = require("../lib/ldapsearch.js");
const { getLDAPParallel, ldapSearchByADGroup } = require("../lib/ldapsearch.js");
const prompts = require("prompts");

const run = async () => {
  program
    .version("0.1.0")
    .option("-SSO [SSO] to process")
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
        },
      ]);
      const { username, password } = responses;
      if (!(username && password)) {
        console.log("Username and password are required");
        process.exit(1);
      }

      const results = await getLDAPParallel(ldapSearch, username, password, SSOs);
      if (!SSOs.length) {
        process.exit("no SSOs");
      } else {
        const rows = [];
        for (const SSO of SSOs) {
          rows.push({
            SSO,
          });
        }
      }
      if (SSOs.length == 2) {
        compare = results[0].split("\n").sort().filter(Boolean);
      }
      if (SSOs.length >= 2) {
        const results1 = new Set(results[0].split("\n").sort().filter(Boolean));
        const results2 = new Set(results[1].split("\n").sort().filter(Boolean));
        for (const element of results1) {
          if (!results2.has(element)) {
            rows[0][element] = true;
          } else if (results2.has(element)) {
            rows[0][element] = "√";
            rows[1][element] = "√";
          }
        }
        for (const element of results2) {
          if (!results1.has(element)) {
            rows[1][element] = true;
          }
        }
      }

      const ordered = Object.keys(rows[0]).sort().reduce(
        (obj, key) => {
          obj[key] = rows[0][key];
          return obj;
        },
        {}
      );

      console.table(ordered);
    });

  program.parse();
};

run();
