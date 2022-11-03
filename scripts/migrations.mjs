// @ts-check
// Inspired from https://github.com/porsager/postgres-shift

import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import postgres from 'postgres'
import { spinner } from 'zx/experimental'
import 'zx/globals'

// Constants --

const MIGRATIONS_TABLE_NAME = 'e2esdk_migrations'
const MIGRATIONS_DIR = resolve(__dirname, '../src/server/database/migrations')
const SEED_SCRIPT = resolve(MIGRATIONS_DIR, '../seed.mjs')
const INDEX_LEN = 5 // number of digits in indices, eg 00042

const indexRegexp = new RegExp(`^[0-9]{${INDEX_LEN}}_`)

// Usage --

function printUsage() {
  console.log(`
  ${chalk.bold('Manage PostgreSQL database migrations')}

  Usage:
    ${chalk.red('$')} zx ./scripts/migrate.mjs ${chalk.green(
    '[operation]'
  )} ${chalk.dim('(OPTIONS)')}

  Operations:
    ${chalk.green('•')} new              ${chalk.dim(
    'Create a new migration file'
  )}
    ${chalk.green('•')} apply            ${chalk.dim(
    'Apply all pending migrations'
  )}
    ${chalk.green('•')} seed             ${chalk.dim(
    `Run seed script (${SEED_SCRIPT})`
  )}
    ${chalk.green('•')} reset            ${chalk.dim('Reset the database')}

  Options:
    --help                      Show this message
    --dry-run                   Don't actually apply migrations, print what would happen.
    --dangerously-skip-confirm  Don't confirm database reset ${chalk.italic.dim(
      "(you've been warned)"
    )}
`)
}

if (argv.help) {
  printUsage()
  process.exit(0)
}

// --

dotenv.config()

if (!process.env.POSTGRESQL_URL) {
  console.error(
    `Missing required environment variable ${chalk.bold('POSTGRESQL_URL')}`
  )
  process.exit(1)
}

const dryRun = Boolean(argv['dry-run'])

const sql = postgres(process.env.POSTGRESQL_URL, {
  transform: postgres.camel,
})

if (argv._[0] === 'new') {
  await createNewMigrationFile()
  process.exit(0)
}

if (argv._[0] === 'apply') {
  await applyPendingMigrations()
  process.exit(0)
}

if (argv._[0] === 'seed') {
  await runSeedScript()
  process.exit(0)
}

if (argv._[0] === 'reset') {
  await resetDatabase()
  process.exit(0)
}

console.error('Missing required operation')
printUsage()
process.exit(1)

// Operations --

async function createNewMigrationFile() {
  printConnectionInfo()
  const existingMigrations = await getFilesystemMigrations()
  const migrationName = await question('Migration name: ')
  const migrationSlug = migrationName.replace(/[\s_]/g, '-').toLowerCase()
  const latest = existingMigrations.at(-1)
  const newID = indexToStr((latest?.migration_id ?? 0) + 1)
  const filePath = resolve(
    MIGRATIONS_DIR,
    `${newID}_${migrationSlug}`,
    'migration.sql'
  )
  await fs.mkdir(dirname(filePath))
  await fs.writeFile(
    filePath,
    `-- Migration ${newID} - ${migrationName}
-- Generated on ${new Date().toISOString()}

-- todo: Add migration code here
`,
    { encoding: 'utf8' }
  )

  console.info(`
✨ Created migration file ${chalk.dim(filePath)}`)
}

async function applyPendingMigrations() {
  printConnectionInfo()
  await ensureMigrationsTable()
  const fsMigrations = await getFilesystemMigrations()
  console.info(
    `🔍 ${fsMigrations.length} migration${
      fsMigrations.length === 1 ? '' : 's'
    } found in ${chalk.dim(MIGRATIONS_DIR)}`
  )
  const current = await getCurrentDatabaseMigration()
  const pending = fsMigrations.slice(current ? current.id : 0)
  if (!pending.length) {
    console.info('✅ No pending migrations to apply.')
    return
  }
  console.info(`📥 ${pending.length} pending migration${
    pending.length === 1 ? '' : 's'
  } to apply:
     ${pending
       .map(
         migration =>
           `${indexToStr(migration.migration_id)} - ${migration.name}`
       )
       .join('\n     ')}
  `)

  while (pending.length) {
    const current = pending.shift()
    if (!current) break
    await sql.begin(sql =>
      spinner(() =>
        apply(sql, current).catch(error => {
          console.error(error)
          console.info(
            `🔄 Last migration has been rolled back ${chalk.dim(
              `(${indexToStr(current.migration_id)} - ${current.name})`
            )}`
          )
          process.exit(1)
        })
      )
    )
  }

  async function apply(sql, { path, migration_id, name }) {
    const schemaMigrationFile = resolve(path, 'migration.sql')
    const dataMigrationFile = resolve(path, 'migration.mjs')
    const hasSchemaMigration = fs.existsSync(schemaMigrationFile)
    const hasDataMigration = fs.existsSync(dataMigrationFile)

    if (!hasSchemaMigration && !hasDataMigration) {
      throw new Error(`
  🚨 ${chalk.red(`No file found for migration ${indexToStr(migration_id)}`)}

  Make sure at least one of those exist:
    - ${chalk.dim('schema migration')} ${schemaMigrationFile}
    - ${chalk.dim('data migration')}   ${dataMigrationFile}
`)
    }

    console.info(
      `⚙️ Applying migration ${indexToStr(
        migration_id
      )} - ${name} ${chalk.italic.dim(
        '(' +
          [hasSchemaMigration && 'schema', hasDataMigration && 'data']
            .filter(Boolean)
            .join(' + ') +
          ')'
      )}`
    )

    // Run schema migration first
    if (hasSchemaMigration) {
      console.info(
        chalk.dim(`  ${hasDataMigration ? '├' : '└'} ${schemaMigrationFile}`)
      )
      if (!dryRun) {
        await sql.file(schemaMigrationFile)
      }
    }
    // Run data migrations (if any)
    if (hasDataMigration) {
      console.info(chalk.dim(`  └ ${dataMigrationFile}`))
      const { apply } = await import(dataMigrationFile)
      if (!dryRun) {
        await apply(sql)
      }
    }
    if (dryRun) {
      return
    }
    await sql`
    INSERT INTO ${sql(MIGRATIONS_TABLE_NAME)} (
      migration_id,
      name
    ) VALUES (
      ${migration_id},
      ${name}
    )
  `
  }
}

