# Database Configuration

This project uses different database locations for development and production environments.

## Development Mode

In development, the database is stored in the project directory for easy access:

- **Location**: `./data/pos_system.db`(hardcoded)
- **Purpose**: Easy debugging, inspection, and version control exclusion
- **Access**: You can open this file with any SQLite browser tool

## Production Mode

In production builds, the database is stored in the proper user data directory.
The app uses Electron's `app.getPath("userData")` which automatically includes the app name:

### Windows

```
%APPDATA%\AuraSwift\pos_system.db
```

### macOS

```
~/Library/Application Support/AuraSwift/pos_system.db
```

### Linux

```
~/.config/AuraSwift/pos_system.db
```

**Note**: The path is constructed using `app.getPath("userData")` which already includes "AuraSwift" in the path. The database file is stored directly in this directory as `pos_system.db`.

## Log Files Location

Log files are stored separately from the database, following Windows best practices:

### Windows

```
%LOCALAPPDATA%\AuraSwift\logs\
```

**Why Local instead of Roaming?**

- Logs are machine-specific and don't need to sync across machines
- Logs can grow large and shouldn't be in Roaming profile
- Reduces network overhead in domain environments
- Follows Windows best practices for log storage

### macOS

```
~/Library/Logs/AuraSwift/
```

### Linux

```
~/.local/share/AuraSwift/logs/
```

**Note**: The app automatically migrates existing logs from the old location (Roaming) to the new location (Local) on first run after update.

## Environment Detection

The system automatically detects the environment using:

1. `process.env.NODE_ENV === 'development'`
2. `process.env.ELECTRON_IS_DEV === 'true'`
3. `!app.isPackaged` (Electron's built-in flag)

## Custom Database Path

You can override the database path using the environment variable:

```bash
export POS_DB_PATH="/custom/path/to/database.db"
```

## Database Inspection

### Development

1. Navigate to `./data/`
2. Open `pos_system.db` with:
   - [DB Browser for SQLite](https://sqlitebrowser.org/)
   - [SQLite Viewer](https://inloop.github.io/sqlite-viewer/)
   - VS Code SQLite extensions

### Production

Use the database info API to get the exact location:

```javascript
const info = await window.databaseAPI.getInfo();
console.log(info.data.path);
```

## Files to Ignore

The `.gitignore` already excludes development database files:

```
data/*.db
data/*.db-wal
data/*.db-shm
```

## Migration Between Environments

If you need to copy data from development to test a production build:

1. **Export data** from development database
2. **Build** the production app
3. **Run** the production app once to create the database structure
4. **Import data** into the production database location

## Windows-Specific Considerations

### File Locations Summary

| File Type       | Location (Windows)                  | Environment Variable     | Purpose                                       |
| --------------- | ----------------------------------- | ------------------------ | --------------------------------------------- |
| **Database**    | `%APPDATA%\AuraSwift\pos_system.db` | `%APPDATA%` (Roaming)    | User data that should sync across machines    |
| **Logs**        | `%LOCALAPPDATA%\AuraSwift\logs\`    | `%LOCALAPPDATA%` (Local) | Machine-specific logs that don't need to sync |
| **Application** | `C:\Program Files\AuraSwift\`       | `%ProgramFiles%`         | System-wide application installation          |

### Why Database is in Roaming but Logs are in Local?

- **Database (Roaming)**: User-specific data that should be available on all machines when using roaming profiles in domain environments
- **Logs (Local)**: Machine-specific diagnostic information that doesn't need to sync, can be large, and shouldn't impact login/logout performance

### Automatic Migration

The app automatically migrates:

- **Database**: From old double-nested paths to correct single-nested paths
- **Logs**: From Roaming profile to Local profile (on first run after update)

## Troubleshooting

- **Permission errors**: Ensure the app has write access to both APPDATA and LOCALAPPDATA directories
- **Database locked**: Close any SQLite browser tools before running the app
- **Missing tables**: The app automatically creates tables on first run
- **Path issues**: Check the console logs for the actual database and log paths being used
- **Log migration**: If logs don't appear in new location, check old location at `%APPDATA%\AuraSwift\logs\`

# Using Your Existing Database

If you have an existing database file in a different location, here are several ways to integrate it with the new system:

## Option 1: Set Custom Database Path (Recommended)

Use the `POS_DB_PATH` environment variable to point to your existing database:

### For Development:

```bash
# Set the environment variable to your existing database
export POS_DB_PATH="/path/to/your/existing/database.db"
npm start
```

### For Production Build:

```bash
# Set the environment variable before launching
export POS_DB_PATH="/path/to/your/existing/database.db"
./dist/AuraSwift.app/Contents/MacOS/AuraSwift
```

### Permanent Configuration:

Create a `.env` file in the project root:

```bash
POS_DB_PATH="/path/to/your/existing/database.db"
```

## Option 2: Copy Database to Development Location

Copy your existing database to the development data directory:

```bash
# Create the data directory if it doesn't exist
mkdir -p ./data

# Copy your existing database
cp "/path/to/your/existing/database.db" "./data/pos_system.db"

# Start the application normally
npm start
```

## Option 3: Copy Database to Production Location

Move your database to the production location:

### macOS:

```bash
# Create the application data directory
mkdir -p "$HOME/Library/Application Support/AuraSwift"

# Copy your existing database
cp "/path/to/your/existing/database.db" "$HOME/Library/Application Support/AuraSwift/pos_system.db"
```

### Windows:

```cmd
# Create the application data directory
mkdir "%APPDATA%\AuraSwift"

# Copy your existing database
copy "C:\path\to\your\existing\database.db" "%APPDATA%\AuraSwift\pos_system.db"
```

### Linux:

```bash
# Create the application data directory
mkdir -p "$HOME/.config/AuraSwift"

# Copy your existing database
cp "/path/to/your/existing/database.db" "$HOME/.config/AuraSwift/pos_system.db"
```

## Verify Database Integration

After setting up your database, verify it's working:

1. **Check database location in the app:**

   - The application has a database info feature accessible through the dashboard
   - It will show the current database path and basic statistics

2. **Test with the utility script:**
   ```bash
   # Test with your custom path
   POS_DB_PATH="/path/to/your/existing/database.db" node test-db-path.mjs
   ```

## Database Schema Compatibility

The application expects certain tables and columns. If your existing database has a different schema:

1. **Backup your existing database first:**

   ```bash
   cp "/path/to/your/existing/database.db" "/path/to/your/existing/database.backup.db"
   ```

2. **Run the application once** - it will automatically create missing tables and columns

3. **Check the migration logs** in the console for any schema updates

## Need Help?

- Run `npm run db:info` to see database configuration help
- Check the [Seeding Guide](../Seeding/SEEDING_GUIDE.md) for default data information
- Check the [Migration System](../Migrations/DATABASE_MIGRATION_SYSTEM.md) for schema updates
- Use the test utility: `node test-db-path.mjs` to verify path logic
