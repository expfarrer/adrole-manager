#!/usr/bin/env node
const { listFeatures } = require("../lib/featureLoader");

console.log("\n📦 Available Features:\n");
console.log("═".repeat(80));

const features = listFeatures();
features.forEach((feature) => {
  const status = feature.enabled ? "✅ Enabled" : "❌ Disabled";
  console.log(`\n${status} - ${feature.name} (v${feature.version || "1.0.0"})`);
  console.log(`   ${feature.description || "No description"}`);
  if (feature.commands && feature.commands.length > 0) {
    console.log(`   Commands: ${feature.commands.join(", ")}`);
  }
});

console.log("\n" + "═".repeat(80));
console.log("\n💡 Enable/disable features in config/features.json\n");
console.log('💡 Run "yarn commands" to see usage examples\n');
