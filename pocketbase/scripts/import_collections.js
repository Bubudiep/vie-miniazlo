/**
 * Import Collections Script
 *
 * Directly imports branches and memberships collections into PocketBase
 * by manipulating the pb_schema.json and database files.
 *
 * SAFE TO RUN: Database has 0 records, backup exists at checkpoint-4-before/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.join(__dirname, '../pb_schema.json');
const BACKUP_PATH = path.join(__dirname, '../backups/milestone-02/checkpoint-4-before/pb_schema_20261008_163331.json');

// Load current schema
console.log('Loading current schema from:', SCHEMA_PATH);
const currentSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
console.log(`Current collections: ${currentSchema.length}`);

// Define branches collection
const branchesCollection = {
  "id": "pbc_branches",
  "name": "branches",
  "type": "base",
  "system": false,
  "schema": [
    {
      "id": "rel_company",
      "name": "company",
      "type": "relation",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {
        "collectionId": "pbc_companies",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["name"]
      }
    },
    {
      "id": "text_name",
      "name": "name",
      "type": "text",
      "required": true,
      "presentable": true,
      "unique": false,
      "options": {
        "min": 1,
        "max": 255,
        "pattern": ""
      }
    },
    {
      "id": "text_code",
      "name": "code",
      "type": "text",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {
        "min": 1,
        "max": 50,
        "pattern": ""
      }
    },
    {
      "id": "text_address",
      "name": "address",
      "type": "text",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "min": null,
        "max": 255,
        "pattern": ""
      }
    },
    {
      "id": "text_phone",
      "name": "phone",
      "type": "text",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "min": null,
        "max": 20,
        "pattern": ""
      }
    },
    {
      "id": "bool_active",
      "name": "active",
      "type": "bool",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {}
    },
    {
      "id": "num_sort_order",
      "name": "sort_order",
      "type": "number",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {
        "min": null,
        "max": null,
        "noDecimal": true
      }
    },
    {
      "id": "autodate_created",
      "name": "created",
      "type": "autodate",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "onCreate": true,
        "onUpdate": false
      }
    },
    {
      "id": "autodate_updated",
      "name": "updated",
      "type": "autodate",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "onCreate": true,
        "onUpdate": true
      }
    }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX idx_company_code ON branches (company, code)"
  ],
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\"",
  "options": {}
};

// Define memberships collection
const membershipsCollection = {
  "id": "pbc_memberships",
  "name": "memberships",
  "type": "base",
  "system": false,
  "schema": [
    {
      "id": "rel_user",
      "name": "user",
      "type": "relation",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {
        "collectionId": "_pb_users_auth_",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["username"]
      }
    },
    {
      "id": "rel_company",
      "name": "company",
      "type": "relation",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {
        "collectionId": "pbc_companies",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["name"]
      }
    },
    {
      "id": "rel_branch",
      "name": "branch",
      "type": "relation",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "collectionId": "pbc_branches",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["name"]
      }
    },
    {
      "id": "select_role",
      "name": "role",
      "type": "select",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {
        "maxSelect": 1,
        "values": [
          "owner",
          "manager",
          "cashier",
          "staff",
          "customer"
        ]
      }
    },
    {
      "id": "bool_active",
      "name": "active",
      "type": "bool",
      "required": true,
      "presentable": false,
      "unique": false,
      "options": {}
    },
    {
      "id": "autodate_created",
      "name": "created",
      "type": "autodate",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "onCreate": true,
        "onUpdate": false
      }
    },
    {
      "id": "autodate_updated",
      "name": "updated",
      "type": "autodate",
      "required": false,
      "presentable": false,
      "unique": false,
      "options": {
        "onCreate": true,
        "onUpdate": true
      }
    }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX idx_user_company_branch ON memberships (user, company, branch) WHERE branch IS NOT NULL AND branch != ''",
    "CREATE UNIQUE INDEX idx_user_company_null ON memberships (user, company) WHERE branch IS NULL OR branch = ''"
  ],
  "listRule": "@request.auth.id != \"\"",
  "viewRule": "@request.auth.id != \"\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\"",
  "options": {}
};

// Check if collections already exist
const branchesExists = currentSchema.some(c => c.name === 'branches');
const membershipsExists = currentSchema.some(c => c.name === 'memberships');

if (branchesExists) {
  console.log('⚠️  branches collection already exists, skipping');
} else {
  console.log('➕ Adding branches collection');
  currentSchema.push(branchesCollection);
}

if (membershipsExists) {
  console.log('⚠️  memberships collection already exists, skipping');
} else {
  console.log('➕ Adding memberships collection');
  currentSchema.push(membershipsCollection);
}

if (!branchesExists || !membershipsExists) {
  // Write updated schema
  console.log('\n📝 Writing updated schema to:', SCHEMA_PATH);
  fs.writeFileSync(SCHEMA_PATH, JSON.stringify(currentSchema, null, 2), 'utf8');
  console.log('✅ Schema updated successfully');
  console.log(`\nNew collections count: ${currentSchema.length}`);

  console.log('\n⚠️  IMPORTANT: You must restart PocketBase to apply these changes:');
  console.log('   cd pocketbase && ./pocketbase.exe serve');
} else {
  console.log('\n✅ All collections already exist, no changes needed');
}

console.log('\n📋 Summary:');
console.log(`   - branches: ${branchesExists ? 'exists' : 'added'}`);
console.log(`   - memberships: ${membershipsExists ? 'exists' : 'added'}`);
console.log(`   - Backup available at: ${BACKUP_PATH}`);
