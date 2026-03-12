use crate::bounds::Bounds;

/// CPU quota container backed by cgroups v2 on Linux.
/// On non-Linux targets this is a no-op stub so the crate compiles everywhere.
pub struct CGroup {
    #[cfg(target_os = "linux")]
    cgroup: cgroups_rs::fs::Cgroup,
}

impl CGroup {
    /// Create a new cgroup scoped to `igris_containment` with the given CPU bounds.
    pub fn new(bounds: &Bounds) -> Result<Self, String> {
        #[cfg(target_os = "linux")]
        {
            use cgroups_rs::fs::{cgroup_builder::CgroupBuilder, hierarchies};

            let hier = hierarchies::auto();
            let period: u64 = 100_000; // 100 ms in µs
            let quota = (bounds.max_cpu_percent as i64 * period as i64) / 100;

            let mut builder = CgroupBuilder::new("igris_containment");
            builder
                .cpu()
                .quota(quota)
                .period(period)
                .done();
            let cg = builder.build(hier).map_err(|e| e.to_string())?;
            Ok(Self { cgroup: cg })
        }

        #[cfg(not(target_os = "linux"))]
        {
            let _ = bounds;
            Ok(Self {})
        }
    }

    /// Add the current process to the cgroup.
    pub fn apply(&self) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            use cgroups_rs::CgroupPid;
            let pid = std::process::id() as u64;
            self.cgroup
                .add_task(CgroupPid::from(pid))
                .map_err(|e| e.to_string())
        }

        #[cfg(not(target_os = "linux"))]
        {
            Ok(())
        }
    }

    /// Add an arbitrary process by PID to the cgroup (used by Supervisor for worker PIDs).
    pub fn apply_to_pid(&self, pid: u32) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            use cgroups_rs::CgroupPid;
            self.cgroup
                .add_task(CgroupPid::from(pid as u64))
                .map_err(|e| e.to_string())
        }

        #[cfg(not(target_os = "linux"))]
        {
            let _ = pid;
            Ok(())
        }
    }

    /// Remove this cgroup from the hierarchy.
    pub fn destroy(self) -> Result<(), String> {
        #[cfg(target_os = "linux")]
        {
            self.cgroup.delete().map_err(|e| e.to_string())
        }

        #[cfg(not(target_os = "linux"))]
        {
            Ok(())
        }
    }
}
