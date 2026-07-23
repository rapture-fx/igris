//! Destination policy for Action HTTP targets.
//!
//! Complements Overture's bind-time checks. Runtime independently:
//! - allows loopback HTTP or public HTTPS only
//! - resolves DNS and denies private/reserved/metadata ranges
//! - refuses redirects (no credential forwarding across hops)

use anyhow::{anyhow, bail, Result};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DestinationClass {
    LoopbackHttp,
    ExternalHttps,
}

#[derive(Debug, Clone)]
pub struct ValidatedDestination {
    pub class: DestinationClass,
    pub host: String,
    pub port: u16,
    pub addrs: Vec<SocketAddr>,
}

/// Parse, classify, resolve, and validate a target URL for Action execution.
pub fn validate_action_destination(url: &str) -> Result<ValidatedDestination> {
    let (scheme, host, port) = parse_http_url_parts(url)?;
    let host_lower = host.to_ascii_lowercase();
    let class = match scheme.as_str() {
        "http" => {
            if !is_loopback_hostname(&host_lower) {
                bail!("http targets are limited to loopback hosts (127.0.0.1, localhost, ::1)");
            }
            DestinationClass::LoopbackHttp
        }
        "https" => {
            if is_loopback_hostname(&host_lower) {
                bail!("https targets must not use loopback hosts; use http://127.0.0.1 for local development");
            }
            DestinationClass::ExternalHttps
        }
        other => bail!("unsupported target URL scheme {other:?}"),
    };

    if url.contains('@') {
        // extract_url_host strips userinfo for allowlist checks; refuse embedded
        // credentials entirely for Action destinations.
        if let Some(authority) = url
            .split("://")
            .nth(1)
            .and_then(|rest| rest.split('/').next())
        {
            if authority.contains('@') {
                bail!("target URL must not embed credentials");
            }
        }
    }

    let require_loopback = class == DestinationClass::LoopbackHttp;
    let addrs = resolve_and_validate(&host_lower, port, require_loopback)?;
    Ok(ValidatedDestination {
        class,
        host: host_lower,
        port,
        addrs,
    })
}

fn is_loopback_hostname(host: &str) -> bool {
    matches!(host, "127.0.0.1" | "localhost" | "::1")
}

fn parse_http_url_parts(url: &str) -> Result<(String, String, u16)> {
    let u = url.trim();
    let (scheme, rest) = if let Some(r) = u.strip_prefix("https://") {
        ("https".to_string(), r)
    } else if let Some(r) = u.strip_prefix("http://") {
        ("http".to_string(), r)
    } else {
        bail!("unsupported or missing URL scheme");
    };
    let authority = rest.split('/').next().unwrap_or("");
    if authority.is_empty() {
        bail!("target URL host is required");
    }
    if authority.contains('@') {
        bail!("target URL must not embed credentials");
    }
    let (host, port) = if authority.starts_with('[') {
        let end = authority
            .find(']')
            .ok_or_else(|| anyhow!("invalid IPv6 URL host"))?;
        let host = authority[1..end].to_string();
        let port = if let Some(p) = authority[end + 1..].strip_prefix(':') {
            p.parse::<u16>()
                .map_err(|_| anyhow!("invalid URL port"))?
        } else {
            default_port(&scheme)
        };
        (host, port)
    } else {
        match authority.rsplit_once(':') {
            Some((h, p)) if !h.is_empty() && p.chars().all(|c| c.is_ascii_digit()) => {
                let port = p
                    .parse::<u16>()
                    .map_err(|_| anyhow!("invalid URL port"))?;
                (h.to_string(), port)
            }
            _ => (authority.to_string(), default_port(&scheme)),
        }
    };
    if host.is_empty() {
        bail!("target URL host is required");
    }
    Ok((scheme, host, port))
}

fn default_port(scheme: &str) -> u16 {
    if scheme == "https" {
        443
    } else {
        80
    }
}

fn resolve_and_validate(host: &str, port: u16, require_loopback: bool) -> Result<Vec<SocketAddr>> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        classify_ip(ip, require_loopback)?;
        return Ok(vec![SocketAddr::new(ip, port)]);
    }

    let lookup = format!("{host}:{port}");
    let mut resolved: Vec<SocketAddr> = match lookup.to_socket_addrs() {
        Ok(iter) => iter.collect(),
        Err(_) => Vec::new(),
    };
    if resolved.is_empty() {
        // Fall back to public recursive DNS when the system resolver fails.
        resolved = resolve_via_public_dns(host, port)?;
    }
    if resolved.is_empty() {
        bail!("target host {host:?} resolved to no addresses");
    }
    for addr in &resolved {
        classify_ip(addr.ip(), require_loopback)?;
    }
    Ok(resolved)
}

fn resolve_via_public_dns(host: &str, port: u16) -> Result<Vec<SocketAddr>> {
    let mut addrs = Vec::new();
    for dns in ["1.1.1.1:53", "8.8.8.8:53"] {
        if let Ok(ips) = dns_query_a(host, dns) {
            for ip in ips {
                addrs.push(SocketAddr::new(ip, port));
            }
            if !addrs.is_empty() {
                return Ok(addrs);
            }
        }
    }
    bail!("failed to resolve target host {host:?} via public DNS")
}

