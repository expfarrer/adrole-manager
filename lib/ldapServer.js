// ldapServer.js
const ldap = require('ldapjs');

const server = ldap.createServer();

// ANSI color codes - various shades of blue
const colors = {
  brightBlue: '\x1b[94m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  brightCyan: '\x1b[96m',
  reset: '\x1b[0m'
};

// Heartbeat - log every 20 seconds that server is alive
let connectionCount = 0;
setInterval(() => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `${colors.cyan}[${timestamp}] [HEARTBEAT] Server is running... (${connectionCount} connections handled)${colors.reset}`
  );
}, 20000);

// Log all connections
server.on('connection', (socket) => {
  connectionCount++;
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `${colors.brightCyan}[${timestamp}] [CONNECTION] Client connected from: ${socket.remoteAddress} (Total: ${connectionCount})${colors.reset}`
  );
});

// Valid credentials for authentication
const validCredentials = {
  jdoe: 'changeme',
  asmith: 'changeme',
  bwilson: 'changeme',
  'John Doe': 'changeme',
  'Alice Smith': 'changeme',
  'Bob Wilson': 'changeme'
};

// Mock user database with AD roles
const mockUsers = {
  jdoe: {
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
  asmith: {
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
  bwilson: {
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
      member: ['CN=John Doe,OU=Users,DC=company,DC=com']
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
  Finance: {
    dn: 'CN=Finance,OU=Groups,DC=company,DC=com',
    attributes: {
      cn: 'Finance',
      objectClass: 'group',
      member: ['CN=Alice Smith,OU=Users,DC=company,DC=com']
    }
  }
};

// Anonymous bind (empty string catches anonymous)
server.bind('', (req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.brightBlue}[${timestamp}] [BIND] ✓ Anonymous bind successful${colors.reset}`);
  res.end();
  return next();
});

// Catch all other bind attempts with proper DN patterns
server.bind('DC=company,DC=com', (req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  const dn = req.dn.toString();
  const password = req.credentials;

  console.log(`${colors.blue}[${timestamp}] [BIND] Bind attempt for DN: ${dn}${colors.reset}`);
  console.log(`${colors.blue}[${timestamp}] [BIND] Password provided: ${password ? '****' : '(none)'}${colors.reset}`);

  // Extract username from DN
  const usernameMatch = dn.match(/CN=([^,]+)/);
  if (!usernameMatch) {
    console.log(`${colors.blue}[${timestamp}] [BIND] ✗ Could not extract username from DN${colors.reset}`);
    return next(new ldap.InvalidCredentialsError());
  }

  const username = usernameMatch[1];
  console.log(`${colors.blue}[${timestamp}] [BIND] Extracted username: ${username}${colors.reset}`);

  // Check if user exists and password matches
  if (validCredentials[username] && validCredentials[username] === password) {
    console.log(`${colors.brightBlue}[${timestamp}] [BIND] ✓ Authentication successful for: ${username}${colors.reset}`);
    res.end();
    return next();
  }

  console.log(`${colors.blue}[${timestamp}] [BIND] ✗ Authentication failed for: ${username}${colors.reset}`);
  console.log(
    `${colors.blue}[${timestamp}] [BIND] Expected password for ${username}: ${validCredentials[username] || '(user not found)'}${colors.reset}`
  );
  return next(new ldap.InvalidCredentialsError());
});

// Case-insensitive attribute getter
function getAttrCaseInsensitive(attrs, requestedName) {
  const target = String(requestedName).toLowerCase();
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === target) return { key, value: attrs[key] };
  }
  return null;
}

// Search handler - Send ONE entry with ALL attributes
server.search('DC=company,DC=com', (req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.cyan}[${timestamp}] [SEARCH] Request: ${req.filter.toString()}${colors.reset}`);
  console.log(`${colors.cyan}[${timestamp}] [SEARCH] Requested attributes: ${req.attributes.join(', ')}${colors.reset}`);

  const filterStr = req.filter.toString();

  const buildEntry = (dn, attrs) => {
    const entry = { dn, attributes: {} };

    // If ldapsearch requests ["memberOf"], ldapjs may hand it over as ["memberof"]
    // Also handle "*" and "+" selectors.
    const requested =
      req.attributes && req.attributes.length > 0
        ? req.attributes.filter((a) => a !== '*' && a !== '+')
        : Object.keys(attrs);

    requested.forEach((attrName) => {
      const found = getAttrCaseInsensitive(attrs, attrName);
      if (!found) return;

      entry.attributes[found.key] = found.value;
      const count = Array.isArray(found.value) ? found.value.length : 1;
      console.log(`${colors.cyan}[${timestamp}] [SEARCH] Including ${found.key}: ${count} value(s)${colors.reset}`);
    });

    return entry;
  };

  // Check for user search (sAMAccountName)
  const usernameMatch = filterStr.match(/sAMAccountName=([^)]+)/);
  if (usernameMatch) {
    const username = usernameMatch[1];
    const user = mockUsers[username];

    if (user) {
      console.log(`${colors.brightCyan}[${timestamp}] [SEARCH] ✓ Found user: ${username}${colors.reset}`);
      const entry = buildEntry(user.dn, user.attributes);
      res.send(entry);
      console.log(
        `${colors.cyan}[${timestamp}] [SEARCH] Sent entry with ${Object.keys(entry.attributes).length} attribute(s)${colors.reset}`
      );
    } else {
      console.log(`${colors.cyan}[${timestamp}] [SEARCH] ✗ User not found: ${username}${colors.reset}`);
    }

    res.end();
    return next();
  }

  // Check for group search (objectClass=group and cn=groupname)
  const groupMatch = filterStr.match(/cn=([^)]+)/);
  const isGroupSearch = filterStr.includes('objectClass=group');

  if (isGroupSearch && groupMatch) {
    const groupName = groupMatch[1];
    const group = mockGroups[groupName];

    if (group) {
      console.log(`${colors.brightCyan}[${timestamp}] [SEARCH] ✓ Found group: ${groupName}${colors.reset}`);
      const entry = buildEntry(group.dn, group.attributes);
      res.send(entry);
    } else {
      console.log(`${colors.cyan}[${timestamp}] [SEARCH] ✗ Group not found: ${groupName}${colors.reset}`);
    }

    res.end();
    return next();
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

  console.log('\n' + colors.brightBlue + '='.repeat(70));
  console.log('🚀 Mock LDAP Server Started Successfully');
  console.log('='.repeat(70) + colors.reset);
  console.log(colors.cyan + '📍 Listening on: ldap://127.0.0.1:3389' + colors.reset);
  console.log(colors.cyan + '📊 Base DN: DC=company,DC=com' + colors.reset);
  console.log(colors.cyan + '🔐 Authentication: REQUIRED (password: changeme for all users)' + colors.reset);
  console.log(colors.blue + '-'.repeat(70) + colors.reset);
  console.log(colors.brightCyan + '👥 Available Test Users:' + colors.reset);
  console.log(colors.cyan + '   • jdoe (John Doe) - Domain Admins, IT Staff, VPN Users' + colors.reset);
  console.log(colors.cyan + '   • asmith (Alice Smith) - Finance, VPN Users' + colors.reset);
  console.log(colors.cyan + '   • bwilson (Bob Wilson) - IT Staff, VPN Users' + colors.reset);
  console.log(colors.blue + '-'.repeat(70) + colors.reset);
  console.log(colors.brightCyan + '👨‍👩‍👧‍👦 Available Test Groups:' + colors.reset);
  console.log(colors.cyan + '   • Domain Admins - 1 member' + colors.reset);
  console.log(colors.cyan + '   • IT Staff - 2 members' + colors.reset);
  console.log(colors.cyan + '   • VPN Users - 3 members' + colors.reset);
  console.log(colors.cyan + '   • Finance - 1 member' + colors.reset);
  console.log(colors.brightBlue + '='.repeat(70) + colors.reset);
  console.log(colors.brightBlue + '💚 Server ready to accept connections' + colors.reset);
  console.log(colors.brightBlue + '❤️  Heartbeat every 20 seconds\n' + colors.reset);
});

// Error handling
server.on('error', (err) => {
  const timestamp = new Date().toLocaleTimeString();
  console.error(`${colors.blue}[${timestamp}] [ERROR] Server error:${colors.reset}`, err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n${colors.cyan}👋 Shutting down gracefully...${colors.reset}`);
  server.close(() => {
    console.log(`${colors.brightBlue}✅ Server closed${colors.reset}`);
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log(`\n\n${colors.cyan}👋 Received SIGTERM, shutting down...${colors.reset}`);
  server.close(() => {
    console.log(`${colors.brightBlue}✅ Server closed${colors.reset}`);
    process.exit(0);
  });
});
