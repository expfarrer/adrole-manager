const util = require("util");
const exec = util.promisify(require("child_process").exec);

const ldapSearch = async (user, password, sso) => {
  console.log(`Searching for user: ${sso}`);

  // Use admin credentials for OpenLDAP
  const bindDN = "cn=admin,dc=company,dc=com";
  const bindPassword = "admin";

  try {
    const { stdout, stderr } = await exec(
      `ldapsearch -x -b "dc=company,dc=com" -H "ldap://localhost:389" -D "${bindDN}" -w "${bindPassword}" "(uid=${sso})" memberOf | grep "^memberOf:" | awk '{print $2}' | awk -F ',' '{print $1}' | sort`,
    );

    if (stderr) console.log("stderr:", stderr);
    console.log("Found groups:", stdout);
    return stdout;
  } catch (error) {
    console.error("ldapsearch error:", error.message);
    throw error;
  }
};

async function loadSearchByADGroup(user, password, group) {
  console.log(`Searching for group: ${group}`);

  const bindDN = "cn=admin,dc=company,dc=com";
  const bindPassword = "admin";

  try {
    const { stdout, stderr } = await exec(
      `ldapsearch -x -b "dc=company,dc=com" -H "ldap://localhost:389" -D "${bindDN}" -w "${bindPassword}" "(&(objectClass=groupOfNames)(cn=${group}))" member | grep "^member:" | awk '{print $2}' | awk -F ',' '{print $1}'`,
    );

    if (stderr) console.log("stderr:", stderr);
    console.log("Found members:", stdout);
    return stdout;
  } catch (error) {
    console.error("ldapsearch error:", error.message);
    throw error;
  }
}

async function getLDAPInParallel(username, password, queries) {
  try {
    const promises = queries.map((query) =>
      ldapSearch(username, password, query),
    );
    const results = await Promise.all(promises);
    console.log("All Promises fulfilled");
    return results;
  } catch (error) {
    console.error("Error in parallel search:", error);
    throw error;
  }
}

module.exports = {
  ldapSearch,
  getLDAPInParallel,
  loadSearchByADGroup,
};