fn dns_query_a(host: &str, dns_addr: &str) -> Result<Vec<IpAddr>> {
    use std::net::UdpSocket;
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.set_read_timeout(Some(std::time::Duration::from_secs(5)))?;
    socket.connect(dns_addr)?;

    let mut qname = Vec::new();
    for label in host.split('.') {
        let bytes = label.as_bytes();
        if bytes.is_empty() || bytes.len() > 63 {
            bail!("invalid DNS label");
        }
        qname.push(bytes.len() as u8);
        qname.extend_from_slice(bytes);
    }
    qname.push(0);
    // Header: id=0x1234, recursion desired, qdcount=1
    let mut packet = vec![
        0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];
    packet.extend_from_slice(&qname);
    packet.extend_from_slice(&[0x00, 0x01, 0x00, 0x01]); // A IN
    socket.send(&packet)?;

    let mut buf = [0u8; 512];
    let n = socket.recv(&mut buf)?;
    if n < 12 {
        bail!("short DNS response");
    }
    let ancount = u16::from_be_bytes([buf[6], buf[7]]) as usize;
    let mut i = 12;
    // skip question
    while i < n && buf[i] != 0 {
        i += 1 + buf[i] as usize;
    }
    i += 1 + 4; // null + qtype/qclass
    let mut ips = Vec::new();
    for _ in 0..ancount {
        if i >= n {
            break;
        }
        // name (possibly pointer)
        if buf[i] & 0xc0 == 0xc0 {
            i += 2;
        } else {
            while i < n && buf[i] != 0 {
                i += 1 + buf[i] as usize;
            }
            i += 1;
        }
        if i + 10 > n {
            break;
        }
        let rtype = u16::from_be_bytes([buf[i], buf[i + 1]]);
        let rdlength = u16::from_be_bytes([buf[i + 8], buf[i + 9]]) as usize;
        i += 10;
        if i + rdlength > n {
            break;
        }
        if rtype == 1 && rdlength == 4 {
            ips.push(IpAddr::V4(Ipv4Addr::new(
                buf[i],
                buf[i + 1],
                buf[i + 2],
                buf[i + 3],
            )));
        }
        i += rdlength;
    }
    if ips.is_empty() {
        bail!("no A records");
    }
    Ok(ips)
}

fn classify_ip(ip: IpAddr, require_loopback: bool) -> Result<()> {
    let ip = match ip {
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                IpAddr::V4(v4)
            } else {
                IpAddr::V6(v6)
            }
        }
        other => other,
    };

    if require_loopback {
        if !ip.is_loopback() {
            bail!("loopback target resolved to non-loopback address {ip}");
        }
        return Ok(());
    }

    if is_denied_destination_ip(ip) {
        bail!("target resolves to denied address {ip}");
    }
    Ok(())
}

fn is_denied_destination_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_denied_v4(v4),
        IpAddr::V6(v6) => is_denied_v6(v6),
    }
}

fn is_denied_v4(v4: Ipv4Addr) -> bool {
    if v4.is_loopback()
        || v4.is_private()
        || v4.is_link_local()
        || v4.is_multicast()
        || v4.is_unspecified()
        || v4.is_broadcast()
    {
        return true;
    }
    let o = v4.octets();
    // CGNAT 100.64.0.0/10
    if o[0] == 100 && (64..=127).contains(&o[1]) {
        return true;
    }
    // 0.0.0.0/8
    if o[0] == 0 {
        return true;
    }
    // 192.0.0.0/24, TEST-NET-1 192.0.2.0/24
    if o[0] == 192 && o[1] == 0 && (o[2] == 0 || o[2] == 2) {
        return true;
    }
    // TEST-NET-2 / TEST-NET-3
    if o[0] == 198 && o[1] == 51 && o[2] == 100 {
        return true;
    }
    if o[0] == 203 && o[1] == 0 && o[2] == 113 {
        return true;
    }
    // benchmarking 198.18.0.0/15
    if o[0] == 198 && (o[1] == 18 || o[1] == 19) {
        return true;
    }
    false
}

fn is_denied_v6(v6: Ipv6Addr) -> bool {
    if v6.is_loopback()
        || v6.is_multicast()
        || v6.is_unspecified()
        || (v6.segments()[0] & 0xffc0) == 0xfe80 // link-local
        || (v6.segments()[0] & 0xfe00) == 0xfc00 // unique local
    {
        return true;
    }
    // documentation 2001:db8::/32
    let s = v6.segments();
    if s[0] == 0x2001 && s[1] == 0x0db8 {
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_http_literal_allowed() {
        let d = validate_action_destination("http://127.0.0.1:18099/v1/x").unwrap();
        assert_eq!(d.class, DestinationClass::LoopbackHttp);
    }

    #[test]
    fn external_http_rejected() {
        assert!(validate_action_destination("http://example.com/x").is_err());
    }

    #[test]
    fn loopback_https_rejected() {
        assert!(validate_action_destination("https://127.0.0.1/x").is_err());
        assert!(validate_action_destination("https://localhost/x").is_err());
    }

    #[test]
    fn private_literal_https_rejected() {
        assert!(validate_action_destination("https://10.0.0.1/x").is_err());
        assert!(validate_action_destination("https://192.168.1.1/x").is_err());
        assert!(validate_action_destination("https://169.254.169.254/x").is_err());
        assert!(validate_action_destination("https://[fd00::1]/x").is_err());
        assert!(validate_action_destination("https://[::1]/x").is_err());
    }

    #[test]
    fn embedded_credentials_rejected() {
        assert!(validate_action_destination("https://user:pass@example.com/x").is_err());
    }
}
