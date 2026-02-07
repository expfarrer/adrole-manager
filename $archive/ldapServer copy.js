// mock-ldap-server.js
const ldap = require('ldapjs');

const server = ldap.createServer();

// Mock user database with AD roles
const mockUsers = {
  'jdoe': {
    dn: 'CN=John Doe,OU=Users,DC=ameriprise,DC=com',
    attributes: {
      cn: 'John Doe',
      sn: 'Doe',
      mail: 'jdoe@ameriprise.com',
      password:'changeme',
      sAMAccountName: 'jdoe',
      memberOf: [
        'CN=Domain Admins,OU=Groups,DC=ameriprise,DC=com',
        'CN=IT Staff,OU=Groups,DC=ameriprise,DC=com',
        'CN=VPN Users,OU=Groups,DC=ameriprise,DC=com'
      ]
    }
  },
  'asmith': {
    dn: 'CN=Alice Smith,OU=Users,DC=ameriprise,DC=com',
    attributes: {
      cn: 'Alice Smith',
      sn: 'Smith',
      mail: 'asmith@ameriprise.com',
      password:'changeme',
      sAMAccountName: 'asmith',
      memberOf: [
        'CN=Finance,OU=Groups,DC=ameriprise,DC=com',
        'CN=VPN Users,OU=Groups,DC=ameriprise,DC=com'
      ]
    }
  }
};

// Anonymous bind
server.bind('', (req, res, next) => {
  res.end();
  return next();
});

// Authenticated bind
server.bind('CN=*', (req, res, next) => {
  const username = req.dn.toString().match(/CN=([^,]+)/)?.[1];
  console.log(`Bind attempt for: ${username}`);
  res.end();
  return next();
});

// Search handler
server.search('DC=ameriprise,DC=com', (req, res, next) => {
  console.log(`Search request: ${req.filter.toString()}`);
  
  // Parse the filter to get the SSO/username
  const filterStr = req.filter.toString();
  const usernameMatch = filterStr.match(/sAMAccountName=([^)]+)/);
  
  if (usernameMatch) {
    const username = usernameMatch[1];
    const user = mockUsers[username];
    
    if (user) {
      console.log(`Found user: ${username}`);
      res.send({
        dn: user.dn,
        attributes: user.attributes
      });
    } else {
      console.log(`User not found: ${username}`);
    }
  }
  
  res.end();
  return next();
});

server.listen(1389, () => {
  console.log('Mock LDAP server listening on ldap://localhost:1389');
  console.log('Available test users: jdoe, asmith');
});