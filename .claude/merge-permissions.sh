#!/bin/bash
# Merges permissions.allow from settings.local.json into settings.json
# Normalizes Bash commands to include nc_canary=1 prefix

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS_FILE="$SCRIPT_DIR/settings.json"
LOCAL_FILE="$SCRIPT_DIR/settings.local.json"

if [[ ! -f "$LOCAL_FILE" ]]; then
    echo "No settings.local.json found, nothing to merge"
    exit 0
fi

if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo "No settings.json found"
    exit 1
fi

# Function to normalize a permission (add nc_canary=1 to Bash commands)
normalize_permission() {
    local perm="$1"
    # If it's a Bash command without nc_canary=1, add it
    if [[ "$perm" =~ ^Bash\( ]] && [[ ! "$perm" =~ ^Bash\(nc_canary=1 ]]; then
        echo "Bash(nc_canary=1 ${perm#Bash(}"
    else
        echo "$perm"
    fi
}

# Get existing permissions from settings.json
existing=$(jq -r '.permissions.allow // [] | .[]' "$SETTINGS_FILE")

# Get permissions from local file, normalize them, and check if they need to be added
new_perms=()
while IFS= read -r perm; do
    [[ -z "$perm" ]] && continue
    normalized=$(normalize_permission "$perm")

    # Check if already exists
    if ! echo "$existing" | grep -qxF "$normalized"; then
        new_perms+=("$normalized")
        echo "Adding: $normalized"
    fi
done < <(jq -r '.permissions.allow // [] | .[]' "$LOCAL_FILE")

if [[ ${#new_perms[@]} -eq 0 ]]; then
    echo "No new permissions to add"
    exit 0
fi

# Build jq filter to add new permissions
jq_filter='.permissions.allow += ['
first=true
for perm in "${new_perms[@]}"; do
    if [[ "$first" == "true" ]]; then
        first=false
    else
        jq_filter+=','
    fi
    # Escape for jq
    escaped=$(printf '%s' "$perm" | jq -Rs '.')
    jq_filter+="$escaped"
done
jq_filter+='] | .permissions.allow |= unique | .permissions.allow |= sort'

# Update settings.json
jq "$jq_filter" "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"

echo "Merged ${#new_perms[@]} new permission(s)"
