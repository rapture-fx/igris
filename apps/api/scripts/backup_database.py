import os
import subprocess
import datetime

# Database settings
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "schlep-engine")
DB_USER = os.getenv("DB_USER", "wira")

# Backup settings
BACKUP_DIR = "backups"
os.makedirs(BACKUP_DIR, exist_ok=True)

def backup_database():
    """
    Creates a compressed backup of the database.
    """
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_file = os.path.join(BACKUP_DIR, f"backup-{timestamp}.sql.gz")

    command = [
        "pg_dump",
        f"--host={DB_HOST}",
        f"--port={DB_PORT}",
        f"--username={DB_USER}",
        f"--dbname={DB_NAME}",
        "--format=c",
        "--blobs",
    ]

    try:
        with open(backup_file, "wb") as f:
            process = subprocess.Popen(command, stdout=subprocess.PIPE)
            subprocess.run(["gzip", "-c"], stdin=process.stdout, stdout=f)
            process.wait()

        if process.returncode != 0:
            print(f"Error: pg_dump exited with code {process.returncode}")
        else:
            print(f"Database backup successful: {backup_file}")

    except Exception as e:
        print(f"An error occurred during backup: {e}")

if __name__ == "__main__":
    backup_database() 