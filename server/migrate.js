#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes SQL migrations in order
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Database configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER || 'campusverify'}:${process.env.DB_PASSWORD || 'secret123'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'campusverify'}`
});

// Migration tracking table
const MIGRATIONS_TABLE = `
    CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
    );
`;

async function getExecutedMigrations() {
    const result = await pool.query('SELECT name FROM _migrations ORDER BY id');
    return result.rows.map(row => row.name);
}

async function markMigrationExecuted(name) {
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
}

async function getMigrationFiles() {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found');
        return [];
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    return files.map(file => ({
        name: file,
        path: path.join(migrationsDir, file)
    }));
}

async function runMigrations() {
    const client = await pool.connect();

    try {
        console.log('🗄️  Starting database migrations...\n');

        // Create migrations tracking table
        await client.query(MIGRATIONS_TABLE);

        const executed = await getExecutedMigrations();
        const migrations = await getMigrationFiles();
        const pending = migrations.filter(m => !executed.includes(m.name));

        if (pending.length === 0) {
            console.log('✅ No pending migrations\n');
            return;
        }

        console.log(`📋 Found ${pending.length} pending migration(s)\n`);

        for (const migration of pending) {
            console.log(`⏳ Running: ${migration.name}`);

            const sql = fs.readFileSync(migration.path, 'utf8');

            await client.query('BEGIN');

            try {
                await client.query(sql);
                await markMigrationExecuted(migration.name);
                await client.query('COMMIT');
                console.log(`   ✅ Complete\n`);
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`   ❌ Failed: ${error.message}\n`);
                throw error;
            }
        }

        console.log('🎉 All migrations complete!\n');

    } finally {
        client.release();
        await pool.end();
    }
}

async function rollbackMigration() {
    console.log('🔙 Rollback not implemented - please restore from backup\n');
}

async function resetDatabase() {
    const client = await pool.connect();

    try {
        console.log('⚠️  Resetting database...\n');

        // Drop all tables
        await client.query(`
            DROP SCHEMA public CASCADE;
            CREATE SCHEMA public;
            GRANT ALL ON SCHEMA public TO public;
        `);

        console.log('✅ Database reset complete\n');

        // Re-run migrations
        await runMigrations();

    } finally {
        client.release();
        await pool.end();
    }
}

// CLI
const command = process.argv[2];

switch (command) {
    case 'migrate':
    case 'up':
        runMigrations().catch(console.error);
        break;
    case 'rollback':
    case 'down':
        rollbackMigration().catch(console.error);
        break;
    case 'reset':
        resetDatabase().catch(console.error);
        break;
    case 'status':
        pool.connect()
            .then(async client => {
                await client.query(MIGRATIONS_TABLE);
                const result = await client.query('SELECT * FROM _migrations ORDER BY id');
                console.log('Executed migrations:');
                result.rows.forEach(row => {
                    console.log(`  - ${row.name} (${row.executed_at})`);
                });
                client.release();
                await pool.end();
            })
            .catch(console.error);
        break;
    default:
        console.log(`
Database Migration Tool

Usage:
  node migrate.js <command>

Commands:
  migrate, up    Run pending migrations
  rollback, down Rollback last migration
  reset          Reset database and re-run all migrations
  status         Show migration status
        `);
}
