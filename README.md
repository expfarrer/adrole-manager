# AD Role Manager

A command-line tool for comparing Active Directory group memberships between users. Quickly identify which roles/groups are unique to each user and which are shared.

## Features

- 🔍 Query LDAP/Active Directory for user group memberships
- 📊 Compare roles between 2+ users
- 🎯 Identify unique vs shared group memberships
- 🐳 Local LDAP server for development/testing
- 🔐 Secure credential prompts (passwords not shown)

## Prerequisites

- Node.js 18+ (tested with v25.2.1)
- Yarn package manager
- ldapsearch command-line tool (comes with OpenLDAP)
- Docker Desktop (for local testing only)

### Installing OpenLDAP tools

**macOS:**

```bash
brew install openldap
```

**Ubuntu/Debian:**

```bash
sudo apt-get install ldap-utils
```

**Windows:**
Download from: https://www.openldap.org/

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd adrole-manager

# Install dependencies
yarn install
```

## Local Development Setup

For testing without connecting to production Active Directory, you can run a local OpenLDAP server with test data.

### 1. Start Local LDAP Server

```bash
# Create directory for test data
mkdir -p ldap-data

# The users.ldif file should already be in ldap-data/
# If not, create it with test user data (see ldap-data/users.ldif)

# Start OpenLDAP container
docker run -d \
  --name test-ldap \
  -p 389:389 \
  -p 636:636 \
  -v $(pwd)/ldap-data:/container/service/slapd/assets/test \
  -e LDAP_ORGANISATION="Test Company" \
  -e LDAP_DOMAIN="company.com" \
  -e LDAP_ADMIN_PASSWORD="admin" \
  -e LDAP_CONFIG_PASSWORD="config" \
  osixia/openldap:1.5.0

# Wait for server to start
sleep 10

# Enable memberOf overlay (allows reverse group lookups)
docker exec test-ldap bash -c 'cat > /tmp/memberof.ldif << "MEMBEROF"
dn: olcOverlay=memberof,olcDatabase={1}mdb,cn=config
objectClass: olcOverlayConfig
objectClass: olcMemberOf
olcOverlay: memberof
olcMemberOfRefint: TRUE
olcMemberOfDangling: ignore
olcMemberOfGroupOC: groupOfNames
olcMemberOfMemberAD: member
olcMemberOfMemberOfAD: memberOf
MEMBEROF'

docker exec test-ldap ldapadd -Y EXTERNAL -H ldapi:/// -f /tmp/memberof.ldif

# Load test users and groups
docker exec test-ldap ldapadd -x -D "cn=admin,dc=company,dc=com" -w admin -f /container/service/slapd/assets/test/users.ldif
```

### 2. Test LDAP Connection

```bash
ldapsearch -x -b "dc=company,dc=com" -H "ldap://localhost:389" \
  -D "cn=admin,dc=company,dc=com" -w "admin" "(uid=jdoe)" memberOf
```

You should see John Doe's user entry with memberOf attributes.

### 3. Test Users Available

| Username  | Password | Role Count | Description            |
| --------- | -------- | ---------- | ---------------------- |
| jdoe      | changeme | 35 roles   | DevOps Engineer        |
| asmith    | changeme | 28 roles   | Database Administrator |
| bwilson   | changeme | 22 roles   | Senior Developer       |
| cmartinez | changeme | 18 roles   | Finance Analyst        |
| dchen     | changeme | 42 roles   | Security Engineer      |
| ejohnson  | changeme | 13 roles   | Regular Employee       |

## Usage

### Compare Two Users

```bash
yarn get-ad-groups jdoe asmith
```

**Prompts:**

- Enter your SSO: `jdoe` (any valid username)
- Enter password: `changeme`

**Output:**

```
Searching for user: jdoe
Found groups: cn=AP-AWS-Admin, cn=AP-Kubernetes-Admin, ...

Searching for user: asmith
Found groups: cn=AP-Database-Admin, cn=AP-Oracle-Reporting, ...

