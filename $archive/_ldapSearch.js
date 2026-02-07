const util = require("node-util");
const exec = util.promisify(require("node:child_process").exec);

const ldapSearch = async (user, pw, sso) => {
  const { stdout, stderr } = await exec(
    `ldapsearch -x -b "DC=1,DC=enterprise,DC=com" -H "ldaps://xxx.xx.x.xxx" -D "${sso}@1.enterprise.com" -w "${pw}" "(print $1)" | sort | sort -u`,
    {stdio: logStderr});
  return stdout;
};

const ldapSearchByADGroup = async (user, pw, group) => {
  const { stdout, stderr } = await exec(
    `ldapsearch -x -b "DC=1,DC=enterprise,DC=com" -H "ldaps://xxx.xx.x.xxx" -D "${user}@1.enterprise.com" -w "${pw}" "(&(objectClass=group)(cn=${group}))" member | awk -F ":" '{print $1}' | grep | sort -u`,
  );
  return stdout;
};

async function getLDAPParallel(fn, username, password, queries) {
  try {
    const promises = queries.map(query => fn(username, password, query));
    const results = await Promise.allSettled(promises);
    return results;
  } catch(error) {
    console.log("Error processing:", error);
  }
}

module.exports = {
  ldapSearch,
  getLDAPParallel,
  ldapSearchByADGroup
}