async function runSeedScript() {
  printConnectionInfo()
  console.info(
    chalk.green(`🌱 Seeding database using script `) + chalk.dim(SEED_SCRIPT)
  )
  const { apply } = await import(SEED_SCRIPT)
  if (!dryRun) {
    await apply(sql)
  }
  console.info(`The database has been seeded.`)
}

async function resetDatabase() {
  printConnectionInfo()
  console.warn(
    chalk.yellowBright(
      `⚠️ You are about to drop all tables in database ${chalk.bold(
        sql.options.database
      )}:`
    )
  )
  // https://stackoverflow.com/a/2611745
  const tables = await sql`
    WITH tbl AS (
      SELECT table_schema, TABLE_NAME
      FROM information_schema.tables
      WHERE TABLE_NAME not like 'pg_%'
      AND table_schema in ('public')
    )
    SELECT
      table_schema,
      TABLE_NAME,
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, TABLE_NAME), FALSE, TRUE, '')))[1]::text::int AS row_count
    FROM tbl
    ORDER BY row_count DESC
  `
  if (tables.length === 0) {
    console.info('Database is empty')
  } else {
    console.table(
      tables.map(({ tableName, rowCount }) => ({
        'table name': tableName,
        rows: parseInt(rowCount),
      }))
    )
  }
  if (!argv['dangerously-skip-confirm']) {
    const confirm = await question('Enter the database name to confirm: ')
    if (confirm !== sql.options.database) {
      console.info('Aborted')
      return
    }
  }
  await sql`DROP SCHEMA public CASCADE`
  await sql`CREATE SCHEMA public`
  console.info(
    `The database has been reset, run migrations again with:

    ${chalk.red('$')} yarn db:migrations apply
`
  )
}

// Helpers --

async function getFilesystemMigrations() {
  const paths = await fs.readdir(MIGRATIONS_DIR)
  const mismatching = []
  const migrations = paths
    .filter(
      x =>
        fs.statSync(resolve(MIGRATIONS_DIR, x)).isDirectory() &&
        indexRegexp.test(x)
    )
    .sort()
    .map((x, i) => {
      const migration = {
        path: resolve(MIGRATIONS_DIR, x),
        migration_id: parseInt(x.slice(0, INDEX_LEN)),
        name: x.slice(INDEX_LEN + 1).replace(/-/g, ' '),
      }
      if (migration.migration_id !== i + 1) {
        mismatching.push({
          expectedID: i + 1,
          migration,
        })
      }
      return migration
    })

  if (mismatching.length) {
    console.error(
      `
  ${chalk.red.bold('🚨 Mismatching migration files indexing')}

  The following migration(s) are numbered incorrectly:
    ${mismatching
      .map(
        ({ expectedID, migration }) =>
          `${chalk.red(
            indexToStr(migration.migration_id)
          )} (should be ${chalk.green(indexToStr(expectedID))}) ${chalk.dim(
            migration.path + '/migration.sql'
          )}`
      )
      .join('\n    ')}
`
    )
    process.exit(1)
  }
  return migrations
}

function indexToStr(index) {
  return index.toFixed().padStart(INDEX_LEN, '0')
}

function ensureMigrationsTable() {
  return sql`
  SELECT '${sql(MIGRATIONS_TABLE_NAME)}'::regclass
`.catch(() => {
    console.info(
      chalk.green(
        `✨ Creating migrations table ${chalk.bold(MIGRATIONS_TABLE_NAME)}`
      )
    )
    return sql`
    CREATE TABLE ${sql(MIGRATIONS_TABLE_NAME)} (
      migration_id SERIAL PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      NAME TEXT
    )
  `
  })
}

function getCurrentDatabaseMigration() {
  return sql`
  SELECT migration_id AS id FROM ${sql(MIGRATIONS_TABLE_NAME)}
  ORDER BY migration_id DESC
  LIMIT 1
`.then(([first]) => first)
}

function printConnectionInfo() {
  console.info(
    chalk.dim(
      `🔌 Connecting to PostgreSQL database ${chalk.blue(
        sql.options.database
      )} on ${chalk.green(sql.options.host)}:${chalk.dim(sql.options.port)}`
    )
  )
  if (dryRun) {
    console.info(
      `${chalk.green(
        '🧪 Dry-run mode'
      )} - no modification will be made to the database.`
    )
  }
}
