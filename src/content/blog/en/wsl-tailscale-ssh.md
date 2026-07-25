---
title: 'Running Hermes on an always-on WSL2 server, reachable over Tailscale SSH'
description: 'Turn WSL2 on a Windows box into an always-on server reachable from anywhere over Tailscale SSH. Notes on mirrored networking and the auto-login / auto-start setup.'
pubDate: 'Jul 25 2026'
commentId: 'wsl-tailscale-ssh-en'
translationKey: 'wsl-tailscale-ssh'
---

I set up WSL2, running on a Windows machine (a mini PC), as an always-on server that I can SSH into from outside over Tailscale. This is a work note recording the configuration that ended up working.

WSL and Tailscale both move fast, so this is as of July 2026, on the following setup:

- Windows 11 25H2 (build 10.0.26200.8875)
- WSL 2.7.10.0 / kernel 6.18.33.2
- Distribution: NixOS-WSL

The mirrored networking mode used below requires Windows 11 22H2 or later and WSL 2.0 or later.

## The overall setup

There are two Windows accounts:

- **The everyday account** — Tailscale is authenticated and configured here.
- **`hermes` (the server account)** — auto-logs in, and handles starting WSL and locking the screen. It does not have Tailscale.

The article has two parts: first, making the server reachable from outside (remote access); second, keeping it up unattended across reboots (always-on).

## Remote access

### WSL networking

SSHing from outside to port 22 on the tailnet address does not reach WSL's sshd.

By default WSL2 runs in NAT mode. WSL is a virtual machine with its own IP address, separate from the Windows host, so from Windows it looks like an external host. Meanwhile the Tailscale client runs on the Windows side, and the tailnet IP address is assigned to the Windows host. So when you hit port 22 over the tailnet, what responds is Windows, not WSL.

The fix is WSL2's **mirrored networking mode**. It mirrors the Windows network interfaces onto the WSL side, so WSL can listen on the same address as Windows. As a result, a connection to port 22 that Windows receives reaches WSL's sshd directly. No manual port forwarding is needed.

Other options are forwarding with `netsh interface portproxy` while staying in NAT mode, or running Tailscale inside WSL so that WSL itself becomes a tailnet node. Here Tailscale sits on the Windows host, so mirrored mode is used.

### 1. Enable mirrored mode in `.wslconfig`

Write the following to `%USERPROFILE%\.wslconfig`.

```ini
[wsl2]
networkingMode=mirrored
```

After editing, restart WSL.

```powershell
wsl --shutdown
```

### 2. Set Tailscale to unattended mode

In the Tailscale client on Windows, right-click the system tray icon and choose **Preferences → Run unattended**. Confirm with Yes in the dialog.

The Windows Tailscale client normally runs within the session of the logged-in user. In this setup Tailscale was authenticated under the everyday account, but the account that stays logged on is `hermes`, a different account that does not have Tailscale. Without this setting, the tailnet connection is up only while the user who authenticated Tailscale is logged on, and it drops while `hermes` is logged on.

With unattended mode enabled, Tailscale keeps running independent of any user session. This keeps the tailnet connection up even with `hermes` auto-logged-in.

### 3. Bring up sshd on the WSL side

Set up sshd the usual way. Just make sure it starts automatically when WSL boots, by enabling it under systemd (or whatever init your distribution uses). The following is a NixOS-WSL example.

In `/etc/nixos/configuration.nix`, place the key declaratively and disable password authentication. NixOS-WSL runs systemd, so `enable = true` brings sshd up automatically at boot.

```nix
{ config, pkgs, ... }:

{
  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      PermitRootLogin = "no";
    };
  };

  # replace with your own public key
  users.users.user.openssh.authorizedKeys.keys = [
    "ssh-ed25519 AAAA..."
  ];
}
```

Apply it.

```bash
sudo nixos-rebuild switch
```

### 4. Connect

Now you can log in via the tailnet machine name. This name derives from the machine name of the Windows host that joined the tailnet, and you can check it in the Tailscale admin console.

```bash
ssh user@your-host.your-tailnet.ts.net
```

### No manual firewall configuration

In this setup, neither Windows Firewall nor the Hyper-V Firewall has any rule added by hand, yet access over the tailnet works.

**Windows Defender Firewall (host side)** — The Windows Tailscale client automatically adds a rule (`Tailscale-In`) allowing inbound to its own interface. Port 22 on the LAN-side interface has no such allowance, so it stays at the default inbound block. In fact, from another machine on the LAN, port 22 at the Windows `192.168` address did not connect; it connected only over the tailnet.

**Hyper-V Firewall (WSL VM side)** — In mirrored mode, this layer was not controlling this path. Looking at the WSL VM's Hyper-V Firewall settings in PowerShell, the inbound default is Block and there is no rule allowing port 22. Yet SSH over the tailnet gets through. It kept getting through even with `LoopbackEnabled` set to False. Since it passes with the default at Block, no allow rule, and no loopback exemption, one can infer that this inbound is not under the Hyper-V Firewall's control.

```powershell
# WSL VM's Hyper-V Firewall settings (the VMCreatorId is a fixed WSL value)
Get-NetFirewallHyperVVMSetting -PolicyStore ActiveStore `
  -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
```

Note that in mirrored mode Windows and Linux share the port space, so if OpenSSH Server is enabled on the Windows side, port 22 collides. Disable it on a server machine.

## Always-on

A WSL distribution does not start until someone logs on to Windows and `wsl.exe` is invoked. To start WSL automatically after a Windows reboot, combine Windows auto-login with Task Scheduler.

### 5. Auto-login

Enable auto-login for `hermes`. Sysinternals [Autologon](https://learn.microsoft.com/en-us/sysinternals/downloads/autologon) stores the credentials encrypted in the LSA (safer than writing `DefaultPassword` in plaintext in the registry).

This gives a foundation where `hermes` logs on every time Windows starts, firing the next two tasks.

### 6. Auto-starting WSL (Task Scheduler)

Register a task, triggered on `hermes` logon, that starts WSL and holds it open. The action is this.

```
wsl.exe -d NixOS bash -lc "sleep infinity"
```

A logon trigger fires on every auto-login, and thus on every reboot. It never fires before logon, so there are no ordering concerns with auto-login and no special "run after reboot" setting is needed.

### 7. Auto-locking the screen

Auto-login leaves the screen open (logged on, unlocked) on every boot. To avoid this, register a task that immediately locks the screen.

```
rundll32.exe user32.dll,LockWorkStation
```

Locking keeps the session alive, so WSL keeps running.

### 8. Preventing sleep and hibernation

To keep Windows from entering sleep or hibernation, set both sleep and hibernation to "never" on AC power in the power options.

```powershell
# check (index 0 on AC means "never")
powercfg /query SCHEME_CURRENT SUB_SLEEP
```

---

With this, even after a Windows reboot, `hermes` auto-logs in unattended, WSL starts and sshd comes up, and the machine is reachable over SSH via the tailnet from outside.
