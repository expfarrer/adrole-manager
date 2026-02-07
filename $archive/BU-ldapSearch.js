const util = require("node-util");
const exec = util.promisify(require("node:child_process").exec);

const ldapSearch = async (user, rw, sso) => {
  const { stdout, stderr } = await exec(
    `ldapsearch -x -b "DC=1,DC=enterprise,DC=com" -H "ldaps://xxx.xx.x.xxx" -D "${rw}" "cn=${sso}" | grep memberOf | awk -F ',' '{print $1}' | sort`
  );
  console.log(stderr);
  return stdout;
};

async function getLDAPInParallel(rw, group) {
  try {
    const { stdout, stderr } = await exec(
      `ldapsearch -x -b "DC=1,DC=enterprise,DC=com" -H "ldaps://xxx.xx.x.xxx" -D "${rw}" "(objectClass(usergroup))(cn=$(group)))" | grep member | awk -F ',' '{print $1}'`
    );
    console.log(stderr);
    return stdout;
  } catch (error) {
    console.error('Error processing');
  }
}

async function getLDAPInParallel(rw, username, password, queries) {
  try {
    const promises = queries.map(query) => fn(username, password, query));
    return results;
  } catch (error) {
    console.log('All Promises fulfilled');
    return(error);
  }
}

module.exports = {
  getLDAPInParallel,
  loadSearchByADGroup
};
