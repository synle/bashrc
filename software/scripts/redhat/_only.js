/** Platform tweaks for Fedora / RHEL / CentOS / Rocky - registers shell config. */
async function doWork() {
  registerPlatformTweaks(
    "RedHat",
    code`
      # update: OS package manager update/upgrade only (dnf preferred, yum fallback)
      alias update='sudo dnf upgrade -y && sudo dnf autoremove -y && sudo dnf clean all || (sudo yum upgrade -y && sudo yum autoremove -y && sudo yum clean all)'
    `,
  );
}
