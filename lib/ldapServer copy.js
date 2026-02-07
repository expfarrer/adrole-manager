// mock-ldap-server.js
const ldap = require('ldapjs');

const server = ldap.createServer();

// Heartbeat - log every 20 seconds that server is alive
let connectionCount = 0;
setInterval(() => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [HEARTBEAT] Server is running... (${connectionCount} connections handled)`);
}, 20000);

// Log all connections
server.on('connection', (socket) => {
  connectionCount++;
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [CONNECTION] Client connected from: ${socket.remoteAddress} (Total: ${connectionCount})`);
});

// Valid credentials for authentication
const validCredentials = {
  'jdoe': 'changeme',
  'asmith': 'changeme',
  'bwilson': 'changeme'
};

// Mock user database with AD roles
const mockUsers = {
  'jdoe': {
    dn: 'CN=John Doe,OU=Users,DC=company,DC=com',
    attributes: {
      cn: 'John Doe',
      sn: 'Doe',
      mail: 'jdoe@company.com',
      sAMAccountName: 'jdoe',
      memberOf: [
        'CN=Domain Admins,OU=Groups,DC=company,DC=com',
        'CN=IT Staff,OU=Groups,DC=company,DC=com',
        'CN=VPN Users,OU=Groups,DC=company,DC=com'
      ]
    }
  },
  'asmith': {
    dn: 'CN=Alice Smith,OU=Users,DC=company,DC=com',
    attributes: {
      cn: 'Alice Smith',
      sn: 'Smith',
      mail: 'asmith@company.com',
      sAMAccountName: 'asmith',
      memberOf: [
        'CN=Finance,OU=Groups,DC=company,DC=com',
        'CN=VPN Users,OU=Groups,DC=company,DC=com'
      ]
    }
  },
  'bwilson': {
    dn: 'CN=Bob Wilson,OU=Users,DC=company,DC=com',
    attributes: {
      cn: 'Bob Wilson',
      sn: 'Wilson',
      mail: 'bwilson@company.com',
      sAMAccountName: 'bwilson',
      memberOf: [
        'CN=IT Staff,OU=Groups,DC=company,DC=com',
        'CN=VPN Users,OU=Groups,DC=company,DC=com'
      ]
    }
  }
};

// Mock group database
const mockGroups = {
  'Domain Admins': {
    dn: 'CN=Domain Admins,OU=Groups,DC=company,DC=com',
    attributes: {
      cn: 'Domain Admins',
      objectClass: 'group',
      member: [
        'CN=John Doe,OU=Users,DC=company,DC=com'
      ]
    }
  },
  'IT Staff': {
    dn: 'CN=IT Staff,OU=Groups,DC=company,DC=com',
    attributes: {
      cn: 'IT Staff',
      objectClass: 'group',
      member: [
        'CN=John Doe,OU=Users,DC=company,DC=com',
        'CN=Bob Wilson,OU=Users,DC=company,DC=com'
      ]
    }
  },
  'VPN Users': {
    dn: 'CN=VPN Users,OU=Groups,DC=company,DC=com',
    attributes: {
      cn: 'VPN Users',
      objectClass: 'group',
      member: [
        'CN=John Doe,OU=Users,DC=company,DC=com',
        'CN=Alice Smith,OU=Users,DC=company,DC=com',
        'CN=Bob Wilson,OU=Users,DC=company,DC=com'
      ]
    }
  },
  'Finance': {
    dn: 'CN=Finance,OU=Groups,DC=company,DC=com',
    attributes: {
      cn: 'Finance',
      objectClass: 'group',
      member: [
        'CN=Alice Smith,OU=Users,DC=company,DC=com'
      ]
    }
  }
};

// Authenticated bind with credential validation
server.bind('CN=*', (req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  const dn = req.dn.toString();
  const username = dn.match(/CN=([^,]+)/)?.[1];
  const password = req.credentials;
  
  console.log(`[${timestamp}] [BIND] Authentication attempt for: ${username}`);
  
  // Check if user exists and password matches
  if (validCredentials[username] && validCredentials[username] === password) {
    console.log(`[${timestamp}] [BIND] ✓ Authentication successful for: ${username}`);
    res.end();
    return next();
  } else {
    console.log(`[${timestamp}] [BIND] ✗ Authentication failed for: ${username}`);
    return next(new ldap.InvalidCredentialsError());
  }
});

// Search handler
server.search('DC=company,DC=com', (req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [SEARCH] Request: ${req.filter.toString()}`);
  
  const filterStr = req.filter.toString();
  
  // Check for user search (sAMAccountName)
  const usernameMatch = filterStr.match(/sAMAccountName=([^)]+)/);
  if (usernameMatch) {
    const username = usernameMatch[1];
    const user = mockUsers[username];
    
    if (user) {
      console.log(`[${timestamp}] [SEARCH] ✓ Found user: ${username} with ${user.attributes.memberOf.length} groups`);
      res.send({
        dn: user.dn,
        attributes: user.attributes
      });
    } else {
      console.log(`[${timestamp}] [SEARCH] ✗ User not found: ${username}`);
    }
  }
  
  // Check for group search (objectClass=group and cn=groupname)
  const groupMatch = filterStr.match(/cn=([^)]+)/);
  const isGroupSearch = filterStr.includes('objectClass=group');
  
  if (isGroupSearch && groupMatch) {
    const groupName = groupMatch[1];
    const group = mockGroups[groupName];
    
    if (group) {
      console.log(`[${timestamp}] [SEARCH] ✓ Found group: ${groupName} with ${group.attributes.member.length} members`);
      res.send({
        dn: group.dn,
        attributes: group.attributes
      });
    } else {
      console.log(`[${timestamp}] [SEARCH] ✗ Group not found: ${groupName}`);
    }
  }
  
  res.end();
  return next();
});

// Start server
server.listen(3389, '127.0.0.1', (err) => {
  if (err) {
    console.error('[ERROR] Failed to start server:', err);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('▶ Mock LDAP Server Started Successfully');
  console.log('='.repeat(70));
  console.log('◉ Listening on: ldap://127.0.0.1:3389');
  console.log('◉ Base DN: DC=company,DC=com');
  console.log('◉ Authentication: REQUIRED (password: changeme for all users)');
  console.log('-'.repeat(70));
  console.log('● Available Test Users:');
  console.log('   • jdoe (John Doe) - Domain Admins, IT Staff, VPN Users');
  console.log('   • asmith (Alice Smith) - Finance, VPN Users');
  console.log('   • bwilson (Bob Wilson) - IT Staff, VPN Users');
  console.log('-'.repeat(70));
  console.log('● Available Test Groups:');
  console.log('   • Domain Admins - 1 member');
  console.log('   • IT Staff - 2 members');
  console.log('   • VPN Users - 3 members');
  console.log('   • Finance - 1 member');
  console.log('='.repeat(70));
  console.log('✓ Server ready to accept connections');
  console.log('♥ Heartbeat every 20 seconds\n');
});

// Error handling
server.on('error', (err) => {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`[${timestamp}] [ERROR] Server error:`, err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n▼ Shutting down gracefully...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n\n▼ Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✓ Server closed');
    process.exit(0);
  });
});