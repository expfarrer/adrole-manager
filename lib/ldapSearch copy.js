const ldap = require('ldapjs');

const ldapSearch = async (user, password, sso) => {
  console.log(`Searching for user: ${sso}`);
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: 'ldap://127.0.0.1:3389'
    });

    client.on('error', (err) => {
      console.error('Client error:', err);
      reject(err);
    });

    // Bind with credentials first
    const bindDN = `CN=${user},OU=Users,DC=company,DC=com`;
    console.log(`Authenticating as: ${bindDN}`);
    
    client.bind(bindDN, password, (err) => {
      if (err) {
        console.error('Authentication failed:', err.message);
        client.unbind();
        return reject(new Error('Authentication failed. Check your username and password.'));
      }

      console.log('✓ Authentication successful');

      const opts = {
        filter: `(sAMAccountName=${sso})`,
        scope: 'sub',
        attributes: ['memberOf']
      };

      console.log('Searching with filter:', opts.filter);

      client.search('DC=company,DC=com', opts, (err, res) => {
        if (err) {
          console.error('Search error:', err);
          client.unbind();
          return reject(err);
        }

        let groups = [];
        
        res.on('searchEntry', (entry) => {
          console.log('Found entry:', entry.objectName);
          
          const memberOf = entry.attributes.find(attr => attr.type === 'memberOf');
          if (memberOf && memberOf.values) {
            groups = memberOf.values.map(dn => {
              const match = dn.match(/CN=([^,]+)/);
              return match ? `CN=${match[1]}` : dn;
            });
            console.log('Found groups:', groups);
          }
        });

        res.on('end', () => {
          console.log('Search completed. Total groups found:', groups.length);
          client.unbind();
          resolve(groups.join('\n'));
        });

        res.on('error', (err) => {
          console.error('Response error:', err);
          client.unbind();
          reject(err);
        });
      });
    });
  });
};

async function loadSearchByADGroup(user, password, group) {
  console.log(`Searching for group: ${group}`);
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: 'ldap://127.0.0.1:3389'
    });

    // Bind with credentials first
    const bindDN = `CN=${user},OU=Users,DC=company,DC=com`;
    
    client.bind(bindDN, password, (err) => {
      if (err) {
        console.error('Authentication failed:', err.message);
        client.unbind();
        return reject(new Error('Authentication failed. Check your username and password.'));
      }

      const opts = {
        filter: `(&(objectClass=group)(cn=${group}))`,
        scope: 'sub',
        attributes: ['member']
      };

      client.search('DC=company,DC=com', opts, (err, res) => {
        if (err) {
          client.unbind();
          return reject(err);
        }

        let members = [];
        
        res.on('searchEntry', (entry) => {
          console.log('Found group entry:', entry.objectName);
          const memberAttr = entry.attributes.find(attr => attr.type === 'member');
          if (memberAttr && memberAttr.values) {
            members = memberAttr.values.map(dn => {
              const match = dn.match(/CN=([^,]+)/);
              return match ? `CN=${match[1]}` : dn;
            });
            console.log('Found members:', members);
          }
        });

        res.on('end', () => {
          client.unbind();
          resolve(members.join('\n'));
        });

        res.on('error', (err) => {
          client.unbind();
          reject(err);
        });
      });
    });
  });
}

async function getLDAPInParallel(username, password, queries) {
  try {
    const promises = queries.map(query => ldapSearch(username, password, query));
    const results = await Promise.all(promises);
    console.log('All Promises fulfilled');
    return results;
  } catch (error) {
    console.error('Error in parallel search:', error);
    throw error;
  }
}

module.exports = {
  ldapSearch,
  getLDAPInParallel,
  loadSearchByADGroup
};