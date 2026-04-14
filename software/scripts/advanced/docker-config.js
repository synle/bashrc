/** Configures Docker: log rotation (10MB x 5), Google DNS, 64k nofile ulimits, build cache GC (10GB reserved, 48h policy). */
/**
 * Finds the Docker daemon.json path across platforms.
 * @returns {string} Path to daemon.json (creates ~/.docker/ if needed).
 */
function _getDockerDaemonJsonPath() {
  if (is_os_windows) {
    return `/mnt/c/ProgramData/docker/config/daemon.json`;
  }
  return path.join(BASE_HOMEDIR_LINUX, ".docker/daemon.json");
}

/**
 * Returns the desired Docker daemon configuration.
 * Focuses on log rotation, DNS reliability, ulimits, and build cache management.
 * @returns {object} Docker daemon.json settings to merge.
 */
function _getDockerDaemonSettings() {
  return {
    "log-driver": "json-file", // structured JSON log driver
    "log-opts": {
      "max-file": "5", // keep 5 rotated log files per container
      "max-size": "10m", // rotate at 10 MB per log file
    },
    dns: ["8.8.8.8", "8.8.4.4"], // Google DNS (reliable fallback)
    "max-concurrent-downloads": 3, // parallel image layer downloads
    "max-concurrent-uploads": 5, // parallel image layer uploads
    "max-download-attempts": 5, // retry failed layer downloads
    "default-shm-size": "64M", // shared memory size for containers (default 64M)
    "default-ulimits": {
      nofile: { Hard: 64000, Soft: 64000 }, // max open files per container (prevents "too many open files")
    },
    features: {
      cdi: true, // Container Device Interface (GPU/device passthrough)
    },
    builder: {
      gc: {
        enabled: true, // enable build cache garbage collection
        defaultReservedSpace: "10GB", // keep at least 10 GB of build cache
        policy: [
          {
            maxUsedSpace: "512MB", // evict local source cache above 512 MB
            keepDuration: "48h", // only if older than 48 hours
            filter: ["type=source.local"],
          },
        ],
      },
    },
  };
}

/**
 * Deep merges source into target recursively, preserving existing keys.
 * @param {object} target - The base object.
 * @param {object} source - The overrides.
 * @returns {object} The merged result.
 */
function _deepMergeDocker(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      _deepMergeDocker(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/** Applies Docker daemon.json configuration with log rotation, DNS, and build cache GC. */
async function doWork() {
  log(">> Install Docker daemon configs");

  const daemonJsonPath = _getDockerDaemonJsonPath();
  const dockerDir = path.dirname(daemonJsonPath);

  if (!pathExists(dockerDir)) {
    log(">>> Skipped: Docker config directory not found (Docker not installed)");
    return;
  }

  log(">>> Docker daemon.json:", daemonJsonPath);
  await backupConfigFile(daemonJsonPath);

  let existing = {};
  if (pathExists(daemonJsonPath)) {
    try {
      existing = await readJson`${daemonJsonPath}`;
    } catch (e) {
      log(">>> Warning: Could not parse existing daemon.json, starting fresh");
    }
  }

  const merged = _deepMergeDocker(existing, _getDockerDaemonSettings());
  await writeText(daemonJsonPath, JSON.stringify(merged, null, 2));
  log(">>> Done. Restart Docker daemon for changes to take effect.");
}
