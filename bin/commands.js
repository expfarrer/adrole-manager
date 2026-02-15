#!/usr/bin/env node

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                          AD Role Manager - Commands                          ║
╚══════════════════════════════════════════════════════════════════════════════╝

📋 Available Commands:


  yarn get-ad-groups <user1> <user2> <user3> ...
    Compare AD group memberships between users (max 5)
    Example: yarn get-ad-groups jdoe asmith

  yarn team-summary <user1> <user2> <user3> ...
    Generate team access summary report with statistics
    Example: yarn team-summary jdoe asmith bwilson

  yarn get-ad-group-members <group-name>
    Find all members of a specific AD group
    Example: yarn get-ad-group-members "AP-AWS-Admin"

  yarn features
    List all available features and their status

  yarn commands
    Show this commands list


💡 Examples:

  # Compare two users
  yarn get-ad-groups jdoe asmith

  # Analyze entire team
  yarn team-summary jdoe asmith bwilson cmartinez dchen

  # Find who has admin access
  yarn get-ad-group-members "AP-AWS-Admin"

  # List features
  yarn features

`);