=== Comparison Results ===
jdoe unique: AP-AWS-Admin, AP-Kubernetes-Admin, ...
asmith unique: AP-Database-Admin, AP-Oracle-Reporting, ...
Shared: AP-VPN-Access, AP-SSO-User, ...
```

### Compare Multiple Users (3+)

```bash
yarn get-ad-groups jdoe asmith bwilson cmartinez
```

Shows a table view with all users and their groups.

### View Single User's Groups

```bash
yarn get-ad-groups jdoe
```

Simply displays all groups for that user.

### Search for Group Members

```bash
yarn run search-ad-group "AP-AWS-Admin"
```

Shows all users who are members of the specified group.

## Configuration

### Connecting to Production Active Directory

Edit `lib/ldapSearch.js` and update these values:

```javascript
const ldapSearch = async (user, password, sso) => {
  // Change these for your production AD server
  const bindDN = `CN=${user},OU=Users,DC=yourcompany,DC=com`;
  const bindPassword = password; // Use actual user password instead of admin
  const ldapUrl = "ldap://your-ad-server.company.com:389";
  const baseDN = "DC=yourcompany,DC=com";
  const searchFilter = `(sAMAccountName=${sso})`; // or (uid=${sso})

  // ... rest of code
};
```

**Common AD Configurations:**

| Setting         | Active Directory                         | OpenLDAP (Test)                          |
| --------------- | ---------------------------------------- | ---------------------------------------- |
| Port            | 389 (or 636 for LDAPS)                   | 389                                      |
| Base DN         | `DC=company,DC=com`                      | `dc=company,dc=com`                      |
| User DN         | `CN=John Doe,OU=Users,DC=company,DC=com` | `cn=John Doe,ou=Users,dc=company,dc=com` |
| User Filter     | `(sAMAccountName=jdoe)`                  | `(uid=jdoe)`                             |
| Group Attribute | `memberOf`                               | `memberOf`                               |

## Docker Commands

```bash
# Start LDAP server
docker start test-ldap

# Stop LDAP server
docker stop test-ldap

# Restart LDAP server
docker restart test-ldap

# View logs
docker logs test-ldap

# Check if running
docker ps

# Remove completely
docker stop test-ldap
docker rm test-ldap
```

## Project Structure

```
adrole-manager/
├── bin/
│   ├── compareGroups.js       # Main comparison CLI tool
│   └── searchADGroup.js        # Group member search tool
├── lib/
│   ├── ldapSearch.js          # LDAP query functions
│   └── listCompare.js         # Group comparison logic
├── ldap-data/
│   └── users.ldif             # Test user data for local LDAP
├── package.json
└── README.md
```

## Troubleshooting

### "Can't contact LDAP server"

**Solution:**

- Ensure Docker is running: `docker ps`
- Restart container: `docker restart test-ldap`
- Check port is not in use: `lsof -i :389`

### No groups returned (empty results)

**Solution:**

- Verify data is loaded: `ldapsearch -x -b "dc=company,dc=com" -H "ldap://localhost:389" -D "cn=admin,dc=company,dc=com" -w "admin" "(uid=jdoe)"`
- Ensure memberOf overlay is enabled (see setup steps)
- Rebuild container if needed (see Docker commands)

### "Command not found: ldapsearch"

**Solution:**

- Install OpenLDAP tools (see Prerequisites)
- macOS: `brew install openldap`

### TypeError: Cannot read properties of undefined

**Solution:**

- Make sure you're using the latest version of `bin/compareGroups.js`
- The issue was fixed to handle both uppercase `CN=` and lowercase `cn=`

## Adding More Test Users/Groups

Edit `ldap-data/users.ldif`:

```ldif
# Add a new user
dn: cn=Jane Smith,ou=Users,dc=company,dc=com
objectClass: inetOrgPerson
cn: Jane Smith
sn: Smith
uid: jsmith
mail: jsmith@company.com
userPassword: changeme

# Add a new group
dn: cn=AP-NewRole-Admin,ou=Groups,dc=company,dc=com
objectClass: groupOfNames
cn: AP-NewRole-Admin
member: cn=Jane Smith,ou=Users,dc=company,dc=com
```

Then rebuild the container:

```bash
docker stop test-ldap
docker rm test-ldap
# Run the full setup again (see Local Development Setup)
```

## Available Scripts

```bash
# Compare AD groups between users
yarn get-ad-groups <user1> [user2] [user3] ...

# Search for members of a specific group
yarn run search-ad-group "<group-name>"
```

## License

MIT license specified.

## Contributing

Contributions are welcome! Please ensure:

- Test with local LDAP server before submitting
- Follow existing code style
- Update README if adding new features

## Author

Tobias Conio
conio.tobias@gmail.com

## Support

For issues or questions, please create an issue in the GitHub repository.
